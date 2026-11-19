-- In My World — database setup (v2). Paste into Supabase → SQL Editor → Run.
-- Replaces the first setup. Safe to run on a fresh project; it drops the v1 tables (which are empty).
--
-- Each record is a JSON document (`data`) with indexed columns generated from
-- it, so the app's types map 1:1. Every update is compare-and-swap on
-- `version`. Only the server (service role) touches these tables: row level
-- security is on with no policies, so the public anon key can read nothing.

-- ---------- Remove v1 ----------
drop view if exists public_content, featured_characters, credit_balances cascade;
drop table if exists viewer_stats, wallet_nonces, wallets, payments, generated_videos, generation_jobs, scenes, stories, projects, character_assets, characters, credit_transactions, subscriptions, profiles cascade;
drop type if exists visual_style, project_status, visibility, plan_id, credit_kind, character_source, reuse_policy, wallet_chain, payment_status, story_format cascade;
drop function if exists touch_updated_at cascade;

-- ---------- Tables ----------
create table users (
  id text primary key, data jsonb not null, version int not null default 1, created_at timestamptz not null default now(),
  email text generated always as (lower(data->>'email')) stored
);
create unique index users_email on users (email) where email is not null;

create table profiles (
  id text primary key, data jsonb not null, version int not null default 1, created_at timestamptz not null default now(),
  handle text generated always as (data->>'handle') stored
);
create unique index profiles_handle on profiles (handle);

create table sessions (
  id text primary key, data jsonb not null, version int not null default 1, created_at timestamptz not null default now(),
  user_id text generated always as (data->>'userId') stored,
  expires_at text generated always as (data->>'expiresAt') stored
);
create index sessions_user on sessions (user_id);

create table subscriptions (
  id text primary key, data jsonb not null, version int not null default 1, created_at timestamptz not null default now(),
  provider text generated always as (data->>'provider') stored
);
create index subscriptions_provider on subscriptions (provider);

create table credits (
  id text primary key, data jsonb not null, version int not null default 1, created_at timestamptz not null default now(),
  user_id text generated always as (data->>'userId') stored,
  amount int generated always as ((data->>'amount')::int) stored,
  kind text generated always as (data->>'kind') stored,
  job_id text generated always as (data->>'jobId') stored,
  payment_id text generated always as (data->>'paymentId') stored,
  ts text generated always as (data->>'createdAt') stored
);
create index credits_user on credits (user_id, ts desc);
create unique index credits_refund_once on credits (job_id) where kind = 'refund_generation';
create unique index credits_purchase_once on credits (payment_id) where kind = 'purchase';

create table projects (
  id text primary key, data jsonb not null, version int not null default 1, created_at timestamptz not null default now(),
  user_id text generated always as (data->>'userId') stored,
  status text generated always as (data->>'status') stored,
  visibility text generated always as (data->>'visibility') stored,
  series_id text generated always as (data->>'seriesId') stored,
  ts text generated always as (data->>'createdAt') stored
);
create index projects_user on projects (user_id, ts desc);
create index projects_public on projects (visibility, status);
create index projects_series on projects (series_id);

create table stories (
  id text primary key, data jsonb not null, version int not null default 1, created_at timestamptz not null default now(),
  project_id text generated always as (data->>'projectId') stored
);
create unique index stories_project on stories (project_id);

create table jobs (
  id text primary key, data jsonb not null, version int not null default 1, created_at timestamptz not null default now(),
  user_id text generated always as (data->>'userId') stored,
  project_id text generated always as (data->>'projectId') stored,
  status text generated always as (data->>'status') stored,
  idempotency_key text generated always as (data->>'idempotencyKey') stored,
  ts text generated always as (data->>'createdAt') stored
);
create index jobs_user on jobs (user_id, ts desc);
create index jobs_status on jobs (status);
create unique index jobs_idempotency on jobs (user_id, idempotency_key) where idempotency_key is not null;

create table videos (
  id text primary key, data jsonb not null, version int not null default 1, created_at timestamptz not null default now(),
  project_id text generated always as (data->>'projectId') stored,
  media_key text generated always as (data->>'mediaKey') stored,
  thumb_key text generated always as (data->>'thumbKey') stored
);
create index videos_project on videos (project_id);
create index videos_media on videos (media_key);
create index videos_thumb on videos (thumb_key);

create table characters (
  id text primary key, data jsonb not null, version int not null default 1, created_at timestamptz not null default now(),
  owner_id text generated always as (data->>'ownerId') stored,
  visibility text generated always as (data->>'visibility') stored
);
create index characters_owner on characters (owner_id);
create index characters_public on characters (visibility);

create table payments (
  id text primary key, data jsonb not null, version int not null default 1, created_at timestamptz not null default now(),
  user_id text generated always as (data->>'userId') stored,
  provider_ref text generated always as (data->>'providerRef') stored,
  reference text generated always as (data->'crypto'->>'reference') stored,
  ts text generated always as (data->>'createdAt') stored
);
create index payments_user on payments (user_id, ts desc);
create unique index payments_ref_once on payments (provider_ref) where provider_ref is not null;
create unique index payments_reference_once on payments (reference) where reference is not null;

create table wallets (
  id text primary key, data jsonb not null, version int not null default 1, created_at timestamptz not null default now(),
  user_id text generated always as (data->>'userId') stored,
  chain text generated always as (data->>'chain') stored,
  address text generated always as (data->>'address') stored
);
create unique index wallets_address on wallets (chain, address);
create index wallets_user on wallets (user_id);

create table wallet_nonces (
  id text primary key, data jsonb not null, version int not null default 1, created_at timestamptz not null default now()
);

create table viewer_stats (
  id text primary key, data jsonb not null, version int not null default 1, created_at timestamptz not null default now(),
  target_id text generated always as (data->>'targetId') stored,
  viewer text generated always as (data->>'viewer') stored
);
create index viewer_stats_target on viewer_stats (target_id);
create index viewer_stats_viewer on viewer_stats (viewer);

create table sample_views (
  id text primary key, data jsonb not null, version int not null default 1, created_at timestamptz not null default now()
);

-- ---------- Credits: balance and overdraft guard ----------
create or replace function credit_balance(uid text) returns int language sql stable as $$
  select coalesce(sum(amount), 0)::int from credits where user_id = uid
$$;

-- Debits lock the user's ledger and refuse to take the balance below zero,
-- so two simultaneous requests can't both spend the same credits.
-- (Generated columns aren't filled in yet in a BEFORE trigger, so read the JSON.)
create or replace function guard_credits() returns trigger language plpgsql as $$
declare
  uid text := new.data->>'userId';
  amt int := (new.data->>'amount')::int;
begin
  if amt < 0 then
    perform pg_advisory_xact_lock(hashtext(uid));
    if (select coalesce(sum(amount), 0) from credits where user_id = uid) + amt < 0 then
      raise exception 'insufficient_credits';
    end if;
  end if;
  return new;
end $$;
create trigger credits_guard before insert on credits for each row execute function guard_credits();

-- Row level security on, no policies: only the service role can read or write.
do $$ declare t text; begin
  foreach t in array array['users','profiles','sessions','subscriptions','credits','projects','stories','jobs','videos','characters','payments','wallets','wallet_nonces','viewer_stats','sample_views'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

revoke execute on function credit_balance(text) from anon, authenticated;

-- ---------- Storage ----------
insert into storage.buckets (id, name, public) values
  ('videos', 'videos', false), ('thumbs', 'thumbs', false), ('previews', 'previews', false), ('audio', 'audio', false)
on conflict (id) do nothing;
