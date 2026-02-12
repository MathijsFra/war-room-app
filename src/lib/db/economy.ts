import { supabase } from "@/lib/supabase/client";

export type NationEconomyRow = {
  id: string;
  nation_key: string;
  oil: number;
  iron: number;
  osr: number;
  homeland_status: string | null;
};

export type RegionEconomyRow = {
  id: string; // territory code
  name: string;
  controller_nation_id: string | null;
  status: string; // ACTIVE / EMBATTLED / ...
};

export type StartingControlRow = {
  territory_code: string;
  controller_nation_key: string;
};

export type WorldTerritoryEconomyRow = {
  code: string;
  name: string;
  oil: number;
  iron: number;
  osr: number;
  embattled_oil: number;
  embattled_iron: number;
  embattled_osr: number;
};

export type IncomeTotals = { oil: number; iron: number; osr: number };

export type TerritoryIncomeLine = {
  territory_code: string;
  territory_name: string;
  status: string;
  used_embattled_side: boolean;
  oil: number;
  iron: number;
  osr: number;
};

export type NationIncomeBreakdown = {
  nation_id: string;
  nation_key: string;
  lines: TerritoryIncomeLine[];
  totals: IncomeTotals;
};

function normalizeNationKey(n: string) {
  return n.trim().replace(/_/g, " ").replace(/\s+/g, " ").toUpperCase();
}

function normalizeScenarioKey(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

function scenarioCandidatesFromGameScenario(gameScenario: string): string[] {
  const raw = normalizeScenarioKey(gameScenario);
  const upperSnake = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  // Common seeds in this project use WORLD as the default.
  return Array.from(new Set([raw, upperSnake, "WORLD"]));
}

async function fetchStartingControlForScenarioCandidates(scenarios: string[]) {
  for (const scen of scenarios) {
    const { data, error } = await supabase
      .from("world_starting_territory_control")
      .select("territory_code, controller_nation_key")
      .eq("scenario", scen);
    if (error) throw new Error(error.message);
    if ((data ?? []).length > 0) return { rows: data as any as StartingControlRow[], scenarioUsed: scen };
  }
  return { rows: [] as StartingControlRow[], scenarioUsed: scenarios[0] ?? "" };
}

export async function fetchEconomySnapshot(gameId: string) {
  const { data: game, error: gErr } = await supabase
    .from("games")
    .select("id, scenario")
    .eq("id", gameId)
    .single();
  if (gErr) throw new Error(gErr.message);

  const { data: nations, error: nErr } = await supabase
    .from("nations")
    .select("id, nation_key, oil, iron, osr, homeland_status")
    .eq("game_id", gameId);
  if (nErr) throw new Error(nErr.message);

  const { data: regions, error: rErr } = await supabase
    .from("regions")
    .select("id, name, controller_nation_id, status");
  if (rErr) throw new Error(rErr.message);

  // IMPORTANT:
  // In the current schema, `regions` is global (no game_id) but has controller_nation_id.
  // In practice, many setups keep starting control in `world_starting_territory_control`.
  // If regions have no controller set, we fall back to that table for the starting-state snapshot.
  let effectiveRegions: RegionEconomyRow[] = (regions ?? []) as any;

  const nationIdSet = new Set(((nations ?? []) as NationEconomyRow[]).map((n) => n.id));
  // `regions` is global (no game_id). It may contain controller_nation_id values from a different game.
  // Only treat regions as "seeded" if at least one controller points at *this* game's nations.
  const anyControlledForThisGame = (effectiveRegions ?? []).some(
    (r) => !!r.controller_nation_id && nationIdSet.has(String(r.controller_nation_id))
  );
  if (!anyControlledForThisGame) {
    // The DB often stores scenario codes like "WORLD" even if the game uses a display name like "Global War".
    // Try a few reasonable candidates before giving up.
    const scenarioRaw = String(game.scenario ?? "");
    const scenarioCandidates = Array.from(
      new Set([
        scenarioRaw,
        scenarioRaw.trim(),
        scenarioRaw.toUpperCase(),
        scenarioRaw.trim().toUpperCase(),
        scenarioRaw.replace(/\s+/g, "_").toUpperCase(),
        "WORLD",
      ].filter(Boolean))
    );

    let starting: StartingControlRow[] = [];
    let lastErr: string | null = null;
    for (const sc of scenarioCandidates) {
      const { data, error } = await supabase
        .from("world_starting_territory_control")
        .select("territory_code, controller_nation_key")
        .eq("scenario", sc);
      if (error) {
        lastErr = error.message;
        continue;
      }
      if ((data ?? []).length > 0) {
        starting = data as any;
        break;
      }
    }

    // Final fallback: case-insensitive match (handles DB values like "global war" vs "Global War").
    if (starting.length === 0) {
      const { data, error } = await supabase
        .from("world_starting_territory_control")
        .select("territory_code, controller_nation_key")
        .ilike("scenario", scenarioRaw);
      if (error) lastErr = error.message;
      starting = (data ?? []) as any;
    }

    // If we still got nothing, the game scenario label probably doesn't match the seed scenario codes.
    // As a best-effort fallback (to avoid a confusing all-zeros economy screen), look up available
    // scenario values and try the first few.
    if (starting.length === 0) {
      const { data: scenRows, error: scenErr } = await supabase
        .from("world_starting_territory_control")
        .select("scenario")
        .limit(50);
      if (scenErr) lastErr = scenErr.message;
      const distinct = Array.from(new Set((scenRows ?? []).map((r: any) => String(r.scenario)))).filter(Boolean);
      for (const sc of distinct) {
        const { data, error } = await supabase
          .from("world_starting_territory_control")
          .select("territory_code, controller_nation_key")
          .eq("scenario", sc)
          .limit(5000);
        if (error) {
          lastErr = error.message;
          continue;
        }
        if ((data ?? []).length > 0) {
          starting = data as any;
          break;
        }
      }
    }

    // Last-resort fallback: if we still have no rows, try any scenario that exists in the table.
    // This prevents a hard "0 territories" experience when the UI scenario label doesn't match seed data.
    if (starting.length === 0) {
      const { data: scenRows, error: scenErr } = await supabase
        .from("world_starting_territory_control")
        .select("scenario")
        .limit(50);
      if (scenErr) {
        lastErr = scenErr.message;
      } else {
        const distinct = Array.from(
          new Set((scenRows ?? []).map((r: any) => String(r.scenario)).filter(Boolean))
        );
        for (const sc of distinct) {
          const { data, error } = await supabase
            .from("world_starting_territory_control")
            .select("territory_code, controller_nation_key")
            .eq("scenario", sc);
          if (error) {
            lastErr = error.message;
            continue;
          }
          if ((data ?? []).length > 0) {
            starting = (data ?? []) as any;
            break;
          }
        }
      }
    }

    if (starting.length === 0) {
      // Not fatal; we can still return regions (even if unassigned) and show a clear "0" state.
      // But throw if we had an actual DB error.
      if (lastErr) throw new Error(lastErr);
    }

    const nationIdByKey = new Map(
      ((nations ?? []) as NationEconomyRow[]).map((n) => [normalizeNationKey(n.nation_key), n.id])
    );

    // Create a virtual regions list with controller ids and ACTIVE status.
    // Use the global `regions` names if present; otherwise the territory name from world_territories later.
    const nameByCode = new Map((regions ?? []).map((r: any) => [r.id, r.name]));
    effectiveRegions = (starting ?? []).map((s: any) => {
      const nid = nationIdByKey.get(normalizeNationKey(String(s.controller_nation_key))) ?? null;
      return {
        id: String(s.territory_code),
        name: nameByCode.get(String(s.territory_code)) ?? String(s.territory_code),
        controller_nation_id: nid,
        status: "ACTIVE",
      } as RegionEconomyRow;
    });
  }

  // Reduce noise and prevent overly-large IN() queries: we only care about territories controlled by this game.
  effectiveRegions = (effectiveRegions ?? []).filter(
    (r) => !!r.controller_nation_id && nationIdSet.has(String(r.controller_nation_id))
  );

  const territoryCodes = (effectiveRegions ?? []).map((r) => r.id).filter(Boolean);

  const territoriesByCode: Record<string, WorldTerritoryEconomyRow> = {};
  if (territoryCodes.length > 0) {
    const { data: terrs, error: tErr } = await supabase
      .from("world_territories")
      .select(
        "code, name, oil, iron, osr, embattled_oil, embattled_iron, embattled_osr"
      )
      .in("code", territoryCodes);
    if (tErr) throw new Error(tErr.message);
    for (const t of terrs ?? []) territoriesByCode[t.code] = t as any;
  }

  return {
    nations: (nations ?? []) as NationEconomyRow[],
    regions: effectiveRegions,
    territoriesByCode,
  };
}

export function computeIncomeForNation(args: {
  nation: NationEconomyRow;
  regions: RegionEconomyRow[];
  territoriesByCode: Record<string, WorldTerritoryEconomyRow>;
  // NOTE: collapse-driven "depleted territory" behavior needs `card_nation_key` (not in current schema).
}) : NationIncomeBreakdown {
  const { nation, regions, territoriesByCode } = args;

  const lines: TerritoryIncomeLine[] = [];
  const totals: IncomeTotals = { oil: 0, iron: 0, osr: 0 };

  const controlled = regions.filter((r) => r.controller_nation_id === nation.id);

  for (const r of controlled) {
    const t = territoriesByCode[r.id];
    if (!t) continue;

    const isEmbattled = normalizeNationKey(String(r.status)) === "EMBATTLED";
    const useEmbattled = isEmbattled;

    const oil = useEmbattled ? t.embattled_oil : t.oil;
    const iron = useEmbattled ? t.embattled_iron : t.iron;
    const osr = useEmbattled ? t.embattled_osr : t.osr;

    lines.push({
      territory_code: t.code,
      territory_name: t.name,
      status: r.status,
      used_embattled_side: useEmbattled,
      oil,
      iron,
      osr,
    });

    totals.oil += oil;
    totals.iron += iron;
    totals.osr += osr;
  }

  // China cannot gain or spend Oil — enforce "no gain" here.
  if (normalizeNationKey(nation.nation_key) === "CHINA") {
    totals.oil = 0;
    for (const line of lines) line.oil = 0;
  }

  return {
    nation_id: nation.id,
    nation_key: nation.nation_key,
    lines: lines.sort((a, b) => a.territory_name.localeCompare(b.territory_name)),
    totals,
  };
}

export function computeIncomeForAll(args: {
  nations: NationEconomyRow[];
  regions: RegionEconomyRow[];
  territoriesByCode: Record<string, WorldTerritoryEconomyRow>;
}) {
  const breakdowns = args.nations.map((nation) =>
    computeIncomeForNation({
      nation,
      regions: args.regions,
      territoriesByCode: args.territoriesByCode,
    })
  );

  return { breakdowns };
}

export async function checkEconomyApplied(gameId: string, round: number) {
  const { data, error } = await supabase
    .from("game_log")
    .select("id")
    .eq("game_id", gameId)
    .eq("event_type", "ECONOMY_APPLIED")
    .contains("payload", { round })
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export async function applyEconomy(gameId: string, round: number) {
  // Preferred path: SQL RPC (atomic + RLS-safe).
  // IMPORTANT: updating all nations' resource tracks is typically blocked by RLS from the client.
  // The host "Apply income (all nations)" action therefore requires the RPC to be installed.
  const { error: rpcErr } = await supabase.rpc("apply_economy_income", {
    p_game_id: gameId,
    p_round: round,
  });

  if (!rpcErr) return;

  // If the RPC isn't installed or isn't executable for the current user, fail loudly with guidance.
  // This prevents a confusing "it said applied but values stayed 0" experience due to RLS.
  const msg = rpcErr.message ?? String(rpcErr);
  throw new Error(
    [
      "Unable to apply income because the server-side RPC is missing or not permitted.",
      "Install the SQL function from: sql/apply_economy_income.sql",
      "Then ensure EXECUTE is granted to authenticated (see the bottom of that SQL file).",
      `Supabase error: ${msg}`,
    ].join("\n")
  );
}

export async function trySeedRegionsForGame(gameId: string) {
  // Optional helper: try to seed regions from a server-side function.
  // If it doesn't exist, we silently ignore.
  const { error } = await supabase.rpc("seed_regions_for_game", { p_game_id: gameId });
  if (error) {
    // Ignore missing-function / permission errors; seeding can be run manually via SQL.
    console.warn("[seed_regions_for_game]", error.message);
  }
}
