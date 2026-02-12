"use client";

import PhaseShell from "@/components/phases/PhaseShell";

export default function ProductionPanel(props: {
  gameId: string;
  round: number;
  nationKey: string;
  phaseStatus: string;
  canEdit: boolean;
}) {
  const { round, nationKey, phaseStatus, canEdit } = props;

  return (
    <PhaseShell
      title="Phase 7: Production"
      subtitle="Framework: trade (scenario dependent) and spend resources to build units." 
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
            <li>Resource ledger UI (oil/iron/osr) + spending validation.</li>
            <li>Purchase queue with unit costs and caps.</li>
            <li>Scenario trade rules (if enabled) + sanctions/limits.</li>
            <li>Persist purchases for Phase 5 deployments.</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-zinc-100">Resource ledger</div>
            <div className="mt-2 text-xs text-zinc-400">Placeholder. Will show starting resources, income, and planned spending.</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-zinc-100">Build queue</div>
            <div className="mt-2 text-xs text-zinc-400">Placeholder. Will show purchased units and validation errors.</div>
          </div>
        </div>
      </div>
    </PhaseShell>
  );
}
