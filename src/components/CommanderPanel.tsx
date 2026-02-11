"use client";

import { useMemo } from "react";

type Props = {
  playerName: string;
  nations: string[];
  currentNation: string | null;
  onChangeNation: (nation: string) => void;
};

type NationKey =
  | "CHINA"
  | "BRITISH COMMONWEALTH"
  | "SOVIET UNION"
  | "UNITED STATES"
  | "GERMANY"
  | "ITALY"
  | "IMPERIAL JAPAN";

const NATION_TO_FLAG: Record<NationKey, { src: string; alt: string }> = {
  CHINA: { src: "/flags/china.png", alt: "China" },
  "BRITISH COMMONWEALTH": { src: "/flags/british_commonwealth.png", alt: "British Commonwealth" },
  "SOVIET UNION": { src: "/flags/soviet_union.png", alt: "Soviet Union" },
  "UNITED STATES": { src: "/flags/united_states.png", alt: "United States" },
  GERMANY: { src: "/flags/germany.png", alt: "Germany" },
  ITALY: { src: "/flags/italy.png", alt: "Italy" },
  "IMPERIAL JAPAN": { src: "/flags/imperial_japan.png", alt: "Imperial Japan" },
};

function normalizeNation(n: string) {
  // Handle "BRITISH_COMMONWEALTH" and "British   Commonwealth"
  return n
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function toNationKey(n: string): NationKey | null {
  const k = normalizeNation(n);
  return (k in NATION_TO_FLAG ? (k as NationKey) : null);
}

function FlagPill({
  src,
  alt,
  isActive,
}: {
  src: string;
  alt: string;
  isActive: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center justify-center rounded-md border transition",
        isActive
          ? "border-amber-400/60 shadow-[0_0_10px_rgba(251,191,36,0.45)]"
          : "border-white/20",
      ].join(" ")}
      style={{
        width: "44px",
        height: "28px",
        backgroundColor: "#1f1f1f",
      }}
      title={alt}
    >
      <img
        src={src}
        alt={alt}
        style={{
          width: "40px",
          height: "24px",
          objectFit: "cover",
          borderRadius: "3px",
          display: "block",
        }}
      />
    </div>
  );
}



function UnknownNationPill({ raw }: { raw: string }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-200"
      title={`Unknown nation value: ${raw}`}
      aria-label={`Unknown nation value: ${raw}`}
    >
      ?
    </span>
  );
}

export default function CommanderPanel({
  playerName,
  nations,
  currentNation,
  onChangeNation,
}: Props) {
  const sorted = useMemo(() => [...nations].sort(), [nations]);
  const effectiveCurrent = currentNation ?? (sorted[0] ?? null);
  const activeKey = effectiveCurrent ? toNationKey(effectiveCurrent) : null;

  const rendered = useMemo(() => {
    return sorted.map((raw) => {
      const key = toNationKey(raw);
      if (!key) return { kind: "unknown" as const, raw };

      return {
        kind: "flag" as const,
        key,
        raw,
        src: NATION_TO_FLAG[key].src,
        alt: NATION_TO_FLAG[key].alt,
      };
    });
  }, [sorted]);

  return (
    <div className="flex items-center gap-3">
      <div className="hidden sm:block text-right">
        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">
          Commander
        </div>
        <div className="text-sm font-medium text-zinc-100">{playerName}</div>
      </div>

      {/* Always show something here so we can diagnose mapping issues */}
      <div className="flex items-center gap-2">
        {rendered.length === 0 ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-400">
            —
          </span>
        ) : (
          rendered.map((item, idx) => {
            if (item.kind === "unknown") {
              return <UnknownNationPill key={`${item.raw}-${idx}`} raw={item.raw} />;
            }

            const isActive = activeKey ? item.key === activeKey : idx === 0;
            return (
              <FlagPill
                key={`${item.key}-${idx}`}
                src={item.src}
                alt={item.alt}
                isActive={isActive}
              />
            );
          })
        )}
      </div>

      {sorted.length > 1 ? (
        <select
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-200"
          value={effectiveCurrent ?? ""}
          onChange={(e) => onChangeNation(e.target.value)}
          title="Current nation (your actions are issued as this nation)"
        >
          {sorted.map((n) => (
            <option key={n} value={n}>
              Acting as: {n}
            </option>
          ))}
        </select>
      ) : (
        <span className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          Acting as: {sorted[0] ?? "—"}
        </span>
      )}
    </div>
  );
}
