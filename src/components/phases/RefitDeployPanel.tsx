"use client";

import PhaseShell from "@/components/phases/PhaseShell";

export default function RefitDeployPanel(props: {
  gameId: string;
  round: number;
  nationKey: string;
  phaseStatus: string;
  canEdit: boolean;
}) {
  const { round, nationKey, phaseStatus, canEdit } = props;

  return (
    <PhaseShell
      title="Phase 5: Refit & Deploy"
      subtitle="Framework: land air units, deploy new units, reorganize commands, and repair." 
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
            <li>Enforce air landing from arrow tags.</li>
            <li>Deploy units built/received (scenario rules) to eligible territories.</li>
            <li>Reorganize commands and move units between commands (if allowed).</li>
            <li>Repair/refit according to unit and territory rules.</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-zinc-100">Pending landings</div>
            <div className="mt-2 text-xs text-zinc-400">
              Placeholder. Will list air units with required landing destinations and validate legality.
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-zinc-100">Deployments & reorg</div>
            <div className="mt-2 text-xs text-zinc-400">
              Placeholder. Will show available deployments and command reorganization actions.
            </div>
          </div>
        </div>
      </div>
    </PhaseShell>
  );
}
