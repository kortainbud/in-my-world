-- ===== 20261119000000_init.sql =====
-- In My World — initial schema (Supabase / PostgreSQL)
--
-- Mirrors src/lib/server/models.ts table-for-table. Auth users live in
-- auth.users (Supabase Auth); everything else references them.
-- Writes that move money or credits (credit_transactions, payments,
-- subscriptions, generation_jobs) are performed only by the server using the
-- service role. Clients get read access to their own rows via RLS.

-- gen_random_uuid() is built into PostgreSQL 13+.

-- ---------- Enums ----------
create type visual_style as enum ('roblox', 'minecraft');
create type project_status as enum ('queued', 'processing', 'awaiting_render', 'rendering', 'completed', 'failed');
create type visibility as enum ('private', 'public');
create type plan_id as enum ('free', 'creator', 'pro');
create type credit_kind as enum ('grant_signup', 'grant_monthly', 'purchase', 'debit_generation', 'refund_generation', 'dev_grant');
create type character_source as enum ('official', 'community', 'creator', 'featured_personality', 'licensed');
create type reuse_policy as enum ('anyone', 'owner_only', 'paid_plans');
create type wallet_chain as enum ('solana', 'evm');
create type payment_status as enum ('pending', 'succeeded', 'failed');

-- ---------- Profiles ----------
create table profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);

-- ---------- Subscriptions & credits ----------
create table subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan_id plan_id not null default 'free',
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due')),
  provider text not null default 'none',
  provider_ref text,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '1 month')
);

create table credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null,
  kind credit_kind not null,
  job_id uuid,
  payment_id uuid,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index credit_transactions_user_idx on credit_transactions (user_id, created_at desc);
-- At most one refund per job.
create unique index credit_refund_once on credit_transactions (job_id) where kind = 'refund_generation';

-- Balance is always derived from the ledger, never stored client-side.
create view credit_balances with (security_invoker = true) as
  select user_id, coalesce(sum(amount), 0)::integer as balance
  from credit_transactions group by user_id;

-- ---------- Characters ----------
create table characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade, -- null = platform-owned
  name text not null check (char_length(name) between 1 and 32),
  description text not null default '',
  personality text not null default '',
  style text not null default 'any' check (style in ('roblox', 'minecraft', 'any')),
  appearance jsonb not null,
  voice text,
  visibility visibility not null default 'private',
  source character_source not null default 'creator',
  featured boolean not null default false,
  reuse_policy reuse_policy not null default 'owner_only',
  permission_note text,
  created_at timestamptz not null default now()
);
create index characters_owner_idx on characters (owner_id);
create index characters_public_idx on characters (visibility, featured);

-- Generated 3D assets per character (rig/style variants, portraits).
create table character_assets (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters (id) on delete cascade,
  style visual_style not null,
  kind text not null check (kind in ('portrait', 'rig', 'texture')),
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- ---------- Projects, stories, scenes ----------
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled world',
  prompt text not null check (char_length(prompt) between 8 and 600),
  style visual_style not null,
  duration_preset smallint not null check (duration_preset in (30, 60, 90)),
  aspect text not null default '9:16',
  mode text not null default 'auto',
  voice text,
  cast_ids uuid[] not null default '{}',
  category text not null,
  visibility visibility not null default 'private',
  status project_status not null default 'queued',
  parent_project_id uuid references projects (id) on delete set null,
  views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_idx on projects (user_id, created_at desc);
create index projects_public_idx on projects (visibility, status, created_at desc);

create table stories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references projects (id) on delete cascade,
  source text not null check (source in ('anthropic', 'dev-template')),
  model text,
  title text not null,
  premise text not null,
  hook text not null,
  ending text not null,
  music_mood text not null,
  cast_specs jsonb not null default '[]', -- resolved CharacterSpec[]
  refs jsonb not null default '{}',      -- scene ref -> character id
  generated_character_ids text[] not null default '{}',
  timeline jsonb,                        -- compiled Timeline consumed by the renderer
  created_at timestamptz not null default now()
);

create table scenes (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories (id) on delete cascade,
  scene_number smallint not null,
  narration text not null,
  description text not null,
  environment text not null,
  time_of_day text not null,
  camera text not null,
  characters jsonb not null,             -- [{ref, action, position, expression, label, scaleTo}]
  props text[] not null default '{}',
  prop_text text,
  dialogue jsonb,
  sfx text[] not null default '{}',
  start_sec real,
  duration_sec real,
  unique (story_id, scene_number)
);

-- ---------- Jobs & videos ----------
create table generation_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status project_status not null default 'queued',
  stages jsonb not null,                 -- [{key, status, startedAt, endedAt, detail}]
  attempts smallint not null default 1,
  max_attempts smallint not null default 3,
  error text,
  credit_cost integer not null,
  idempotency_key text,
  export_height smallint not null check (export_height in (720, 1080)),
  watermark boolean not null,
  engine jsonb not null,
  render_lease_agent text,
  render_lease_expires_at timestamptz,
  render_progress jsonb,
  previews jsonb not null default '[]',
  audio jsonb,
  refunded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index generation_jobs_queue_idx on generation_jobs (status, created_at);

create table generated_videos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  storage_path text not null,
  thumb_path text not null,
  width smallint not null,
  height smallint not null,
  duration_sec real not null,
  size_bytes bigint not null,
  video_codec text not null,
  audio_codec text not null,
  engine text not null,
  created_at timestamptz not null default now()
);
alter table projects add column video_id uuid references generated_videos (id) on delete set null;

-- ---------- Payments & wallets ----------
create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  kind text not null check (kind in ('subscription', 'credits')),
  item_id text not null,
  status payment_status not null default 'pending',
  amount_cents integer not null,
  currency text not null default 'usd',
  credits integer not null default 0,
  provider_ref text unique,
  created_at timestamptz not null default now()
);

create table wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chain wallet_chain not null,
  address text not null,
  purpose text not null default 'identity' check (purpose = 'identity'),
  linked_at timestamptz not null default now(),
  unique (chain, address)
);

create table wallet_nonces (
  nonce text primary key,
  chain wallet_chain not null,
  address text not null,
  purpose text not null check (purpose in ('link', 'signin')),
  user_id uuid references auth.users (id) on delete cascade,
  message text not null,
  expires_at timestamptz not null
);

-- ---------- Public content & featured characters ----------
create view public_content with (security_invoker = true) as
  select p.id, p.title, p.prompt, p.style, p.category, p.views, p.created_at,
         v.storage_path, v.thumb_path, v.duration_sec, pr.handle, pr.display_name
  from projects p
  join generated_videos v on v.id = p.video_id
  join profiles pr on pr.user_id = p.user_id
  where p.visibility = 'public' and p.status = 'completed';

create view featured_characters with (security_invoker = true) as
  select * from characters where featured and visibility = 'public';

-- ---------- Row level security ----------
alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table credit_transactions enable row level security;
alter table characters enable row level security;
alter table character_assets enable row level security;
alter table projects enable row level security;
alter table stories enable row level security;
alter table scenes enable row level security;
alter table generation_jobs enable row level security;
alter table generated_videos enable row level security;
alter table payments enable row level security;
alter table wallets enable row level security;
alter table wallet_nonces enable row level security; -- no client policies: server only

-- Profiles: public read (handles show on shared videos), owner update.
create policy profiles_read on profiles for select using (true);
create policy profiles_update on profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Money tables: owner read only. Inserts/updates happen with the service role.
create policy subscriptions_read on subscriptions for select using (auth.uid() = user_id);
create policy credits_read on credit_transactions for select using (auth.uid() = user_id);
create policy payments_read on payments for select using (auth.uid() = user_id);

-- Characters: platform + public characters are readable by everyone; owners manage their own.
create policy characters_read on characters for select using (visibility = 'public' or owner_id = auth.uid() or owner_id is null);
create policy characters_insert on characters for insert with check (owner_id = auth.uid() and source in ('creator', 'community') and not featured);
create policy characters_update on characters for update using (owner_id = auth.uid()) with check (owner_id = auth.uid() and not featured);
create policy characters_delete on characters for delete using (owner_id = auth.uid());
create policy character_assets_read on character_assets for select using (
  exists (select 1 from characters c where c.id = character_id and (c.visibility = 'public' or c.owner_id = auth.uid() or c.owner_id is null))
);

-- Projects: owner full read; anyone can read public completed projects.
create policy projects_read on projects for select using (user_id = auth.uid() or (visibility = 'public' and status = 'completed'));
create policy projects_update on projects for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy projects_delete on projects for delete using (user_id = auth.uid());

create policy stories_read on stories for select using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));
create policy scenes_read on scenes for select using (
  exists (select 1 from stories s join projects p on p.id = s.project_id where s.id = story_id and p.user_id = auth.uid())
);
create policy jobs_read on generation_jobs for select using (user_id = auth.uid());
create policy videos_read on generated_videos for select using (
  exists (select 1 from projects p where p.id = project_id and (p.user_id = auth.uid() or (p.visibility = 'public' and p.status = 'completed')))
);
create policy wallets_read on wallets for select using (user_id = auth.uid());
create policy wallets_delete on wallets for delete using (user_id = auth.uid());

-- ---------- Storage ----------
-- Buckets: videos, thumbs (public read only via signed URLs or the public_content view),
-- previews and audio (private). Object paths are "<user_id>/<file>".
insert into storage.buckets (id, name, public) values
  ('videos', 'videos', false), ('thumbs', 'thumbs', false), ('previews', 'previews', false), ('audio', 'audio', false)
on conflict (id) do nothing;

create policy storage_owner_read on storage.objects for select
  using (bucket_id in ('videos', 'thumbs', 'previews', 'audio') and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Housekeeping ----------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger projects_touch before update on projects for each row execute function touch_updated_at();
create trigger jobs_touch before update on generation_jobs for each row execute function touch_updated_at();

-- ===== 20261119010000_storytelling.sql =====
-- Storytelling framework: formats, series, editorial checklist, retention metrics.

create type story_format as enum ('strange_world', 'mystery_series', 'impossible_choice');

alter table projects
  add column format story_format not null default 'strange_world',
  add column series_id uuid references projects (id) on delete set null,
  add column episode smallint not null default 1 check (episode >= 1),
  add column previous_project_id uuid references projects (id) on delete set null,
  add column shares integer not null default 0;
create index projects_series_idx on projects (series_id, episode);

alter table stories
  add column sheet jsonb,                 -- StorySheet: premise, rule + five questions, protagonist, escalation, twist, ending, continuation
  add column checklist jsonb,             -- [{key, label, pass: true|false|null, note}]
  add column checklist_source text check (checklist_source in ('editor', 'structure')),
  add column revised boolean not null default false;

alter table scenes
  add column beat text,
  add column shot text check (shot in ('establishing', 'character', 'suspense', 'reveal')),
  add column delivery text check (delivery in ('normal', 'fast', 'slow')),
  add column pause_before boolean not null default false,
  add column choice jsonb;

-- Per-viewer playback summary (plays inside In My World only).
create table viewer_stats (
  target_id text not null,                -- project id or sample id
  viewer text not null,                   -- anonymous viewer cookie id
  plays integer not null default 0,
  watched real not null default 0,
  furthest real not null default 0,
  completed boolean not null default false,
  reached_3s boolean not null default false,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (target_id, viewer)
);
alter table viewer_stats enable row level security; -- server only (service role)

-- ===== 20261119020000_payments.sql =====
-- Card (Stripe) and crypto (Solana USDC/SOL) payments.
alter table payments
  drop constraint if exists payments_status_check;
alter type payment_status add value if not exists 'expired';
alter table payments
  add column crypto jsonb,               -- {token, amount (base units), decimals, mint, receiver, reference, cluster, expiresAt, usdRate}
  add column fulfilled_at timestamptz,
  add constraint payments_provider_check check (provider in ('stripe', 'solana'));
-- A Solana reference key or Stripe session can only ever fulfil one payment.
create unique index payments_reference_once on payments ((crypto ->> 'reference')) where crypto is not null;

