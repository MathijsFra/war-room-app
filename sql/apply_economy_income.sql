-- Optional: atomic server-side application of Phase 1 Economy income.
--
-- Requires tables: games, nations, regions, world_territories, game_log
-- Assumes regions.id matches world_territories.code
--
-- Optional rule support (Collapsed territory depletion):
--   If you want collapsed-nation territory cards to always use reduced income,
--   add a nullable column world_territories.card_nation_key (text) storing the
--   printed nation color for that territory card.
--
-- SECURITY NOTE:
--   This function is written as SECURITY DEFINER so it can update nations + insert logs.
--   Review privileges before deploying.

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

  -- Compute income per nation based on controlled regions
  with collapsed as (
    select upper(replace(replace(n.nation_key,'_',' '),'  ',' ')) as nk
    from public.nations n
    where n.game_id = p_game_id
      and upper(coalesce(n.homeland_status,'')) = 'COLLAPSED'
  ),
  income as (
    select
      n.id as nation_id,
      n.nation_key,
      sum(
        case
          when upper(replace(replace(r.status,'_',' '),'  ',' ')) = 'EMBATTLED'
            then coalesce(t.embattled_oil,0)
          when t.card_nation_key is not null
            and upper(replace(replace(t.card_nation_key,'_',' '),'  ',' ')) in (select nk from collapsed)
            then coalesce(t.embattled_oil,0)
          else coalesce(t.oil,0)
        end
      ) as add_oil,
      sum(
        case
          when upper(replace(replace(r.status,'_',' '),'  ',' ')) = 'EMBATTLED'
            then coalesce(t.embattled_iron,0)
          when t.card_nation_key is not null
            and upper(replace(replace(t.card_nation_key,'_',' '),'  ',' ')) in (select nk from collapsed)
            then coalesce(t.embattled_iron,0)
          else coalesce(t.iron,0)
        end
      ) as add_iron,
      sum(
        case
          when upper(replace(replace(r.status,'_',' '),'  ',' ')) = 'EMBATTLED'
            then coalesce(t.embattled_osr,0)
          when t.card_nation_key is not null
            and upper(replace(replace(t.card_nation_key,'_',' '),'  ',' ')) in (select nk from collapsed)
            then coalesce(t.embattled_osr,0)
          else coalesce(t.osr,0)
        end
      ) as add_osr
    from public.nations n
    left join public.regions r
      on r.controller_nation_id = n.id
    left join public.world_territories t
      on t.code = r.id
    where n.game_id = p_game_id
    group by n.id, n.nation_key
  )
  update public.nations n
  set
    oil = n.oil + case when upper(n.nation_key) = 'CHINA' then 0 else coalesce(i.add_oil,0) end,
    iron = n.iron + coalesce(i.add_iron,0),
    osr = n.osr + coalesce(i.add_osr,0)
  from income i
  where n.id = i.nation_id
    and n.game_id = p_game_id;

  insert into public.game_log (game_id, created_by, event_type, message, payload)
  values (
    p_game_id,
    auth.uid(),
    'ECONOMY_APPLIED',
    'Economy applied for round ' || p_round,
    jsonb_build_object('round', p_round)
  );
end;
$$;

-- Recommended: lock down execute
-- revoke all on function public.apply_economy_income(uuid, integer) from public;
-- grant execute on function public.apply_economy_income(uuid, integer) to authenticated;
