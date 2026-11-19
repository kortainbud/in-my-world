create table if not exists password_resets (
  id text primary key, data jsonb not null, version int not null default 1, created_at timestamptz not null default now(),
  user_id text generated always as (data->>'userId') stored
);
create index if not exists password_resets_user on password_resets (user_id, created_at desc);
alter table password_resets enable row level security;
