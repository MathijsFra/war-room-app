import { supabase } from "@/lib/supabase/client";

/**
 * Join an existing game as the current user.
 * Uses upsert for idempotency, and avoids returning a row.
 */
export async function joinGame(params: { gameId: string; displayName: string }) {
  const gameId = params.gameId.trim();
  if (!gameId) throw new Error("Game ID is required");

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw new Error(authErr.message);
  if (!authData.user) throw new Error("Not authenticated");

  const userId = authData.user.id;

  const { error } = await supabase.from("players").upsert(
    {
      game_id: gameId,
      user_id: userId,
      display_name: params.displayName.trim(),
      is_host: false,
    },
    {
      onConflict: "game_id,user_id",
      // avoid returning representation (prevents SELECT/RLS edge cases)
      returning: "minimal" as any,
    }
  );

  if (error) throw new Error(error.message);

  return gameId;
}
