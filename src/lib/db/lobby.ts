import { supabase } from "@/lib/supabase/client";
import { seedGameUnits } from "@/lib/db/units";

export type GameStatus = "LOBBY" | "ACTIVE" | "FINISHED";
export type GamePhase =
  | "ECONOMY"
  | "PLANNING"
  | "STRATEGIC_PLANNING"
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
  // Current round+phase readiness per nation (DRAFT/COMMITTED/LOCKED). Keyed by normalized nation_key.
  nationPhaseStatusByNation: Record<string, string>;
  meUserId: string;
  isHost: boolean;
};

export function normalizeNationKey(n: string) {
  return n
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function extractNationId(raw: any): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && typeof raw.id === "string") return raw.id;
  return null;
}

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

  // ===== Nation Phase State (DB source of truth) =====
  const nationPhaseStatusByNation: Record<string, string> = {};

  const currentRound = game.round ?? 1;
  const currentPhase = (game.phase ?? "ECONOMY") as GamePhase;

  // Pull phase-state AND the nation_key via FK join
  const { data: states, error: statesErr } = await supabase
    .from("nation_phase_state")
    .select("status, nation:nations(nation_key)")
    .eq("game_id", gameId)
    .eq("round", currentRound)
    .eq("phase", currentPhase);

  if (statesErr) throw new Error(statesErr.message);

  for (const s of states ?? []) {
    const nationKeyRaw = (s as any).nation?.nation_key;
    if (!nationKeyRaw) {
      console.log("[DEBUG] Missing joined nation_key in row", s);
      continue;
    }
    const nk = normalizeNationKey(nationKeyRaw);
    nationPhaseStatusByNation[nk] = (s as any).status;
  }

  console.log("[DEBUG] nationPhaseStatusByNation AFTER MAP", nationPhaseStatusByNation);

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


export async function assignNation(args: { gameId: string; playerId: string; nation: string }) {
  const { error } = await supabase.from("player_nations").insert({
    game_id: args.gameId,
    player_id: args.playerId,
    nation: args.nation,
  });
  if (error) throw new Error(error.message);
}

export async function unassignNation(args: { id: string }) {
  const { error } = await supabase.from("player_nations").delete().eq("id", args.id);
  if (error) throw new Error(error.message);
}

export async function setMaxPlayers(gameId: string, maxPlayers: number) {
  const { error } = await supabase.from("games").update({ max_players: maxPlayers }).eq("id", gameId);
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

  // Seed marker pool + starting commands + starting unit stacks.
  // (Requires installing sql/seed_game_units.sql in Supabase.)
  await seedGameUnits(gameId);
}

export async function advancePhase(gameId: string) {
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
