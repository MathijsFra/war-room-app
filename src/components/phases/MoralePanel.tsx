"use client";

import PhaseShell from "@/components/phases/PhaseShell";

export default function MoralePanel(props: {
  gameId: string;
  round: number;
  nationKey: string;
  phaseStatus: string;
  canEdit: boolean;
}) {
  const { round, nationKey, phaseStatus, canEdit } = props;

  return (
    <PhaseShell
      title="Phase 6: Morale"
      subtitle="Framework: convert casualties into stress and apply morale effects." 
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
            <li>Compute stress from losses (by unit type / scenario rules).</li>
            <li>Update nation stress track and trigger penalties/thresholds.</li>
            <li>Persist per-round morale results for audit + replay.</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-zinc-100">Casualties summary</div>
            <div className="mt-2 text-xs text-zinc-400">Placeholder. Will summarize casualties from Phase 4 outcomes.</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-zinc-100">Stress & effects</div>
            <div className="mt-2 text-xs text-zinc-400">Placeholder. Will show stress change and active morale penalties.</div>
          </div>
        </div>
      </div>
    </PhaseShell>
  );
}
