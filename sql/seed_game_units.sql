-- War Room App (dev)
-- Command marker + command + unit seeding (rulebook-aligned)
--
-- One-time install in Supabase SQL editor.
-- Safe to re-run (CREATE IF NOT EXISTS / CREATE OR REPLACE).

-- 1) Reference markers (immutable): named command markers per nation and type.
create table if not exists public.world_command_markers (
  id uuid primary key default gen_random_uuid(),
  nation_key text not null,
  command_type text not null check (command_type in ('LAND','AIR','NAVAL')),
  command_name text not null,
  created_at timestamptz not null default now(),
  unique (nation_key, command_type, command_name)
);

-- 2) Per-game marker pool (mutable): tracks which markers are in use.
create table if not exists public.game_command_markers (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  nation_id uuid not null references public.nations(id) on delete cascade,
  command_type text not null check (command_type in ('LAND','AIR','NAVAL')),
  command_name text not null,
  is_in_use boolean not null default false,
  created_at timestamptz not null default now(),
  unique (game_id, nation_id, command_type, command_name)
);
create index if not exists idx_game_command_markers_game_nation_type
  on public.game_command_markers (game_id, nation_id, command_type);

-- 3) Operational commands (mutable): always backed by a marker.
create table if not exists public.game_commands (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  nation_id uuid not null references public.nations(id) on delete cascade,
  marker_id uuid not null references public.game_command_markers(id) on delete restrict,
  command_type text not null check (command_type in ('LAND','AIR','NAVAL')),
  command_name text not null,
  created_at timestamptz not null default now(),
  unique (game_id, nation_id, command_type, command_name)
);
create index if not exists idx_game_commands_game_nation_type
  on public.game_commands (game_id, nation_id, command_type);

-- 4) Unit stacks on the board (mutable): per game, per command, per territory.
create table if not exists public.game_unit_stacks (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  nation_id uuid not null references public.nations(id) on delete cascade,
  command_id uuid not null references public.game_commands(id) on delete cascade,
  territory_code text not null,
  unit_type text not null,
  unit_count int not null check (unit_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Avoid duplicate inserts when seeding or later reorg.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'game_unit_stacks_unique_stack'
  ) then
    alter table public.game_unit_stacks
      add constraint game_unit_stacks_unique_stack unique (game_id, command_id, territory_code, unit_type);
  end if;
end$$;
create index if not exists idx_game_unit_stacks_game_nation
  on public.game_unit_stacks (game_id, nation_id);
create index if not exists idx_game_unit_stacks_game_command
  on public.game_unit_stacks (game_id, command_id);

-- RLS (minimal, dev-friendly): allow authenticated read.
alter table public.game_command_markers enable row level security;
alter table public.game_commands enable row level security;
alter table public.game_unit_stacks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='game_command_markers' and policyname='game_command_markers_select_auth'
  ) then
    create policy game_command_markers_select_auth on public.game_command_markers
      for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='game_commands' and policyname='game_commands_select_auth'
  ) then
    create policy game_commands_select_auth on public.game_commands
      for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='game_unit_stacks' and policyname='game_unit_stacks_select_auth'
  ) then
    create policy game_unit_stacks_select_auth on public.game_unit_stacks
      for select to authenticated using (true);
  end if;
end$$;

-- 5) Seed function: create marker pool and starting commands+stacks from world_starting_units.
--    Idempotent: safe to call multiple times; it will not duplicate.
create or replace function public.seed_game_units(p_game_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_scenario text;
begin
  select scenario into v_scenario from public.games where id = p_game_id;

  -- Create per-game marker pool for every nation in this game.
  -- Prefer world_command_markers (full marker list). If empty for a nation,
  -- fall back to distinct starting command names from world_starting_units.
  insert into public.game_command_markers (game_id, nation_id, command_type, command_name, is_in_use)
  select p_game_id, n.id,
         upper(wcm.command_type) as command_type,
         wcm.command_name,
         false
  from public.nations n
  join public.world_command_markers wcm
    on wcm.nation_key = n.nation_key
  where n.game_id = p_game_id
  on conflict do nothing;

  -- Fallback markers from world_starting_units where no world markers exist for that nation.
  insert into public.game_command_markers (game_id, nation_id, command_type, command_name, is_in_use)
  select p_game_id, n.id,
         upper(wsu.command_type) as command_type,
         wsu.command_name,
         false
  from public.nations n
  join (
    select distinct nation_key, upper(command_type) as command_type, command_name
    from public.world_starting_units
    where scenario = 'WORLD' or scenario = v_scenario
  ) wsu
    on wsu.nation_key = n.nation_key
  where n.game_id = p_game_id
    and not exists (
      select 1 from public.world_command_markers wcm
      where wcm.nation_key = n.nation_key
    )
  on conflict do nothing;

  -- Mark markers used by starting deployment + create corresponding game_commands.
  with needed as (
    select distinct n.id as nation_id,
      upper(wsu.command_type) as command_type,
      wsu.command_name
    from public.nations n
    join public.world_starting_units wsu
      on wsu.nation_key = n.nation_key
    where n.game_id = p_game_id
      and (wsu.scenario = 'WORLD' or wsu.scenario = v_scenario)
  ), marker_pick as (
    select gcm.id as marker_id, gcm.game_id, gcm.nation_id, gcm.command_type, gcm.command_name
    from public.game_command_markers gcm
    join needed k
      on k.nation_id = gcm.nation_id
     and k.command_type = gcm.command_type
     and k.command_name = gcm.command_name
    where gcm.game_id = p_game_id
  )
  insert into public.game_commands (game_id, nation_id, marker_id, command_type, command_name)
  select p_game_id, mp.nation_id, mp.marker_id, mp.command_type, mp.command_name
  from marker_pick mp
  on conflict do nothing;

  update public.game_command_markers gcm
  set is_in_use = true
  where gcm.game_id = p_game_id
    and exists (
      select 1 from public.game_commands gc
      where gc.game_id = p_game_id
        and gc.marker_id = gcm.id
    );

  -- Seed unit stacks (aggregate by territory+unit type+command)
  insert into public.game_unit_stacks (game_id, nation_id, command_id, territory_code, unit_type, unit_count)
  select p_game_id,
         n.id as nation_id,
         gc.id as command_id,
         wsu.territory_code,
         wsu.unit_type,
         sum(wsu.unit_count)::int as unit_count
  from public.nations n
  join public.world_starting_units wsu
    on wsu.nation_key = n.nation_key
  join public.game_commands gc
    on gc.game_id = p_game_id
   and gc.nation_id = n.id
   and gc.command_type = upper(wsu.command_type)
   and gc.command_name = wsu.command_name
  where n.game_id = p_game_id
    and (wsu.scenario = 'WORLD' or wsu.scenario = v_scenario)
  group by n.id, gc.id, wsu.territory_code, wsu.unit_type
  on conflict do nothing;
end;
$$;

revoke all on function public.seed_game_units(uuid) from public;
grant execute on function public.seed_game_units(uuid) to authenticated;
