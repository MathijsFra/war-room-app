"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/lib/supabase/useSession";

import AppHeader from "@/components/AppHeader";
import PhaseIndicator from "@/components/PhaseIndicator";
import CommanderPanel from "@/components/CommanderPanel";
import NationPhaseStatusChip from "@/components/NationPhaseStatusChip";
import PhaseWorkbench from "@/components/PhaseWorkbench";
import PlanningPanel from "@/components/PlanningPanel";
import OilBidPanel from "@/components/OilBidPanel";

import {
  fetchLobby,
  advancePhase,
  setCurrentNation as setCurrentNationDb,
  commitCurrentPhase,
  uncommitCurrentPhase,
  normalizeNationKey,
} from "@/lib/db/lobby";

import type { LobbyGame, LobbyPlayer, LobbyState } from "@/lib/db/lobby";
import { loadCurrentNation, saveCurrentNation } from "@/lib/ui/currentNation";
import { saveLastGameId } from "@/lib/ui/lastGame";

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();
  const { session, loading } = useSession();

  const [game, setGame] = useState<LobbyGame | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [nationsByPlayerId, setNationsByPlayerId] = useState<Record<string, string[]>>({});
  const [meUserId, setMeUserId] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [myName, setMyName] = useState("—");
  const [myNations, setMyNations] = useState<string[]>([]);
  const [currentNation, setCurrentNation] = useState<string | null>(null);

  // refreshGame is invoked from realtime callbacks and polling.
  // Those callbacks can capture stale state, so keep the latest selection in a ref
  // to prevent "jumping" to a different nation after refresh.
  const currentNationRef = useRef<string | null>(null);

  const [nationPhaseStatusByNation, setNationPhaseStatusByNation] = useState<Record<string, string>>({});

  // Source-of-truth status for the currently acting nation (prevents "flip to DRAFT" issues)
  const [actingNationPhaseStatus, setActingNationPhaseStatus] = useState<string>("DRAFT");

  const [isCommitting, setIsCommitting] = useState(false);

  const refreshingRef = useRef(false);
  const committingRef = useRef(false);
  const advancingRef = useRef(false);

  useEffect(() => {
    currentNationRef.current = currentNation;
  }, [currentNation]);

  useEffect(() => {
    if (!loading && !session) router.replace(`/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [loading, session, router]);

  async function refreshGame() {
    if (!session || refreshingRef.current) return;
    refreshingRef.current = true;

    try {
      setError(null);

      const data: LobbyState = await fetchLobby(gameId);

      setGame(data.game);
      setPlayers(data.players);
      setNationsByPlayerId(data.nationsByPlayerId);
      setMeUserId(data.meUserId);
      setIsHost(data.isHost);

      // Always trust DB: map is keyed by normalized nation_key
      setNationPhaseStatusByNation(() => {
        const raw = data.nationPhaseStatusByNation ?? {};
        const normalized: Record<string, string> = {};
        for (const [k, v] of Object.entries(raw)) {
          normalized[normalizeNationKey(k)] = v as string;
        }
        return normalized;
      });


      const mePlayer = data.players.find((p) => p.user_id === data.meUserId) ?? null;
      setMyPlayerId(mePlayer?.id ?? null);
      setMyName(mePlayer?.display_name ?? "—");

      const nations = data.nationsByPlayerId[mePlayer?.id ?? ""] ?? [];
      setMyNations(nations);

      const dbCurrent = mePlayer?.current_nation ?? null;
      const stored = loadCurrentNation(gameId);

      // Keep the current selection if it's still valid. This prevents UI "jumping"
      // back to the first nation on refresh (which can make the status look like it reverted).
      const currentSelected = currentNationRef.current;

      const next =
        (currentSelected && nations.includes(currentSelected) ? currentSelected : null) ??
        (dbCurrent && nations.includes(dbCurrent) ? dbCurrent : null) ??
        (stored && nations.includes(stored) ? stored : null) ??
        (nations[0] ?? null);

      setCurrentNation(next);
      if (next) saveCurrentNation(gameId, next);

      // Keep the status chip in sync with DB for the acting nation
      void refreshActingNationPhaseStatus(next, data.game.round, data.game.phase);

      if (data.game.status === "LOBBY") {
        router.replace(`/lobby/${gameId}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load game");
    } finally {
      refreshingRef.current = false;
    }
  }

  async function refreshActingNationPhaseStatus(
    nextNation?: string | null,
    roundOverride?: number | null,
    phaseOverride?: string | null
  ) {
    const nation = nextNation ?? currentNation;
    if (!nation) {
      setActingNationPhaseStatus("DRAFT");
      return;
    }
    const round = (typeof roundOverride === "number" ? roundOverride : game?.round) ?? 1;
    const phase = (phaseOverride ?? game?.phase) ?? "ECONOMY";
    const nk = normalizeNationKey(nation);

    // Resolve nation_id from nations table (DB source of truth)
    const { data: nRow, error: nErr } = await supabase
      .from("nations")
      .select("id")
      .eq("game_id", gameId)
      .eq("nation_key", nk)
      .maybeSingle();

    if (nErr || !nRow?.id) {
      setActingNationPhaseStatus("DRAFT");
      return;
    }

    const { data: sRow, error: sErr } = await supabase
      .from("nation_phase_state")
      .select("status")
      .eq("game_id", gameId)
      .eq("nation_id", nRow.id)
      .eq("round", round)
      .eq("phase", phase)
      .maybeSingle();

    if (sErr) {
      setActingNationPhaseStatus("DRAFT");
      return;
    }
    setActingNationPhaseStatus(sRow?.status ?? "DRAFT");
  }

  useEffect(() => {
    saveLastGameId(gameId);
    refreshGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, gameId]);

  // Realtime updates
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel(`rt:game:${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, refreshGame)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` }, refreshGame)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_nations", filter: `game_id=eq.${gameId}` },
        refreshGame
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nation_phase_state", filter: `game_id=eq.${gameId}` },
        refreshGame
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `game_id=eq.${gameId}` },
        refreshGame
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bids", filter: `game_id=eq.${gameId}` },
        refreshGame
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, gameId]);

  // Poll fallback
  useEffect(() => {
    if (!session) return;
    const id = window.setInterval(() => refreshGame(), 2000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, gameId]);

  async function onAdvancePhase() {
    if (!isHost) return;
    if (advancingRef.current) return;

    advancingRef.current = true;
    try {
      setError(null);
      await advancePhase(gameId);
      await refreshGame();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to advance phase");
    } finally {
      advancingRef.current = false;
    }
  }

  async function onChangeNation(nation: string) {
    if (!myPlayerId) return;
    setCurrentNation(nation);
    saveCurrentNation(gameId, nation);

    // Update acting status immediately for the new nation
    void refreshActingNationPhaseStatus(nation, game?.round ?? null, game?.phase ?? null);

    try {
      await setCurrentNationDb(gameId, myPlayerId, nation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set current nation");
    }
  }

  async function onToggleCommit() {
    if (!game || !currentNation) return;
    if (committingRef.current) return;

    // Commit/uncommit is allowed in any active phase. Phase status is stored in
    // nation_phase_state and the UI is refreshed from the DB (source of truth).
    if (game.status !== "ACTIVE") return;

    const key = normalizeNationKey(currentNation);
    const status = actingNationPhaseStatus ?? (nationPhaseStatusByNation[key] ?? "DRAFT");
    if (status === "LOCKED") return;

    committingRef.current = true;
    setIsCommitting(true);
    try {
      setError(null);
      if (status === "COMMITTED") {
        await uncommitCurrentPhase(gameId, currentNation);
        // Optimistic UI: DB is source of truth, but update immediately for responsiveness.
        setNationPhaseStatusByNation((prev) => ({ ...prev, [key]: "DRAFT" }));
        setActingNationPhaseStatus("DRAFT");
      } else {
        await commitCurrentPhase(gameId, currentNation);
        setNationPhaseStatusByNation((prev) => ({ ...prev, [key]: "COMMITTED" }));
        setActingNationPhaseStatus("COMMITTED");
      }
      await refreshGame(); // reload from DB (truth)
      await refreshActingNationPhaseStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update commit status");
    } finally {
      committingRef.current = false;
      setIsCommitting(false);
    }
  }

  if (!loading && !session) return null;
  if (!session) return null;

  const actingKey = currentNation ? normalizeNationKey(currentNation) : "";
  const currentStatus = actingNationPhaseStatus ?? (actingKey ? nationPhaseStatusByNation[actingKey] ?? "DRAFT" : "DRAFT");
  const canCommit = !!currentNation && game?.status === "ACTIVE";
  const commitBusy = isCommitting;

  const phaseCode = game?.phase ?? "ECONOMY";
  const isStrategicPlanning = phaseCode === "STRATEGIC_PLANNING" || phaseCode === "PLANNING";
  const canEditPlanning = !!currentNation && game?.status === "ACTIVE" && isStrategicPlanning && currentStatus === "DRAFT";

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppHeader
        rightSlot={
          <div className="flex items-center gap-3">
            <PhaseIndicator status={game?.status} round={game?.round} phase={game?.phase} />

            {currentNation && (
              <div className="flex items-center gap-2">
                <NationPhaseStatusChip status={currentStatus as any} />

                {canCommit && (
                  <button
                    type="button"
                    onClick={onToggleCommit}
                    disabled={commitBusy || currentStatus === "LOCKED"}
                    className={[
                      "rounded-xl border px-3 py-2 text-xs transition",
                      currentStatus === "COMMITTED"
                        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                        : currentStatus === "LOCKED"
                          ? "border-white/10 bg-white/5 text-zinc-500 cursor-not-allowed"
                          : "border-white/10 bg-white/5 text-zinc-200 hover:border-amber-400/40 hover:text-amber-200",
                    ].join(" ")}
                    title={
                      currentStatus === "COMMITTED"
                        ? `Uncommit ${game?.phase ?? "PHASE"} (${currentNation})`
                        : currentStatus === "LOCKED"
                          ? `Locked for ${game?.phase ?? "PHASE"} (${currentNation})`
                          : `Commit ${game?.phase ?? "PHASE"} (${currentNation})`
                    }
                  >
                    {commitBusy
                      ? "Saving…"
                      : currentStatus === "COMMITTED"
                        ? "Committed"
                        : currentStatus === "LOCKED"
                          ? "Locked"
                          : "Commit"}
                  </button>
                )}

                {isHost && (
                  <button
                    type="button"
                    onClick={onAdvancePhase}
                    className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200 hover:bg-amber-400/20"
                    title="Advance to the next rulebook phase"
                  >
                    Advance phase
                  </button>
                )}
              </div>
            )}

            <CommanderPanel
              playerName={myName}
              nations={myNations}
              currentNation={currentNation}
              onChangeNation={onChangeNation}
            />
          </div>
        }
      />

      <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {isStrategicPlanning && game?.round && currentNation ? (
          <div className="space-y-6">
            <PlanningPanel
              gameId={gameId}
              round={game.round}
              nationKey={normalizeNationKey(currentNation)}
              phaseStatus={currentStatus}
              canEdit={canEditPlanning}
              onError={(m) => setError(m)}
            />
            <OilBidPanel
              gameId={gameId}
              nationKey={normalizeNationKey(currentNation)}
              phaseStatus={currentStatus}
              canEdit={canEditPlanning}
              onError={(m) => setError(m)}
            />
          </div>
        ) : (
          <PhaseWorkbench phase={game?.phase} round={game?.round} actingNation={currentNation} />
        )}
      </div>
    </main>
  );
}
