"use client";

type Props = {
  status?: string | null;
  round?: number | null;
  phase?: string | null; // ECONOMY | PLANNING | MOVEMENT | COMBAT | REFIT_DEPLOY | MORALE | PRODUCTION
};

const PHASE_ORDER: Array<{ code: string; name: string }> = [
  { code: "ECONOMY", name: "Direct National Economy" },
  { code: "PLANNING", name: "Strategic Planning" },
  { code: "MOVEMENT", name: "Movement Operations" },
  { code: "COMBAT", name: "Combat Operations" },
  { code: "REFIT_DEPLOY", name: "Refit & Deploy" },
  { code: "MORALE", name: "Morale" },
  { code: "PRODUCTION", name: "Production" },
];

export default function PhaseIndicator({ status, round, phase }: Props) {
  if (!status || status === "LOBBY") {
    return (
      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
        Lobby • Awaiting orders
      </span>
    );
  }

  const idx = PHASE_ORDER.findIndex((p) => p.code === phase);

  if (idx === -1) {
    return (
      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
        In session {round ? `• Round ${round}` : ""} • Phase unknown
      </span>
    );
  }

  const phaseNum = idx + 1;
  const phaseName = PHASE_ORDER[idx].name;

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
      <span className="tracking-[0.12em] uppercase">Round {round ?? "—"}</span>
      <span className="text-amber-300/60">•</span>
      <span className="tracking-[0.12em] uppercase">Phase {phaseNum}</span>
      <span className="text-amber-300/60">•</span>
      <span className="font-medium">{phaseName}</span>
    </span>
  );
}
