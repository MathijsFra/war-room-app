"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clearBid, getLatestBid, getNationByKey, saveBid, type BidRow } from "@/lib/db/planning";

type Props = {
  gameId: string;
  nationKey: string;
  phaseStatus: "DRAFT" | "COMMITTED" | "LOCKED" | string;
  canEdit: boolean;
  onError: (message: string) => void;
};

export default function OilBidPanel({ gameId, nationKey, phaseStatus, canEdit, onError }: Props) {
  const [nationId, setNationId] = useState<string | null>(null);
  const [bid, setBid] = useState<BidRow | null>(null);
  const [oil, setOil] = useState<number>(0);

  const savingRef = useRef<number | null>(null);

  const statusLabel =
    phaseStatus === "LOCKED" ? "Locked" : phaseStatus === "COMMITTED" ? "Committed" : "Draft";

  const revealLabel = useMemo(() => {
    if (!bid) return "Not submitted";
    return bid.revealed ? "Revealed" : "Hidden";
  }, [bid]);

  // Load nationId + current bid
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const nation = await getNationByKey(gameId, nationKey);
        if (cancelled) return;
        setNationId(nation.id);

        const latest = await getLatestBid({ gameId, nationId: nation.id });
        if (cancelled) return;
        setBid(latest);
        setOil(latest?.oil_spent ?? 0);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Failed to load bid");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [gameId, nationKey, onError]);

  async function persist(nextOil: number) {
    if (!canEdit || !nationId) return;
    try {
      await saveBid({ gameId, nationId, oilSpent: nextOil });
      const latest = await getLatestBid({ gameId, nationId });
      setBid(latest);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to save bid");
    }
  }

  function onChangeOil(next: number) {
    setOil(next);
    if (!canEdit || !nationId) return;
    if (savingRef.current) window.clearTimeout(savingRef.current);
    savingRef.current = window.setTimeout(() => {
      void persist(next);
    }, 450);
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs tracking-[0.2em] uppercase text-zinc-400">Strategic Planning</div>
          <h3 className="mt-1 text-lg font-semibold text-zinc-100">Oil bid</h3>
          <div className="mt-2 text-sm text-zinc-300">
            Acting as <span className="font-medium text-zinc-100">{nationKey}</span> • {statusLabel} • {revealLabel}
          </div>
        </div>
        <div className="text-xs text-zinc-400">{canEdit ? "Auto-saves." : "Read-only."}</div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[200px,1fr] sm:items-end">
        <div>
          <label className="block text-xs text-zinc-400">Oil to spend</label>
          <input
            type="number"
            min={0}
            step={1}
            disabled={!canEdit || !nationId || bid?.revealed}
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950/60 p-2 text-sm text-zinc-100"
            value={oil}
            onChange={(e) => onChangeOil(Math.max(0, Math.floor(Number(e.target.value || 0))))}
          />
          {bid?.revealed && (
            <div className="mt-2 text-[11px] text-zinc-400">Bid has been revealed and is no longer editable.</div>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">Framework note</div>
          <div className="mt-2 text-xs text-zinc-400">
            This is the bidding scaffold. Reveal/turn-order resolution will be implemented later.
          </div>
        </div>
      </div>

      {canEdit && nationId && !bid?.revealed && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={async () => {
              try {
                await clearBid({ gameId, nationId });
                const latest = await getLatestBid({ gameId, nationId });
                setBid(latest);
                setOil(latest?.oil_spent ?? 0);
              } catch (e) {
                onError(e instanceof Error ? e.message : "Failed to clear bid");
              }
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 hover:border-red-400/40 hover:text-red-200"
          >
            Clear bid
          </button>
        </div>
      )}
    </section>
  );
}
