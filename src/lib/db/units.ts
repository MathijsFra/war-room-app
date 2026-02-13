import { supabase } from "@/lib/supabase/client";

export type GameCommandRow = {
  id: string;
  command_type: "LAND" | "AIR" | "NAVAL";
  command_name: string;
};

export type GameUnitStackRow = {
  id: string;
  territory_code: string;
  unit_type: string;
  unit_count: number;
  command_id: string;
};

export type ForcesInPlay = {
  commands: GameCommandRow[];
  stacks: GameUnitStackRow[];
};

export async function seedGameUnits(gameId: string): Promise<void> {
  const { error } = await supabase.rpc("seed_game_units", { p_game_id: gameId });
  if (error) throw new Error(error.message);
}

export async function getForcesInPlay(gameId: string, nationId: string): Promise<ForcesInPlay> {
  const { data: commands, error: cErr } = await supabase
    .from("game_commands")
    .select("id, command_type, command_name")
    .eq("game_id", gameId)
    .eq("nation_id", nationId)
    .order("command_type", { ascending: true })
    .order("command_name", { ascending: true });
  if (cErr) throw new Error(cErr.message);

  const { data: stacks, error: sErr } = await supabase
    .from("game_unit_stacks")
    .select("id, territory_code, unit_type, unit_count, command_id")
    .eq("game_id", gameId)
    .eq("nation_id", nationId)
    .order("territory_code", { ascending: true })
    .order("unit_type", { ascending: true });
  if (sErr) throw new Error(sErr.message);

  return {
    commands: (commands ?? []) as GameCommandRow[],
    stacks: (stacks ?? []) as GameUnitStackRow[],
  };
}
