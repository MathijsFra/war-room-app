"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getForcesInPlay } from "@/lib/db/units";
import PhaseShell from "@/components/phases/PhaseShell";

export default function MovementPanel(props: {
  gameId: string;
  round: number;
  nationKey: string;
  phaseStatus: string;
  canEdit: boolean;
}) {
  const { round, nationKey, phaseStatus, canEdit } = props;

  const [nationId, setNationId] = useState<string | null>(null);
  const [commands, setCommands] = useState<Array<{ id: string; command_type: "LAND" | "AIR" | "NAVAL"; command_name: string }>>([]);
  const [stacks, setStacks] = useState<Array<{ id: string; territory_code: string; unit_type: string; unit_count: number; command_id: string }>>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    async function run() {
      setLoadErr(null);
      setLoading(true);
      try {
        const { data: nRow, error: nErr } = await supabase
          .from("nations")
          .select("id")
          .eq("game_id", props.gameId)
          .eq("nation_key", nationKey)
          .maybeSingle();
        if (nErr) throw new Error(nErr.message);
        if (!nRow?.id) {
          if (!alive) return;
          setNationId(null);
          setCommands([]);
          setStacks([]);
          return;
        }
        if (!alive) return;
        setNationId(nRow.id);
        const forces = await getForcesInPlay(props.gameId, nRow.id);
        if (!alive) return;
        setCommands(forces.commands);
        setStacks(forces.stacks);
      } catch (e) {
        if (!alive) return;
        setLoadErr(e instanceof Error ? e.message : "Failed to load forces");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.gameId, nationKey]);

  const stacksByCommand = useMemo(() => {
    const map: Record<string, typeof stacks> = {};
    for (const s of stacks) {
      (map[s.command_id] ??= []).push(s);
    }
    return map;
  }, [stacks]);

  const commandLocation = useMemo(() => {
    // Best-effort: most commands should be in a single region at a time.
    // If a command has stacks in multiple regions (should be rare / transitional),
    // we keep per-stack territory labels to avoid hiding important info.
    const loc: Record<string, { primary: string | null; isMulti: boolean }> = {};
    for (const c of commands) {
      const ss = stacksByCommand[c.id] ?? [];
      const codes = Array.from(new Set(ss.map((s) => s.territory_code)));
      loc[c.id] = {
        primary: codes.length === 1 ? codes[0] : codes.length > 1 ? codes[0] : null,
        isMulti: codes.length > 1,
      };
    }
    return loc;
  }, [commands, stacksByCommand]);

  return (
    <PhaseShell
      title="Phase 3: Movement Operations"
      subtitle="Framework: resolve movement in turn order, track arrow tags, and create hotspots."
      phaseStatus={phaseStatus}
      canEdit={canEdit}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Context</div>
          <div className="mt-2 text-sm text-zinc-200">
            Round {round} • Acting nation: <span className="font-semibold">{nationKey}</span>
          </div>
          <div className="mt-2 text-xs text-zinc-400">
            Next steps for implementation in this phase (rulebook-driven):
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-300">
            <li>Turn order list (from bids/turn order track) + per-nation movement window.</li>
            <li>Movement declarations for each command based on Phase 2 orders.</li>
            <li>Air movement with arrow tags / landing enforcement.</li>
            <li>Pinning detection and hotspot creation.</li>
            <li>Naval movement, sea transport, convoy raid declaration.</li>
          </ul>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-100">Forces in play</div>
              <div className="mt-1 text-xs text-zinc-400">
                Seeded from the scenario deployment. Commands are backed by named command markers.
              </div>
            </div>
            <div className="text-xs text-zinc-400">
              {loading ? "Loading…" : nationId ? `${commands.length} commands` : "—"}
            </div>
          </div>

          {loadErr && (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
              {loadErr}
            </div>
          )}

          {!loadErr && !loading && commands.length === 0 && (
            <div className="mt-3 text-xs text-zinc-400">
              No commands found for this nation. If you just installed unit seeding, make sure you ran
              <code className="mx-1 rounded bg-black/30 px-1.5 py-0.5">sql/seed_game_units.sql</code>
              in Supabase, then start a new game.
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {commands.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold text-zinc-100">
                    <span className="mr-2 inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-zinc-200">
                      {commandLocation[c.id]?.isMulti ? "MULTI" : commandLocation[c.id]?.primary ?? "—"}
                    </span>
                    {c.command_name}
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] tracking-wide text-zinc-200">
                    {c.command_type}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {(stacksByCommand[c.id] ?? []).map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-xs">
                      <div className="text-zinc-300">
                        {commandLocation[c.id]?.isMulti && (
                          <>
                            <span className="font-mono text-zinc-200">{s.territory_code}</span>
                            <span className="mx-2 text-zinc-600">•</span>
                          </>
                        )}
                        {s.unit_type}
                      </div>
                      <div className="font-semibold text-zinc-100">{s.unit_count}</div>
                    </div>
                  ))}
                  {(stacksByCommand[c.id] ?? []).length === 0 && (
                    <div className="text-xs text-zinc-500">No unit stacks in this command.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-zinc-100">Turn order</div>
            <div className="mt-2 text-xs text-zinc-400">
              Placeholder. Will display the current turn-order track and highlight whose movement is active.
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-zinc-100">Hotspots & arrow tags</div>
            <div className="mt-2 text-xs text-zinc-400">
              Placeholder. Will list created hotspots (raids/battles) and pending arrow tags that must be resolved.
            </div>
          </div>
        </div>
      </div>
    </PhaseShell>
  );
}
