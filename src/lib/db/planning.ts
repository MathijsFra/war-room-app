import { supabase } from "@/lib/supabase/client";

export type NationRow = {
  id: string;
  nation_key: string;
  game_id: string;
};

export type CommandRow = {
  id: string;
  command_type: "land" | "air" | "naval";
  is_available: boolean;
};

export type OrderRow = {
  id: string;
  slot: number;
  command_id: string | null;
  origin_region: string | null;
  target_region: string | null;
  status: string;
};

export type RegionRow = {
  id: string;
  name: string;
};

export type BidRow = {
  id: string;
  oil_spent: number;
  revealed: boolean;
  created_at: string;
};

export async function getNationByKey(gameId: string, nationKey: string): Promise<NationRow> {
  const { data, error } = await supabase
    .from("nations")
    .select("id, nation_key, game_id")
    .eq("game_id", gameId)
    .eq("nation_key", nationKey)
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nation not found");
  return data as NationRow;
}

export async function listCommands(nationId: string): Promise<CommandRow[]> {
  const { data, error } = await supabase
    .from("commands")
    .select("id, command_type, is_available")
    .eq("nation_id", nationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as CommandRow[];
}

export async function listRegions(): Promise<RegionRow[]> {
  const { data, error } = await supabase
    .from("regions")
    .select("id, name")
    .eq("status", "ACTIVE")
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as RegionRow[];
}

export async function listOrders(args: {
  gameId: string;
  nationId: string;
  round: number;
}): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, slot, command_id, origin_region, target_region, status")
    .eq("game_id", args.gameId)
    .eq("nation_id", args.nationId)
    .eq("round", args.round)
    .order("slot", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as OrderRow[];
}

// We intentionally do NOT rely on a unique constraint for (game_id, nation_id, round, slot)
// to avoid forcing a schema change right now. This does a small read-before-write.
export async function saveOrderSlot(args: {
  gameId: string;
  nationId: string;
  round: number;
  slot: number;
  commandId: string | null;
  originRegion: string | null;
  targetRegion: string | null;
}): Promise<void> {
  const { data: existing, error: selErr } = await supabase
    .from("orders")
    .select("id")
    .eq("game_id", args.gameId)
    .eq("nation_id", args.nationId)
    .eq("round", args.round)
    .eq("slot", args.slot)
    .limit(1);

  if (selErr) throw new Error(selErr.message);

  const payload = {
    game_id: args.gameId,
    nation_id: args.nationId,
    round: args.round,
    slot: args.slot,
    command_id: args.commandId,
    origin_region: args.originRegion,
    target_region: args.targetRegion,
  };

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from("orders")
      .update({
        command_id: payload.command_id,
        origin_region: payload.origin_region,
        target_region: payload.target_region,
      })
      .eq("id", existing[0].id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("orders").insert(payload);
  if (error) throw new Error(error.message);
}

export async function clearOrderSlot(args: {
  gameId: string;
  nationId: string;
  round: number;
  slot: number;
}): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .delete()
    .eq("game_id", args.gameId)
    .eq("nation_id", args.nationId)
    .eq("round", args.round)
    .eq("slot", args.slot);

  if (error) throw new Error(error.message);
}

// ===== Oil bid (Strategic Planning) =====
// The current schema stores bids per (game_id, nation_id) without round.
// For the framework, we treat the latest bid as the active one for the current round.
export async function getLatestBid(args: { gameId: string; nationId: string }): Promise<BidRow | null> {
  const { data, error } = await supabase
    .from("bids")
    .select("id, oil_spent, revealed, created_at")
    .eq("game_id", args.gameId)
    .eq("nation_id", args.nationId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  return (data && data.length > 0 ? (data[0] as BidRow) : null);
}

export async function saveBid(args: {
  gameId: string;
  nationId: string;
  oilSpent: number;
}): Promise<void> {
  // Update latest unrevealed bid if present, else insert a new one
  const { data: existing, error: selErr } = await supabase
    .from("bids")
    .select("id")
    .eq("game_id", args.gameId)
    .eq("nation_id", args.nationId)
    .eq("revealed", false)
    .order("created_at", { ascending: false })
    .limit(1);

  if (selErr) throw new Error(selErr.message);

  const oil = Math.max(0, Math.floor(args.oilSpent));

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from("bids")
      .update({ oil_spent: oil })
      .eq("id", existing[0].id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("bids").insert({
    game_id: args.gameId,
    nation_id: args.nationId,
    oil_spent: oil,
    revealed: false,
  });
  if (error) throw new Error(error.message);
}

export async function clearBid(args: { gameId: string; nationId: string }): Promise<void> {
  // Delete unrevealed bids for this nation (keeps history if revealed)
  const { error } = await supabase
    .from("bids")
    .delete()
    .eq("game_id", args.gameId)
    .eq("nation_id", args.nationId)
    .eq("revealed", false);

  if (error) throw new Error(error.message);
}
