"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  clearOrderSlot,
  getNationByKey,
  listCommands,
  listOrders,
  listRegions,
  saveOrderSlot,
  type CommandRow,
  type OrderRow,
  type RegionRow,
} from "@/lib/db/planning";

type SlotModel = {
  slot: number;
  command_id: string | null;
  origin_region: string;
  target_region: string;
};

type Props = {
  gameId: string;
  round: number;
  nationKey: string;
  phaseStatus: "DRAFT" | "COMMITTED" | "LOCKED" | string;
  canEdit: boolean; // already accounts for phase + status
  onError: (message: string) => void;
};

function labelCommandType(t: CommandRow["command_type"]) {
  if (t === "land") return "Land";
  if (t === "air") return "Air";
  return "Naval";
}

export default function PlanningPanel({
  gameId,
  round,
  nationKey,
  phaseStatus,
  canEdit,
  onError,
}: Props) {
  const [nationId, setNationId] = useState<string | null>(null);
  const [commands, setCommands] = useState<CommandRow[]>([]);
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [slots, setSlots] = useState<SlotModel[]>(
    Array.from({ length: 9 }, (_, i) => ({
      slot: i + 1,
      command_id: null,
      origin_region: "",
      target_region: "",
    }))
  );

  const savingRef = useRef<Record<number, number>>({});
  const slotsRef = useRef<SlotModel[]>(slots);

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  // Load nation id, commands, existing orders, regions
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const nation = await getNationByKey(gameId, nationKey);
        if (cancelled) return;
        setNationId(nation.id);

        const [cmds, ords, regs] = await Promise.all([
          listCommands(nation.id),
          listOrders({ gameId, nationId: nation.id, round }),
          listRegions(),
        ]);

        if (cancelled) return;
        setCommands(cmds);
        setRegions(regs);
        setSlots((prev) => mergeOrdersIntoSlots(prev, ords));
      } catch (e) {
        onError(e instanceof Error ? e.message : "Failed to load planning data");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, nationKey, round]);

  const commandOptions = useMemo(() => {
    const available = commands.filter((c) => c.is_available);
    const unavailable = commands.filter((c) => !c.is_available);
    return { available, unavailable };
  }, [commands]);

  function updateSlot(slot: number, patch: Partial<Omit<SlotModel, "slot">>) {
    setSlots((prev) =>
      prev.map((s) => (s.slot === slot ? { ...s, ...patch } : s))
    );

    // Debounced save (only when editable)
    if (!canEdit || !nationId) return;
    if (savingRef.current[slot]) window.clearTimeout(savingRef.current[slot]);

    savingRef.current[slot] = window.setTimeout(async () => {
      try {
        const latest = slotsRef.current.find((s) => s.slot === slot);
        if (!latest) return;

        // If empty, clear
        const isEmpty =
          !latest.command_id &&
          latest.origin_region.trim() === "" &&
          latest.target_region.trim() === "";

        if (isEmpty) {
          await clearOrderSlot({
            gameId,
            nationId,
            round,
            slot,
          });
          return;
        }

        await saveOrderSlot({
          gameId,
          nationId,
          round,
          slot,
          commandId: latest.command_id,
          originRegion: latest.origin_region.trim() || null,
          targetRegion: latest.target_region.trim() || null,
        });
      } catch (e) {
        onError(e instanceof Error ? e.message : "Failed to save order");
      }
    }, 450);
  }

  const statusLabel =
    phaseStatus === "LOCKED" ? "Locked" : phaseStatus === "COMMITTED" ? "Committed" : "Draft";

  return (
    <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs tracking-[0.2em] uppercase text-zinc-400">Phase</div>
          <h2 className="mt-1 text-xl font-semibold">Strategic Planning</h2>
          <div className="mt-2 text-sm text-zinc-300">
            Acting as <span className="text-zinc-100 font-medium">{nationKey}</span> • Round {round} • {statusLabel}
          </div>
        </div>

        <div className="text-xs text-zinc-400">
          {canEdit ? "Edits auto-save." : "Read-only (committed/locked or wrong phase)."}
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {slots.map((s) => (
          <div
            key={s.slot}
            className="rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs tracking-[0.18em] uppercase text-zinc-400">
                Order {s.slot}
              </div>
              {(!canEdit || !nationId) && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-zinc-400">
                  {statusLabel}
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="block text-xs text-zinc-400">Command</label>
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950/60 p-2 text-sm text-zinc-100"
                  disabled={!canEdit || !nationId}
                  value={s.command_id ?? ""}
                  onChange={(e) => updateSlot(s.slot, { command_id: e.target.value || null })}
                >
                  <option value="">—</option>
                  {commandOptions.available.map((c) => (
                    <option key={c.id} value={c.id}>
                      {labelCommandType(c.command_type)}
                    </option>
                  ))}
                  {commandOptions.unavailable.length > 0 && (
                    <optgroup label="Unavailable">
                      {commandOptions.unavailable.map((c) => (
                        <option key={c.id} value={c.id}>
                          {labelCommandType(c.command_type)} (unavailable)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400">Origin region</label>
                <input
                  list="wr-regions"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950/60 p-2 text-sm text-zinc-100"
                  disabled={!canEdit || !nationId}
                  value={s.origin_region}
                  onChange={(e) => updateSlot(s.slot, { origin_region: e.target.value })}
                  placeholder="e.g., NORMANDY"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400">Target region</label>
                <input
                  list="wr-regions"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950/60 p-2 text-sm text-zinc-100"
                  disabled={!canEdit || !nationId}
                  value={s.target_region}
                  onChange={(e) => updateSlot(s.slot, { target_region: e.target.value })}
                  placeholder="e.g., PARIS"
                />
              </div>
            </div>

            {canEdit && nationId && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await clearOrderSlot({ gameId, nationId, round, slot: s.slot });
                      setSlots((prev) =>
                        prev.map((x) =>
                          x.slot === s.slot
                            ? { ...x, command_id: null, origin_region: "", target_region: "" }
                            : x
                        )
                      );
                    } catch (e) {
                      onError(e instanceof Error ? e.message : "Failed to clear order");
                    }
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 hover:border-red-400/40 hover:text-red-200"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <datalist id="wr-regions">
        {regions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </datalist>
    </section>
  );
}

function mergeOrdersIntoSlots(prev: SlotModel[], orders: OrderRow[]): SlotModel[] {
  const bySlot = new Map<number, OrderRow>();
  for (const o of orders) bySlot.set(o.slot, o);

  return prev.map((s) => {
    const o = bySlot.get(s.slot);
    if (!o) return { ...s, command_id: null, origin_region: "", target_region: "" };
    return {
      ...s,
      command_id: o.command_id,
      origin_region: o.origin_region ?? "",
      target_region: o.target_region ?? "",
    };
  });
}
