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

  const [nationPhaseStatusByNation, setNationPhaseStatusByNation] = useState<Record<string, string>>({});

  const refreshingRef = useRef(false);
  const committingRef = useRef(false);
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

      // Always trust DB: this must reflect nation_phase_state after refresh
      setNationPhaseStatusByNation(data.nationPhaseStatusByNation);

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

    try {
      await setCurrentNationDb(gameId, myPlayerId, nation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set current nation");
    }
  }

  async function onToggleCommit() {
    if (!game || !currentNation) return;
    if (committingRef.current) return;

    // Commits are always scoped to the current round + phase in the DB.
    if (game.status !== "ACTIVE") return;

    const key = normalizeNationKey(currentNation);
    const status = nationPhaseStatusByNation[key] ?? "DRAFT";
    if (status === "LOCKED") return;

    committingRef.current = true;
    try {
      setError(null);
      if (status === "COMMITTED") {
        await uncommitCurrentPhase(gameId, currentNation);
      } else {
        await commitCurrentPhase(gameId, currentNation);
      }
      await refreshGame(); // reload from DB (truth)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update commit status");
    } finally {
      committingRef.current = false;
    }
  }

  if (!loading && !session) return null;
  if (!session) return null;

  const actingKey = currentNation ? normalizeNationKey(currentNation) : "";
  const currentStatus = actingKey ? nationPhaseStatusByNation[actingKey] ?? "DRAFT" : "DRAFT";
  const canCommit = !!currentNation && game?.status === "ACTIVE";

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
                        ? `Uncommit ${game?.phase ?? "PHASE"} (${currentNation})`
                        : currentStatus === "LOCKED"
                          ? `Locked for ${game?.phase ?? "PHASE"} (${currentNation})`
                          : `Commit ${game?.phase ?? "PHASE"} (${currentNation})`
                    }
                  >
                    {currentStatus === "COMMITTED" ? "Committed" : currentStatus === "LOCKED" ? "Locked" : "Commit"}
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

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-zinc-300">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">In Session</div>
          <div className="mt-2 text-sm">
            <div>Scenario: {game?.scenario ?? "—"}</div>
            <div>Round: {game?.round ?? "—"}</div>
            <div>Phase: {game?.phase ?? "—"}</div>
            <div>Acting as: {currentNation ?? "—"}</div>
            <div>Status (this nation): {currentStatus}</div>
          </div>
        </div>

        <PhaseWorkbench phase={game?.phase ?? null} round={game?.round ?? null} actingNation={currentNation} />
      </div>
    </main>
  );
}
