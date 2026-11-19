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
