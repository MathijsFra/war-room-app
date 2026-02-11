"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/lib/supabase/useSession";

import AppHeader from "@/components/AppHeader";
import PhaseIndicator from "@/components/PhaseIndicator";
import PlayersLobby from "@/components/PlayersLobby";
import CommanderPanel from "@/components/CommanderPanel";

import {
  fetchLobby,
  assignNation,
  setMaxPlayers,
  startGame,
  setCurrentNation as setCurrentNationDb,
} from "@/lib/db/lobby";

import type { LobbyGame, LobbyPlayer, LobbyState } from "@/lib/db/lobby";
import { loadCurrentNation, saveCurrentNation } from "@/lib/ui/currentNation";
import { saveLastGameId } from "@/lib/ui/lastGame";

export default function LobbyPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();
  const { session, loading } = useSession();

  const [game, setGame] = useState<LobbyGame | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [nationsByPlayerId, setNationsByPlayerId] = useState<Record<string, string[]>>({});
  const [assignedNations, setAssignedNations] = useState<string[]>([]);
  const [meUserId, setMeUserId] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Commander panel state
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [myName, setMyName] = useState("—");
  const [myNations, setMyNations] = useState<string[]>([]);
  const [currentNation, setCurrentNation] = useState<string | null>(null);

  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!loading && !session) router.replace("/sign-in");
  }, [loading, session, router]);

  async function refreshLobby() {
    if (!session || refreshingRef.current) return;
    refreshingRef.current = true;

    try {
      setError(null);

      const data: LobbyState = await fetchLobby(gameId);

      setGame(data.game);
      setPlayers(data.players);
      setNationsByPlayerId(data.nationsByPlayerId);
      setAssignedNations(data.assignedNations);
      setMeUserId(data.meUserId);
      setIsHost(data.isHost);

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

      if (data.game.status !== "LOBBY") {
        router.replace(`/game/${gameId}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh lobby");
    } finally {
      refreshingRef.current = false;
    }
  }

  useEffect(() => {
    // Remember the most recent game so we can resume after closing a tab.
    saveLastGameId(gameId);
    refreshLobby();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, gameId]);

  // Realtime subscriptions
  useEffect(() => {
    if (!session) return;

    const subs = [
      supabase.channel(`rt:games:${gameId}`).on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        refreshLobby
      ),
      supabase.channel(`rt:players:${gameId}`).on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` },
        refreshLobby
      ),
      supabase.channel(`rt:player_nations:${gameId}`).on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_nations", filter: `game_id=eq.${gameId}` },
        refreshLobby
      ),
    ];

    subs.forEach((c) => c.subscribe());
    return () => subs.forEach((c) => supabase.removeChannel(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, gameId]);

  // Polling fallback
  useEffect(() => {
    if (!session) return;
    const id = window.setInterval(() => refreshLobby(), 2000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, gameId]);

  const joinLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join-game?gameId=${encodeURIComponent(gameId)}`;
  }, [gameId]);

  async function onAssignNation(playerId: string, nation: string) {
    try {
      await assignNation({ gameId, playerId, nation });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nation assignment failed");
    }
  }

  async function onUnassignNation(playerId: string, nation: string) {
    try {
      const { error } = await supabase
        .from("player_nations")
        .delete()
        .eq("game_id", gameId)
        .eq("player_id", playerId)
        .eq("nation", nation);

      if (error) throw new Error(error.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unassign failed");
    }
  }

  async function onSetMaxPlayers(v: number) {
    try {
      await setMaxPlayers(gameId, v);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update max players");
    }
  }

  async function onStartGame() {
    try {
      await startGame(gameId);
      router.replace(`/game/${gameId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start game");
    }
  }

  if (!loading && !session) return null;
  if (!session) return null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppHeader
        rightSlot={
          <div className="flex items-center gap-3">
            <PhaseIndicator status={game?.status} round={game?.round} phase={game?.phase} />

            <CommanderPanel
              playerName={myName}
              nations={myNations}
              currentNation={currentNation}
              onChangeNation={async (n) => {
                // optimistic UI
                const prev = currentNation;
                setCurrentNation(n);
                saveCurrentNation(gameId, n);

                try {
                  if (!myPlayerId) throw new Error("Player not loaded");
                  await setCurrentNationDb(gameId, myPlayerId, n);
                } catch (e) {
                  // revert on strict DB failure (not your nation, RLS, etc.)
                  setCurrentNation(prev ?? null);
                  setError(e instanceof Error ? e.message : "Failed to set current nation");
                }
              }}
            />
          </div>
        }
      />

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
            <div>
              <div className="text-xs tracking-[0.2em] uppercase text-zinc-400">
                Lobby
              </div>
              <h1 className="mt-1 text-2xl font-semibold">
                {game?.scenario ?? "Scenario"}
              </h1>

              <div className="mt-3 text-sm text-zinc-300 space-y-1">
                <div>
                  Players: {players.length} / {game?.max_players ?? "—"}
                </div>
                <div>
                  Game ID:{" "}
                  <code className="bg-white/5 px-2 py-1 rounded">{gameId}</code>
                </div>
              </div>
            </div>

            {isHost && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                <label className="block text-xs text-zinc-400">Max players</label>
                <select
                  className="w-full rounded bg-zinc-950 border border-white/10 p-2 text-sm"
                  value={game?.max_players ?? 1}
                  onChange={(e) => onSetMaxPlayers(Number(e.target.value))}
                >
                  {Array.from({ length: 6 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>

                <button
                  onClick={onStartGame}
                  className="w-full rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950"
                >
                  Start Game
                </button>
              </div>
            )}
          </div>

          <div className="mt-4">
            <label className="text-xs text-zinc-400">Invite link</label>
            <input
              readOnly
              value={joinLink}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-1 w-full rounded bg-zinc-950 border border-white/10 p-2 text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <PlayersLobby
          players={players}
          meUserId={meUserId}
          isHost={isHost}
          nationsByPlayerId={nationsByPlayerId}
          assignedNations={assignedNations}
          onAssignNation={onAssignNation}
          onUnassignNation={onUnassignNation}
        />
      </div>
    </main>
  );
}
