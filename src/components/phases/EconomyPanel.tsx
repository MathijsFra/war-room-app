"use client";

import PhaseShell from "@/components/phases/PhaseShell";

export default function EconomyPanel(props: {
  gameId: string;
  round: number;
  nationKey: string;
  phaseStatus: string;
  canEdit: boolean;
}) {
  const { round, nationKey, phaseStatus, canEdit } = props;

  return (
    <PhaseShell
      title="Phase 1: Direct National Economy"
      subtitle="Framework: tally income, apply embattled adjustments, and update resources."
      phaseStatus={phaseStatus}
      canEdit={canEdit}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Context</div>
          <div className="mt-2 text-sm text-zinc-200">
            Round {round} • Acting nation: <span className="font-semibold">{nationKey}</span>
          </div>
          <div className="mt-2 text-xs text-zinc-400">Next steps for implementation in this phase (rulebook-driven):</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-300">
            <li>Territory income ledger (controlled vs embattled) + scenario income modifiers.</li>
            <li>Apply income to resource tracks (oil/iron/osr) with caps/limits.</li>
            <li>Homeland status and collapse checks (scenario dependent).</li>
            <li>Persist economy results for auditing and later phases.</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-zinc-100">Income breakdown</div>
            <div className="mt-2 text-xs text-zinc-400">Placeholder. Will list territories, income values, and totals.</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-zinc-100">Resource tracks</div>
            <div className="mt-2 text-xs text-zinc-400">Placeholder. Will show resources before/after applying income.</div>
          </div>
        </div>
      </div>
    </PhaseShell>
  );
}
