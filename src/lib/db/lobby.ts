import { supabase } from "@/lib/supabase/client";

export type GameStatus = "LOBBY" | "ACTIVE" | "FINISHED";
export type GamePhase =
  | "ECONOMY"
  | "PLANNING"
  | "MOVEMENT"
  | "COMBAT"
  | "REFIT_DEPLOY"
  | "MORALE"
  | "PRODUCTION";

export type LobbyGame = {
  id: string;
  scenario: string;
  max_players: number;
  status: GameStatus;
  round: number | null;
  phase: GamePhase | null;
  started_at: string | null;
};

export type LobbyPlayer = {
  id: string;
  game_id: string;
  user_id: string;
  display_name: string;
  is_host: boolean;
  current_nation: string | null;
};

export type LobbyState = {
  game: LobbyGame;
  players: LobbyPlayer[];
  nationsByPlayerId: Record<string, string[]>;
  assignedNations: string[];
  // Current round+phase readiness per nation (DRAFT/COMMITTED/LOCKED). Keyed by nation_key.
  nationPhaseStatusByNation: Record<string, string | null>;
  meUserId: string;
  isHost: boolean;
};

export async function fetchLobby(gameId: string): Promise<LobbyState> {
  const {
    data: { session },
    error: sessErr,
  } = await supabase.auth.getSession();

  if (sessErr) throw new Error(sessErr.message);
  if (!session?.user?.id) throw new Error("Not authenticated");

  const meUserId = session.user.id;

  const { data: game, error: gameErr } = await supabase
    .from("games")
    .select("id, scenario, max_players, status, round, phase, started_at")
    .eq("id", gameId)
    .single();

  if (gameErr) throw new Error(gameErr.message);
  if (!game) throw new Error("Game not found");

  const { data: players, error: playersErr } = await supabase
    .from("players")
    .select("id, game_id, user_id, display_name, is_host, current_nation")
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });

  if (playersErr) throw new Error(playersErr.message);

  const { data: pnRows, error: pnErr } = await supabase
    .from("player_nations")
    .select("player_id, nation")
    .eq("game_id", gameId);

  if (pnErr) throw new Error(pnErr.message);

  const nationsByPlayerId: Record<string, string[]> = {};
  const assignedNations: string[] = [];

  for (const row of pnRows ?? []) {
    if (!nationsByPlayerId[row.player_id]) nationsByPlayerId[row.player_id] = [];
    nationsByPlayerId[row.player_id].push(row.nation);
    assignedNations.push(row.nation);
  }

  const mePlayer = (players ?? []).find((p) => p.user_id === meUserId) ?? null;
  const isHost = !!mePlayer?.is_host;

  // Nation readiness for the CURRENT round+phase
  // (used to drive strict "commit before advance" behavior)
  const nationPhaseStatusByNation: Record<string, string | null> = {};
  try {
    const { data: nations, error: nationsErr } = await supabase
      .from("nations")
      .select("id, nation_key")
      .eq("game_id", gameId);

    if (nationsErr) throw nationsErr;

    const nationIds = (nations ?? []).map((n) => n.id);

    if (nationIds.length > 0 && game?.round && game?.phase) {
      const { data: states, error: statesErr } = await supabase
        .from("nation_phase_state")
        .select("nation_id, status")
        .eq("game_id", gameId)
        .eq("round", game.round)
        .eq("phase", game.phase);

      if (statesErr) throw statesErr;

      const statusByNationId = new Map<string, string>();
      for (const s of states ?? []) {
        statusByNationId.set(s.nation_id, s.status);
      }

      for (const n of nations ?? []) {
        nationPhaseStatusByNation[n.nation_key] = statusByNationId.get(n.id) ?? "DRAFT";
      }
    }
  } catch {
    // If RLS blocks these tables early, we don't break the lobby.
    // Strict enforcement still happens inside DB functions.
  }

  return {
    game: game as LobbyGame,
    players: (players ?? []) as LobbyPlayer[],
    nationsByPlayerId,
    assignedNations,
    nationPhaseStatusByNation,
    meUserId,
    isHost,
  };
}

export async function assignNation(args: {
  gameId: string;
  playerId: string;
  nation: string;
}) {
  const { error } = await supabase.from("player_nations").insert({
    game_id: args.gameId,
    player_id: args.playerId,
    nation: args.nation,
  });

  if (error) throw new Error(error.message);
}

export async function setMaxPlayers(gameId: string, maxPlayers: number) {
  const { error } = await supabase
    .from("games")
    .update({ max_players: maxPlayers })
    .eq("id", gameId);

  if (error) throw new Error(error.message);
}

export async function startGame(gameId: string) {
  const { error } = await supabase
    .from("games")
    .update({
      status: "ACTIVE",
      started_at: new Date().toISOString(),
      round: 1,
      phase: "ECONOMY",
    })
    .eq("id", gameId);

  if (error) throw new Error(error.message);
}

export async function advancePhase(gameId: string) {
  // SQL function signature: public.advance_phase(p_game_id uuid)
  const { error } = await supabase.rpc("advance_phase", { p_game_id: gameId });
  if (error) throw new Error(error.message);
}

export async function setCurrentNation(gameId: string, playerId: string, nation: string) {
  const { error } = await supabase
    .from("players")
    .update({ current_nation: nation })
    .eq("id", playerId)
    .eq("game_id", gameId);

  if (error) throw new Error(error.message);
}

export async function commitCurrentPhase(gameId: string, nationKey: string) {
  const { error } = await supabase.rpc("commit_current_phase", {
    p_game_id: gameId,
    p_nation_key: nationKey,
  });
  if (error) throw new Error(error.message);
}

export async function uncommitCurrentPhase(gameId: string, nationKey: string) {
  const { error } = await supabase.rpc("uncommit_current_phase", {
    p_game_id: gameId,
    p_nation_key: nationKey,
  });
  if (error) throw new Error(error.message);
}
