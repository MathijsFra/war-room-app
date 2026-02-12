-- Atomic server-side application of Phase 1 Economy income.
-- Supports control from regions.controller_nation_id (if it references this game's nations)
-- or from world_starting_territory_control (seed fallback).

create or replace function public.apply_economy_income(
  p_game_id uuid,
  p_round integer
)
returns void
language plpgsql
security definer
as $$
declare
  v_already boolean;
  v_use_regions boolean;
  v_scenario text;
begin
  -- Prevent double-apply for a round
  select exists (
    select 1
    from public.game_log gl
    where gl.game_id = p_game_id
      and gl.event_type = 'ECONOMY_APPLIED'
      and (gl.payload->>'round')::int = p_round
    limit 1
  ) into v_already;

  if v_already then
    return;
  end if;

  -- If regions.control references this game's nations, use regions as truth.
  select exists (
    select 1
    from public.regions r
    join public.nations n on n.id = r.controller_nation_id
    where n.game_id = p_game_id
    limit 1
  ) into v_use_regions;

  -- Choose a seed scenario to fall back to (case-insensitive match on game scenario, else any).
  select coalesce(
    (
      select wstc.scenario
      from public.world_starting_territory_control wstc
      join public.games g on g.id = p_game_id
      where lower(wstc.scenario) = lower(g.scenario)
      limit 1
    ),
    (select wstc.scenario from public.world_starting_territory_control wstc limit 1)
  ) into v_scenario;

  with nations_game as (
    select id, nation_key
    from public.nations
    where game_id = p_game_id
  ),
  income_from_regions as (
    select
      n.id as nation_id,
      n.nation_key,
      sum(
        case
          when upper(replace(replace(r.status::text,'_',' '),'  ',' ')) = 'EMBATTLED'
            then coalesce(t.embattled_oil,0)
          else coalesce(t.oil,0)
        end
      ) as add_oil,
      sum(
        case
          when upper(replace(replace(r.status::text,'_',' '),'_',' ')) = 'EMBATTLED'
            then coalesce(t.embattled_iron,0)
          else coalesce(t.iron,0)
        end
      ) as add_iron,
      sum(
        case
          when upper(replace(replace(r.status::text,'_',' '),'_',' ')) = 'EMBATTLED'
            then coalesce(t.embattled_osr,0)
          else coalesce(t.osr,0)
        end
      ) as add_osr
    from nations_game n
    join public.regions r on r.controller_nation_id = n.id
    left join public.world_territories t on t.code = r.id
    where v_use_regions
    group by n.id, n.nation_key
  ),
  income_from_seed as (
    select
      n.id as nation_id,
      n.nation_key,
      sum(coalesce(t.oil,0)) as add_oil,
      sum(coalesce(t.iron,0)) as add_iron,
      sum(coalesce(t.osr,0)) as add_osr
    from nations_game n
    join public.world_starting_territory_control wstc
      on wstc.scenario = v_scenario
     and upper(trim(wstc.controller_nation_key)) = upper(trim(n.nation_key))
    left join public.world_territories t
      on t.code = wstc.territory_code
    where not v_use_regions
    group by n.id, n.nation_key
  ),
  income as (
    select * from income_from_regions
    union all
    select * from income_from_seed
  )
  update public.nations n
  set
    oil  = n.oil  + case when upper(n.nation_key) = 'CHINA' then 0 else coalesce(i.add_oil,0) end,
    iron = n.iron + coalesce(i.add_iron,0),
    osr  = n.osr  + coalesce(i.add_osr,0)
  from income i
  where n.id = i.nation_id
    and n.game_id = p_game_id;

  insert into public.game_log (game_id, created_by, event_type, message, payload)
  values (
    p_game_id,
    auth.uid(),
    'ECONOMY_APPLIED',
    'Economy applied for round ' || p_round,
    jsonb_build_object('round', p_round, 'source', case when v_use_regions then 'regions' else 'seed' end, 'scenario', v_scenario)
  );
end;
$$;

revoke all on function public.apply_economy_income(uuid, integer) from public;
grant execute on function public.apply_economy_income(uuid, integer) to authenticated;
