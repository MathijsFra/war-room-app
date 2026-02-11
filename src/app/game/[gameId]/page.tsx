"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/lib/supabase/useSession";

import AppHeader from "@/components/AppHeader";
import PhaseIndicator from "@/components/PhaseIndicator";
import CommanderPanel from "@/components/CommanderPanel";
import NationPhaseStatusChip from "@/components/NationPhaseStatusChip";

import {
  fetchLobby,
  advancePhase,
  setCurrentNation as setCurrentNationDb,
  commitCurrentPhase,
  uncommitCurrentPhase,
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

  // Commander panel
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [myName, setMyName] = useState("—");
  const [myNations, setMyNations] = useState<string[]>([]);
  const [currentNation, setCurrentNation] = useState<string | null>(null);
  const [nationPhaseStatusByNation, setNationPhaseStatusByNation] = useState<Record<string, string | null>>({});

  const committingRef = useRef(false);

  const refreshingRef = useRef(false);
  const advancingRef = useRef(false);

  useEffect(() => {
    if (!loading && !session) router.replace("/sign-in");
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
      // Don't clobber locally known status (e.g. after a commit) if the server
      // couldn't return nation_phase_state due to RLS.
      if (data.nationPhaseStatusByNation && Object.keys(data.nationPhaseStatusByNation).length > 0) {
        setNationPhaseStatusByNation(data.nationPhaseStatusByNation);
      }

      const mePlayer = data.players.find((p) => p.user_id === data.meUserId) ?? null;
      setMyPlayerId(mePlayer?.id ?? null);
      setMyName(mePlayer?.display_name ?? "—");

      const nations = data.nationsByPlayerId[mePlayer?.id ?? ""] ?? [];
      setMyNations(nations);

      const dbCurrent = mePlayer?.current_nation ?? null;
      const stored = loadCurrentNation(gameId);

      const next =
        (dbCurrent && nations.includes(dbCurrent) ? dbCurrent : null) ??
        (stored && nations.includes(stored) ? stored : null) ??
        (nations[0] ?? null);

      setCurrentNation(next);
      if (next) saveCurrentNation(gameId, next);

      if (data.game.status === "LOBBY") {
        router.replace(`/lobby/${gameId}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load game");
    } finally {
      refreshingRef.current = false;
    }
  }

  useEffect(() => {
    // Remember the most recent game so we can resume after closing a tab.
    saveLastGameId(gameId);
    refreshGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, gameId]);

  // Realtime updates
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel(`rt:game:${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        refreshGame
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` },
        refreshGame
      )
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, gameId]);

  // Polling fallback
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

  async function onToggleCommit() {
    if (!game || !currentNation) return;
    if (committingRef.current) return;

    // You asked to refine Phase 1: only allow committing during ECONOMY.
    if (game.status !== "ACTIVE" || game.phase !== "ECONOMY") return;

    const status = nationPhaseStatusByNation[currentNation] ?? "DRAFT";
    if (status === "LOCKED") return;

    const nextStatus = status === "COMMITTED" ? "DRAFT" : "COMMITTED";

    committingRef.current = true;
    try {
      setError(null);
      // Optimistic UI: reflect the new state immediately.
      setNationPhaseStatusByNation((prev) => ({ ...prev, [currentNation]: nextStatus }));
      if (status === "COMMITTED") {
        await uncommitCurrentPhase(gameId, currentNation);
      } else {
        await commitCurrentPhase(gameId, currentNation);
      }
      await refreshGame();
    } catch (e) {
      // Revert optimistic update on failure.
      setNationPhaseStatusByNation((prev) => ({ ...prev, [currentNation]: status }));
      setError(e instanceof Error ? e.message : "Failed to update commit status");
    } finally {
      committingRef.current = false;
    }
  }

  if (!loading && !session) return null;
  if (!session) return null;

  const currentStatus = currentNation ? (nationPhaseStatusByNation[currentNation] ?? "DRAFT") : "DRAFT";
  const canCommit = !!currentNation && game?.status === "ACTIVE" && game?.phase === "ECONOMY";

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppHeader
        rightSlot={
          <div className="flex items-center gap-3">
            <PhaseIndicator status={game?.status} round={game?.round} phase={game?.phase} />

            {/* Phase status for the nation you are acting as */}
            {currentNation && (
              <div className="flex items-center gap-2">
                <NationPhaseStatusChip status={currentStatus as any} />

                {canCommit && (
                  <button
                    type="button"
                    onClick={onToggleCommit}
                    disabled={currentStatus === "LOCKED"}
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
                        ? `Uncommit ECONOMY (${currentNation})`
                        : currentStatus === "LOCKED"
                          ? `Locked for ECONOMY (${currentNation})`
                          : `Commit ECONOMY (${currentNation})`
                    }
                  >
                    {currentStatus === "COMMITTED" ? "Committed" : currentStatus === "LOCKED" ? "Locked" : "Commit"}
                  </button>
                )}
              </div>
            )}

            {isHost && (
              <button
                type="button"
                onClick={onAdvancePhase}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 hover:border-amber-400/40 hover:text-amber-200"
                title="Advance to the next rulebook phase"
              >
                Advance phase
              </button>
            )}

            <CommanderPanel
              playerName={myName}
              nations={myNations}
              currentNation={currentNation}
              onChangeNation={async (n) => {
                const prev = currentNation;
                setCurrentNation(n);
                saveCurrentNation(gameId, n);

                try {
                  if (!myPlayerId) throw new Error("Player not loaded");
                  await setCurrentNationDb(gameId, myPlayerId, n);
                } catch (e) {
                  setCurrentNation(prev ?? null);
                  setError(e instanceof Error ? e.message : "Failed to set current nation");
                }
              }}
            />
          </div>
        }
      />

      <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 p-6">
          <div className="text-xs tracking-[0.2em] uppercase text-zinc-400">In Session</div>
          <h1 className="mt-1 text-2xl font-semibold">{game?.scenario ?? "War Room"}</h1>

          <div className="mt-4 text-sm text-zinc-300 space-y-1">
            <div>Round: {game?.round ?? "—"}</div>
            <div>Phase: {game?.phase ?? "—"}</div>
            <div>Acting as: {currentNation ?? "—"}</div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-zinc-400 italic">
          Phase UI will appear here. Your actions are always issued as your selected nation.
        </div>
      </div>
    </main>
  );
}
