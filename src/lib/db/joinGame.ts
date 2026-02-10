import { supabase } from "@/lib/supabase/client";

export async function joinGame(params: { gameId: string; displayName: string }) {
  const gameId = params.gameId.trim();
  if (!gameId) throw new Error("Game ID is required");

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw new Error(authErr.message);
  if (!authData.user) throw new Error("Not authenticated");

  const userId = authData.user.id;

  const payload = {
    game_id: gameId,
    user_id: userId,
    display_name: params.displayName.trim(),
    is_host: false,
  };

  const { error } = await supabase
    .from("players")
    .insert(payload, { returning: "minimal" as any });

  if (error) {
    // 23505 = unique_violation (already joined). Treat as success.
    if ((error as any).code === "23505") return gameId;

    throw new Error(error.message);
  }

  return gameId;
}
