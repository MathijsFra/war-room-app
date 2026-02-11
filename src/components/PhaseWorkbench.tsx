"use client";

import type { GamePhase } from "@/lib/db/lobby";

const PHASES: { key: GamePhase; title: string; subtitle: string }[] = [
  { key: "ECONOMY", title: "Phase 1: Direct National Economy", subtitle: "Tally income and update resources." },
  { key: "PLANNING", title: "Phase 2: Strategic Planning", subtitle: "Write orders and bid for turn order." },
  { key: "MOVEMENT", title: "Phase 3: Movement Operations", subtitle: "Resolve movement in turn order." },
  { key: "COMBAT", title: "Phase 4: Combat Operations", subtitle: "Resolve hotspots and raids." },
  { key: "REFIT_DEPLOY", title: "Phase 5: Refit & Deploy", subtitle: "Land air, deploy new units, reorganize commands." },
  { key: "MORALE", title: "Phase 6: Morale", subtitle: "Convert casualties into stress and apply penalties." },
  { key: "PRODUCTION", title: "Phase 7: Production", subtitle: "Trade (scenario dependent) and build units." },
];

export default function PhaseWorkbench(props: {
  phase: GamePhase | null | undefined;
  round: number | null | undefined;
  actingNation: string | null;
}) {
  const phase = (props.phase ?? "ECONOMY") as GamePhase;
  const round = props.round ?? 1;

  const current = PHASES.find((p) => p.key === phase) ?? PHASES[0];

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-[1fr,320px]">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Current phase</div>
        <div className="mt-2 text-xl font-semibold text-zinc-100">{current.title}</div>
        <div className="mt-2 text-sm text-zinc-300">{current.subtitle}</div>

        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-white/5 px-2 py-1 text-xs text-zinc-300">Round {round}</span>
            <span className="rounded-lg bg-white/5 px-2 py-1 text-xs text-zinc-300">Acting: {props.actingNation ?? "—"}</span>
          </div>
          <div className="mt-3 text-xs text-zinc-400">
            This screen is a framework placeholder. Each phase will get its own full UI + validation.
            All state must be loaded from the database and updated via realtime subscriptions.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Round flow</div>
        <div className="mt-3 space-y-2">
          {PHASES.map((p) => {
            const isCurrent = p.key === phase;
            return (
              <div
                key={p.key}
                className={[
                  "rounded-xl border px-3 py-2",
                  isCurrent
                    ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
                    : "border-white/10 bg-white/5 text-zinc-300",
                ].join(" ")}
              >
                <div className="text-xs font-semibold">{p.title}</div>
                <div className="text-[11px] opacity-80">{p.subtitle}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
