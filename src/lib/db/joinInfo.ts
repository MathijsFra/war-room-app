import { supabase } from "@/lib/supabase/client";

export type JoinInfo =
  | { ok: true; current: number; max: number; status: string; reason: null }
  | { ok: false; reason: string; current?: number; max?: number; status?: string };

export async function getJoinInfo(gameId: string): Promise<JoinInfo> {
  const { data, error } = await supabase.rpc("get_join_info", { gid: gameId });
  if (error) throw new Error(error.message);
  return data as JoinInfo;
}
