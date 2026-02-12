-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.bids (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  nation_id uuid NOT NULL,
  oil_spent integer NOT NULL DEFAULT 0 CHECK (oil_spent >= 0),
  revealed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bids_pkey PRIMARY KEY (id),
  CONSTRAINT bids_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id),
  CONSTRAINT bids_nation_id_fkey FOREIGN KEY (nation_id) REFERENCES public.nations(id)
);
CREATE TABLE public.commands (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nation_id uuid NOT NULL,
  command_type text NOT NULL CHECK (command_type = ANY (ARRAY['land'::text, 'air'::text, 'naval'::text])),
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT commands_pkey PRIMARY KEY (id),
  CONSTRAINT commands_nation_id_fkey FOREIGN KEY (nation_id) REFERENCES public.nations(id)
);
CREATE TABLE public.game_log (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  game_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  visibility text NOT NULL DEFAULT 'PUBLIC'::text,
  nation text,
  event_type text NOT NULL,
  message text,
  payload jsonb,
  CONSTRAINT game_log_pkey PRIMARY KEY (id),
  CONSTRAINT game_log_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id)
);
CREATE TABLE public.games (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scenario text NOT NULL,
  round integer NOT NULL DEFAULT 1,
  phase USER-DEFINED NOT NULL DEFAULT 'ECONOMY'::game_phase,
  status USER-DEFINED NOT NULL DEFAULT 'LOBBY'::game_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  max_players integer NOT NULL DEFAULT 6,
  started_at timestamp with time zone,
  CONSTRAINT games_pkey PRIMARY KEY (id)
);
CREATE TABLE public.nation_phase_state (
  game_id uuid NOT NULL,
  nation_id uuid NOT NULL,
  round integer NOT NULL CHECK (round >= 1),
  phase USER-DEFINED NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'DRAFT'::nation_phase_status,
  committed_at timestamp with time zone,
  committed_by_player_id uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT nation_phase_state_pkey PRIMARY KEY (game_id, nation_id, round, phase),
  CONSTRAINT nation_phase_state_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id),
  CONSTRAINT nation_phase_state_nation_id_fkey FOREIGN KEY (nation_id) REFERENCES public.nations(id),
  CONSTRAINT nation_phase_state_committed_by_player_id_fkey FOREIGN KEY (committed_by_player_id) REFERENCES public.players(id)
);
CREATE TABLE public.nations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  nation_key text NOT NULL,
  player_id uuid,
  stress integer NOT NULL DEFAULT 0,
  homeland_status text,
  oil integer NOT NULL DEFAULT 0,
  iron integer NOT NULL DEFAULT 0,
  osr integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT nations_pkey PRIMARY KEY (id),
  CONSTRAINT nations_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id),
  CONSTRAINT nations_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  nation_id uuid NOT NULL,
  round integer NOT NULL,
  slot integer NOT NULL CHECK (slot >= 1 AND slot <= 9),
  command_id uuid,
  origin_region text,
  target_region text,
  status USER-DEFINED NOT NULL DEFAULT 'DRAFT'::order_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id),
  CONSTRAINT orders_nation_id_fkey FOREIGN KEY (nation_id) REFERENCES public.nations(id),
  CONSTRAINT orders_command_id_fkey FOREIGN KEY (command_id) REFERENCES public.commands(id)
);
CREATE TABLE public.planning_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  nation text NOT NULL,
  author_user_id uuid NOT NULL,
  title text,
  body text NOT NULL,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT planning_notes_pkey PRIMARY KEY (id),
  CONSTRAINT planning_notes_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id)
);
CREATE TABLE public.player_nations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  player_id uuid NOT NULL,
  nation text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT player_nations_pkey PRIMARY KEY (id),
  CONSTRAINT player_nations_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id),
  CONSTRAINT player_nations_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.player_ready (
  player_id uuid NOT NULL,
  game_id uuid NOT NULL,
  phase USER-DEFINED NOT NULL,
  is_ready boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT player_ready_pkey PRIMARY KEY (player_id, game_id, phase),
  CONSTRAINT player_ready_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
  CONSTRAINT player_ready_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id)
);
CREATE TABLE public.players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  is_host boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  nation text,
  current_nation text CHECK (current_nation IS NULL OR (current_nation = ANY (ARRAY['CHINA'::text, 'BRITISH COMMONWEALTH'::text, 'SOVIET UNION'::text, 'UNITED STATES'::text, 'GERMANY'::text, 'ITALY'::text, 'IMPERIAL JAPAN'::text]))),
  CONSTRAINT players_pkey PRIMARY KEY (id),
  CONSTRAINT players_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id)
);
CREATE TABLE public.regions (
  id text NOT NULL,
  name text NOT NULL,
  controller_nation_id uuid,
  status USER-DEFINED NOT NULL DEFAULT 'ACTIVE'::region_status,
  CONSTRAINT regions_pkey PRIMARY KEY (id),
  CONSTRAINT regions_controller_nation_id_fkey FOREIGN KEY (controller_nation_id) REFERENCES public.nations(id)
);
CREATE TABLE public.stg_world_starting_commands_units_csv (
  Nation text,
  TERRITORY_ID text,
  Command_Type text,
  Command text,
  Unit_Type text,
  Quantity integer
);
CREATE TABLE public.stg_world_starting_units_csv (
  nation_key text,
  territory_code text,
  unit_type text,
  unit_count integer,
  scenario text
);
CREATE TABLE public.stg_world_territories_csv (
  Nation text,
  TERRITORY_ID text,
  Territory text,
  CapitalType text,
  Industry text,
  SV integer,
  Oil integer,
  Iron integer,
  OSR integer,
  Embattled_Oil integer,
  Embattled_Iron integer,
  Embattled_OSR integer,
  STANCE text,
  TRADE_TYPE text
);
CREATE TABLE public.turn_order (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  round integer NOT NULL,
  nation_id uuid,
  position integer CHECK ("position" >= 1 AND "position" <= 7),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT turn_order_pkey PRIMARY KEY (id),
  CONSTRAINT turn_order_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id),
  CONSTRAINT turn_order_nation_id_fkey FOREIGN KEY (nation_id) REFERENCES public.nations(id)
);
CREATE TABLE public.turns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  round integer NOT NULL,
  phase text NOT NULL,
  nation text,
  started_by uuid NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT turns_pkey PRIMARY KEY (id),
  CONSTRAINT turns_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id)
);
CREATE TABLE public.world_starting_territory_control (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  scenario text NOT NULL DEFAULT 'WORLD'::text,
  territory_code text NOT NULL,
  controller_nation_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT world_starting_territory_control_pkey PRIMARY KEY (id),
  CONSTRAINT wstc_territory_fk FOREIGN KEY (territory_code) REFERENCES public.world_territories(code)
);
CREATE TABLE public.world_starting_units (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  scenario text NOT NULL DEFAULT 'WORLD'::text,
  nation_key text NOT NULL,
  territory_code text NOT NULL,
  unit_type text NOT NULL,
  unit_count integer NOT NULL CHECK (unit_count >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  command_type text,
  command_name text,
  CONSTRAINT world_starting_units_pkey PRIMARY KEY (id),
  CONSTRAINT wsu_territory_fk FOREIGN KEY (territory_code) REFERENCES public.world_territories(code)
);
CREATE TABLE public.world_territories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  ttype USER-DEFINED NOT NULL,
  x numeric,
  y numeric,
  capital USER-DEFINED NOT NULL DEFAULT 'NONE'::capital_type,
  capital_of_nation_key text,
  industry USER-DEFINED NOT NULL DEFAULT 'NONE'::industry_type,
  stance USER-DEFINED NOT NULL DEFAULT 'NEUTRAL'::stance_type,
  trade_type USER-DEFINED NOT NULL DEFAULT 'NONE'::trade_type,
  strategic_value integer NOT NULL DEFAULT 0,
  oil integer NOT NULL DEFAULT 0,
  iron integer NOT NULL DEFAULT 0,
  osr integer NOT NULL DEFAULT 0,
  embattled_oil integer NOT NULL DEFAULT 0,
  embattled_iron integer NOT NULL DEFAULT 0,
  embattled_osr integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT world_territories_pkey PRIMARY KEY (id)
);