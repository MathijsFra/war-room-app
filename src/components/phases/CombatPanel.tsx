"use client";

import PhaseShell from "@/components/phases/PhaseShell";

export default function CombatPanel(props: {
  gameId: string;
  round: number;
  nationKey: string;
  phaseStatus: string;
  canEdit: boolean;
}) {
  const { round, nationKey, phaseStatus, canEdit } = props;

  return (
    <PhaseShell
      title="Phase 4: Combat Operations"
      subtitle="Framework: resolve hotspots, raids, battleboard steps, and apply outcomes."
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
            <li>Hotspot queue + resolution in turn order.</li>
            <li>Battleboard UI: units, tactics, dice, hits, casualties, retreats, pinning.</li>
            <li>Raid types: convoy, bombing, amphibious, etc (scenario dependent).</li>
            <li>Embattled resolution and territory control changes.</li>
            <li>Combat log entries to game_log for replayability.</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-zinc-100">Hotspot queue</div>
            <div className="mt-2 text-xs text-zinc-400">Placeholder. Will list all hotspots and their current resolution step.</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-zinc-100">Battleboard</div>
            <div className="mt-2 text-xs text-zinc-400">
              Placeholder. Will show a battleboard with attacker/defender forces, dice, and results.
            </div>
          </div>
        </div>
      </div>
    </PhaseShell>
  );
}
