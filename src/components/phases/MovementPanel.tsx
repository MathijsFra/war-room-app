"use client";

import PhaseShell from "@/components/phases/PhaseShell";

export default function MovementPanel(props: {
  gameId: string;
  round: number;
  nationKey: string;
  phaseStatus: string;
  canEdit: boolean;
}) {
  const { round, nationKey, phaseStatus, canEdit } = props;

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
