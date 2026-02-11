import { supabase } from "@/lib/supabase/client";

export type NationPhaseStatus = "DRAFT" | "COMMITTED" | "LOCKED";

export async function getMyPlayerRow(gameId: string) {
  const me = await supabase.auth.getUser();
  const meUserId = me.data.user?.id;
  if (!meUserId) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("players")
    .select("id, user_id, current_nation")
    .eq("game_id", gameId)
    .eq("user_id", meUserId)
    .single();

  if (error) throw new Error(error.message);
  return data as { id: string; user_id: string; current_nation: string | null };
}

export async function getNationIdByKey(gameId: string, nationKey: string) {
  const { data, error } = await supabase
    .from("nations")
    .select("id")
    .eq("game_id", gameId)
    .eq("nation_key", nationKey)
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function getNationPhaseStatus(args: {
  gameId: string;
  nationId: string;
  round: number;
  phase: string;
}): Promise<NationPhaseStatus> {
  const { data, error } = await supabase
    .from("nation_phase_state")
    .select("status")
    .eq("game_id", args.gameId)
    .eq("nation_id", args.nationId)
    .eq("round", args.round)
    .eq("phase", args.phase)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.status ?? "DRAFT") as NationPhaseStatus;
}

export async function setNationPhaseStatus(args: {
  gameId: string;
  nationId: string;
  round: number;
  phase: string;
  status: NationPhaseStatus;
  committedByPlayerId?: string;
}) {
  const row: any = {
    game_id: args.gameId,
    nation_id: args.nationId,
    round: args.round,
    phase: args.phase,
    status: args.status,
    updated_at: new Date().toISOString(),
  };

  if (args.status === "COMMITTED") {
    row.committed_at = new Date().toISOString();
    row.committed_by_player_id = args.committedByPlayerId ?? null;
  } else {
    row.committed_at = null;
    row.committed_by_player_id = null;
  }

  const { error } = await supabase
    .from("nation_phase_state")
    .upsert(row, { onConflict: "game_id,nation_id,round,phase" });

  if (error) throw new Error(error.message);
}
