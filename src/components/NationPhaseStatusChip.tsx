"use client";

export type NationPhaseStatus = "DRAFT" | "COMMITTED" | "LOCKED";

export default function NationPhaseStatusChip({ status }: { status: NationPhaseStatus | null | undefined }) {
  const s: NationPhaseStatus = status ?? "DRAFT";
  const cls = s === "COMMITTED"
    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
    : s === "LOCKED"
    ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
    : "border-white/10 bg-white/5 text-zinc-200";
  const label = s === "COMMITTED" ? "Committed" : s === "LOCKED" ? "Locked" : "Draft";
  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${cls}`} title={`Nation phase status: ${label}`}>
      {label}
    </span>
  );
}
