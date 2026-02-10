import { supabase } from "@/lib/supabase/client";

export type LobbyGame = {
  id: string;
  name: string | null;
  scenario: string | null;
  status: string | null;
  phase: string | null;
  round: number | null;
};

export type LobbyPlayer = {
  id: string;
  game_id: string;
  user_id: string;
  display_name: string;
  is_host: boolean;
  nation: string | null;
};

export async function fetchLobby(gameId: string) {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw new Error(authErr.message);
  if (!authData.user) throw new Error("Not authenticated");

  const me = authData.user;

  const { data: game, error: gameErr } = await supabase
    .from("games")
    .select("id,name,scenario,status,phase,round")
    .eq("id", gameId)
    .single();

  if (gameErr) throw new Error(gameErr.message);

  const { data: players, error: playersErr } = await supabase
    .from("players")
    .select("id,game_id,user_id,display_name,is_host,nation")
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });

  if (playersErr) throw new Error(playersErr.message);

  const myPlayer = (players as any[]).find((p) => p.user_id === me.id);

  return {
    meUserId: me.id,
    isHost: !!myPlayer?.is_host,
    game: game as LobbyGame,
    players: players as LobbyPlayer[],
  };
}

export async function setPlayerNation(params: {
  playerId: string;
  nation: string | null;
}) {
  const { error } = await supabase
    .from("players")
    .update({ nation: params.nation })
    .eq("id", params.playerId);

  if (error) throw new Error(error.message);
}
