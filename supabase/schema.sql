create extension if not exists pgcrypto;

create table if not exists public.players (
  tag text primary key,
  name text not null,
  trophies integer,
  highest_trophies integer,
  exp_level integer,
  raw jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  player_tag text not null references public.players(tag) on delete cascade,
  stable_battle_id text,
  battle_time timestamptz not null,
  mode text not null,
  map text not null,
  battle_type text,
  result text not null,
  duration integer,
  trophy_change integer,
  star_player_tag text,
  player_brawler_id integer,
  player_brawler_name text not null,
  player_power_level integer,
  target_team_index integer,
  team_average_power numeric(6, 2),
  enemy_average_power numeric(6, 2),
  team_average_trophies numeric(8, 2),
  enemy_average_trophies numeric(8, 2),
  adjusted_difficulty_score numeric(6, 2),
  enemy_comp_archetype text,
  teams_hash text not null,
  dedupe_key text not null unique,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.battle_participants (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  player_tag text not null,
  name text not null,
  brawler_id integer,
  brawler_name text not null,
  brawler_power integer,
  brawler_trophies integer,
  side text not null check (side in ('ally', 'enemy', 'solo')),
  relationship text not null default 'opponent' check (relationship in ('target_player', 'teammate', 'opponent')),
  team_index integer,
  is_player boolean not null default false,
  is_star_player boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.battles
  add column if not exists stable_battle_id text,
  add column if not exists battle_type text,
  add column if not exists target_team_index integer,
  add column if not exists team_average_power numeric(6, 2),
  add column if not exists enemy_average_power numeric(6, 2),
  add column if not exists team_average_trophies numeric(8, 2),
  add column if not exists enemy_average_trophies numeric(8, 2),
  add column if not exists adjusted_difficulty_score numeric(6, 2),
  add column if not exists enemy_comp_archetype text;

alter table public.battle_participants
  add column if not exists brawler_trophies integer,
  add column if not exists relationship text not null default 'opponent',
  add column if not exists team_index integer;

alter table public.battle_participants
  drop constraint if exists battle_participants_relationship_check,
  add constraint battle_participants_relationship_check
    check (relationship in ('target_player', 'teammate', 'opponent'));

create table if not exists public.brawler_snapshots (
  id uuid primary key default gen_random_uuid(),
  player_tag text not null references public.players(tag) on delete cascade,
  brawler_id integer not null,
  name text not null,
  power_level integer,
  trophies integer,
  highest_trophies integer,
  raw jsonb not null default '{}'::jsonb,
  snapshot_at timestamptz not null default now(),
  unique (player_tag, brawler_id)
);

create table if not exists public.manual_match_notes (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  player_tag text not null references public.players(tag) on delete cascade,
  tags text[] not null default '{}'::text[],
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (battle_id, player_tag)
);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  player_tag text not null references public.players(tag) on delete cascade,
  brawler_name text not null,
  score numeric(8, 3) not null,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  explanation text not null,
  rank integer not null,
  created_at timestamptz not null default now()
);

alter table public.recommendations
  drop constraint if exists recommendations_confidence_check;

update public.recommendations
set confidence = lower(confidence)
where confidence in ('Low', 'Medium', 'High');

alter table public.recommendations
  add constraint recommendations_confidence_check
    check (confidence in ('low', 'medium', 'high'));

create index if not exists players_last_synced_idx
  on public.players(last_synced_at desc);

create index if not exists battles_player_time_idx
  on public.battles(player_tag, battle_time desc);

create index if not exists battles_stable_battle_idx
  on public.battles(stable_battle_id);

create index if not exists battles_player_brawler_idx
  on public.battles(player_tag, player_brawler_name);

create index if not exists battles_player_mode_map_idx
  on public.battles(player_tag, mode, map);

create index if not exists battle_participants_battle_idx
  on public.battle_participants(battle_id);

create index if not exists battle_participants_player_idx
  on public.battle_participants(player_tag);

create index if not exists battle_participants_relationship_idx
  on public.battle_participants(relationship);

create index if not exists manual_match_notes_player_idx
  on public.manual_match_notes(player_tag);

create index if not exists recommendations_player_rank_idx
  on public.recommendations(player_tag, rank);

alter table public.players enable row level security;
alter table public.battles enable row level security;
alter table public.battle_participants enable row level security;
alter table public.brawler_snapshots enable row level security;
alter table public.manual_match_notes enable row level security;
alter table public.recommendations enable row level security;

comment on table public.battles is
  'Persisted official Brawl Stars battle log rows. Stable battle ID is battleTime + mode + map + sorted player tags/brawler IDs; dedupe key is player tag + stable battle ID.';

comment on column public.battle_participants.relationship is
  'Target-relative role derived from the official battlelog: target_player, teammate, or opponent.';

comment on column public.battles.adjusted_difficulty_score is
  'Inferred from available brawler power and trophy differences only; it is not a measure of lane matchup, kills, deaths, or damage.';

comment on column public.manual_match_notes.tags is
  'Manual coaching tags such as bad draft, carried, countered, felt controlled, tilted, teammates weak.';
