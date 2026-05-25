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
  battle_time timestamptz not null,
  mode text not null,
  map text not null,
  result text not null,
  duration integer,
  trophy_change integer,
  star_player_tag text,
  player_brawler_id integer,
  player_brawler_name text not null,
  player_power_level integer,
  teams_hash text not null,
  dedupe_key text not null unique,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.battle_players (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  player_tag text not null,
  name text not null,
  brawler_id integer,
  brawler_name text not null,
  brawler_power integer,
  side text not null check (side in ('ally', 'enemy', 'solo')),
  is_player boolean not null default false,
  is_star_player boolean not null default false,
  created_at timestamptz not null default now()
);

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
  confidence text not null check (confidence in ('Low', 'Medium', 'High')),
  explanation text not null,
  rank integer not null,
  created_at timestamptz not null default now()
);

create index if not exists players_last_synced_idx
  on public.players(last_synced_at desc);

create index if not exists battles_player_time_idx
  on public.battles(player_tag, battle_time desc);

create index if not exists battles_player_brawler_idx
  on public.battles(player_tag, player_brawler_name);

create index if not exists battles_player_mode_map_idx
  on public.battles(player_tag, mode, map);

create index if not exists battle_players_battle_idx
  on public.battle_players(battle_id);

create index if not exists battle_players_player_idx
  on public.battle_players(player_tag);

create index if not exists manual_match_notes_player_idx
  on public.manual_match_notes(player_tag);

create index if not exists recommendations_player_rank_idx
  on public.recommendations(player_tag, rank);

alter table public.players enable row level security;
alter table public.battles enable row level security;
alter table public.battle_players enable row level security;
alter table public.brawler_snapshots enable row level security;
alter table public.manual_match_notes enable row level security;
alter table public.recommendations enable row level security;

comment on table public.battles is
  'Persisted official Brawl Stars battle log rows. Dedupe key is player tag + battleTime + mode + map + normalized teams.';

comment on column public.manual_match_notes.tags is
  'Manual coaching tags such as bad draft, carried, countered, felt controlled, tilted, teammates weak.';
