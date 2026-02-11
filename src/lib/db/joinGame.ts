import { supabase } from "@/lib/supabase/client";

type JoinGameResult =
  | { ok: true; player_id: string; game_id: string }
  | { ok: false; reason: string; current?: number; max?: number; status?: string };

export async function joinGame(params: { gameId: string; displayName: string }) {
  const gameId = params.gameId.trim();
  if (!gameId) throw new Error("Game ID is required");

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error("Not authenticated");

  const { data, error } = await supabase.rpc("join_game", {
    gid: gameId,
    display_name: params.displayName,
  });

  if (error) throw new Error(error.message);

  const res = data as JoinGameResult;
  if (!res.ok) {
    if (res.reason === "GAME_FULL") throw new Error("Game is full.");
    if (res.reason === "GAME_ALREADY_STARTED") throw new Error("Game already started.");
    if (res.reason === "GAME_NOT_FOUND") throw new Error("Game not found.");
    if (res.reason === "NOT_AUTHENTICATED") throw new Error("Not authenticated.");
    throw new Error(`Unable to join (${res.reason})`);
  }

  return res.game_id;
}
