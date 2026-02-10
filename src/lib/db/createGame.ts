import { supabase } from "@/lib/supabase/client";

/**
 * Creates a new game and registers the current user as the host player.
 * Returns the created game id.
 *
 * Important: We generate the UUID client-side to avoid needing
 * .select() on the insert, because SELECT is blocked until the
 * player row exists (RLS).
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

  // Generate UUID on the client so we don't need INSERT ... RETURNING via SELECT
  const gameId = crypto.randomUUID();

  // 1) Create game (no .select())
  const { error: gameErr } = await supabase.from("games").insert({
    id: gameId,
    name: params.name.trim(),
    scenario: params.scenario,
    status: "LOBBY",
    phase: "ECONOMY",
    round: 1,
  });

  if (gameErr) throw new Error(gameErr.message);

  // 2) Create host player row
  const { error: playerErr } = await supabase.from("players").insert({
    game_id: gameId,
    user_id: userId,
    display_name: params.displayName.trim(),
    is_host: true,
  });

  if (playerErr) throw new Error(playerErr.message);

  return gameId;
}
