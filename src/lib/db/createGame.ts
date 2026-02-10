import { supabase } from "@/lib/supabase/client";

/**
 * Creates a new game and registers the current user as the host player.
 * Returns the created game id.
 */
export async function createGame(params: {
  name: string;
  scenario: string;
  displayName: string;
}) {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw new Error(authErr.message);
  if (!authData.user) throw new Error("Not authenticated");

  const userId = authData.user.id;

  // 1) Create game
  const { data: gameRow, error: gameErr } = await supabase
    .from("games")
    .insert({
      name: params.name.trim(),
      scenario: params.scenario,
      status: "LOBBY",
      phase: "ECONOMY",
      round: 1,
    })
    .select("id")
    .single();

  if (gameErr) throw new Error(gameErr.message);

  // 2) Create host player row
  const { error: playerErr } = await supabase.from("players").insert({
    game_id: gameRow.id,
    user_id: userId,
    display_name: params.displayName.trim(),
    is_host: true,
  });

  if (playerErr) throw new Error(playerErr.message);

  return gameRow.id as string;
}
