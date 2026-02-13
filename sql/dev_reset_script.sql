-- DEV RESET ONLY
truncate table 
  game_unit_stacks,
  turn_order,
  bids,
  orders,
  nation_phase_state,
  player_nations,
  players,
  game_log,
  games
restart identity cascade;
