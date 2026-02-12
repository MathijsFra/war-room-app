"use client";

import PhaseShell from "@/components/phases/PhaseShell";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  applyEconomy,
  checkEconomyApplied,
  computeIncomeForAll,
  fetchEconomySnapshot,
} from "@/lib/db/economy";

export default function EconomyPanel(props: {
  gameId: string;
  round: number;
  nationKey: string;
  phaseStatus: string;
  canEdit: boolean;
  isHost: boolean;
  onError?: (message: string) => void;
}) {
  const { gameId, round, nationKey, phaseStatus, canEdit, isHost } = props;

  const [loading, setLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  // Broadcast to other clients after the host applies economy. We subscribe to the same
  // game realtime channel name that GamePage uses so other clients can react immediately.
  const rtRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const ch = supabase.channel(`rt:game:${gameId}`);
    rtRef.current = ch;
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
      rtRef.current = null;
    };
  }, [gameId]);

  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof fetchEconomySnapshot>> | null>(null);

  const economy = useMemo(() => {
    if (!snapshot) return null;
    return computeIncomeForAll(snapshot);
  }, [snapshot]);

  const actingBreakdown = useMemo(() => {
    if (!economy || !snapshot) return null;
    const nk = nationKey.trim().toUpperCase();
    return economy.breakdowns.find((b) => b.nation_key.toUpperCase() === nk) ?? null;
  }, [economy, snapshot, nationKey]);

  const actingNation = useMemo(() => {
    if (!snapshot) return null;
    const nk = nationKey.trim().toUpperCase();
    return snapshot.nations.find((n) => n.nation_key.toUpperCase() === nk) ?? null;
  }, [snapshot, nationKey]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const snap = await fetchEconomySnapshot(gameId);
        if (cancelled) return;
        setSnapshot(snap);
        const wasApplied = await checkEconomyApplied(gameId, round);
        if (cancelled) return;
        setApplied(wasApplied);
      } catch (e) {
        props.onError?.(e instanceof Error ? e.message : "Failed to load economy");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, round, nationKey]);

  async function onApplyIncome() {
    if (!isHost || applied || isApplying) return;
    try {
      setIsApplying(true);
      await applyEconomy(gameId, round);
      setApplied(true);
      const snap = await fetchEconomySnapshot(gameId);
      setSnapshot(snap);

      // Proactively notify other players to refresh (in case Postgres change events aren't flowing)
      // This is a best-effort fire-and-forget.
      void rtRef.current?.send({
        type: "broadcast",
        event: "economy_applied",
        payload: { gameId, round },
      });
    } catch (e) {
      props.onError?.(e instanceof Error ? e.message : "Failed to apply economy");
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <PhaseShell
      title="Phase 1: Direct National Economy"
      subtitle="Tally income from controlled territories (active vs embattled) and apply it to resource tracks."
      phaseStatus={phaseStatus}
      canEdit={canEdit}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Context</div>
              <div className="mt-2 text-sm text-zinc-200">
                Round {round} • Acting nation: <span className="font-semibold">{nationKey}</span>
              </div>
              <div className="mt-2 text-xs text-zinc-400">
                Income is calculated from controlled territories. Embattled territories use the reduced-income values.
                If a nation is Collapsed, territories of that nation’s color should use reduced income (requires the optional
                <span className="font-semibold"> card_nation_key</span> column in <span className="font-semibold">world_territories</span>).
              </div>
            </div>

            {isHost && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onApplyIncome}
                  disabled={loading || applied || isApplying}
                  className={[
                    "rounded-xl px-4 py-2 text-sm font-semibold",
                    loading || applied || isApplying
                      ? "bg-white/10 text-zinc-400"
                      : "bg-amber-400/20 text-amber-100 hover:bg-amber-400/30",
                  ].join(" ")}
                >
                  {applied ? "Income applied" : isApplying ? "Applying…" : "Apply income (all nations)"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-zinc-100">Income breakdown</div>
            {loading ? (
              <div className="mt-2 text-xs text-zinc-400">Loading…</div>
            ) : !actingBreakdown ? (
              <div className="mt-2 text-xs text-zinc-400">No data (regions/territories not seeded yet).</div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-lg bg-white/5 px-2 py-1 text-zinc-300">
                    Territories: {actingBreakdown.lines.length}
                  </span>
                  <span className="rounded-lg bg-white/5 px-2 py-1 text-zinc-300">
                    Total: +{actingBreakdown.totals.oil} Oil / +{actingBreakdown.totals.iron} Iron / +{actingBreakdown.totals.osr} OSR
                  </span>
                </div>

                <div className="max-h-[320px] overflow-auto rounded-xl border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-black/40 text-zinc-300">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Territory</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold">Oil</th>
                        <th className="px-3 py-2 font-semibold">Iron</th>
                        <th className="px-3 py-2 font-semibold">OSR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actingBreakdown.lines.map((l) => (
                        <tr key={l.territory_code} className="border-t border-white/10 text-zinc-200">
                          <td className="px-3 py-2">
                            <div className="font-semibold">{l.territory_name}</div>
                            <div className="text-[11px] text-zinc-400">{l.territory_code}</div>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={[
                                "rounded-lg px-2 py-1 text-[11px]",
                                l.used_embattled_side ? "bg-red-500/10 text-red-200" : "bg-white/5 text-zinc-300",
                              ].join(" ")}
                            >
                              {l.used_embattled_side ? "Embattled income" : l.status}
                            </span>
                          </td>
                          <td className="px-3 py-2">{l.oil}</td>
                          <td className="px-3 py-2">{l.iron}</td>
                          <td className="px-3 py-2">{l.osr}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-zinc-100">Resource tracks</div>
            {loading ? (
              <div className="mt-2 text-xs text-zinc-400">Loading…</div>
            ) : !actingNation ? (
              <div className="mt-2 text-xs text-zinc-400">No nation row found.</div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-zinc-400">Oil</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-100">{actingNation.oil}</div>
                    <div className="mt-1 text-[11px] text-zinc-400">
                      {!applied && actingBreakdown ? `After: ${actingNation.oil + actingBreakdown.totals.oil}` : "—"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-zinc-400">Iron</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-100">{actingNation.iron}</div>
                    <div className="mt-1 text-[11px] text-zinc-400">
                      {!applied && actingBreakdown ? `After: ${actingNation.iron + actingBreakdown.totals.iron}` : "—"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-zinc-400">OSR</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-100">{actingNation.osr}</div>
                    <div className="mt-1 text-[11px] text-zinc-400">
                      {!applied && actingBreakdown ? `After: ${actingNation.osr + actingBreakdown.totals.osr}` : "—"}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-zinc-400">
                  Note: “After” shows the projected result if you apply income now. Once applied, the current values already include the round’s income.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PhaseShell>
  );
}
