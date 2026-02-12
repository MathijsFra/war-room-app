"use client";

export default function PhaseShell(props: {
  title: string;
  subtitle: string;
  phaseStatus: "DRAFT" | "COMMITTED" | "LOCKED" | string;
  canEdit: boolean;
  children?: React.ReactNode;
}) {
  const { title, subtitle, phaseStatus, canEdit, children } = props;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-zinc-100">{title}</div>
            <div className="mt-2 text-sm text-zinc-300">{subtitle}</div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-zinc-300">
              Status: {phaseStatus}
            </span>
            <span
              className={[
                "rounded-lg border px-2 py-1",
                canEdit ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/5 text-zinc-400",
              ].join(" ")}
              title={canEdit ? "Editing enabled" : "Editing disabled (commit / lock / phase rules)"}
            >
              {canEdit ? "Editable" : "Read-only"}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        {children ?? (
          <div className="text-sm text-zinc-300">
            Framework placeholder: this phase UI is ready to be filled with strict rulebook logic.
          </div>
        )}
      </div>
    </section>
  );
}
