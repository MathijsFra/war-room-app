"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/supabase/useSession";
import { supabase } from "@/lib/supabase/client";
import PlayersLobby from "@/components/PlayersLobby";
import type { LobbyGame, LobbyPlayer } from "@/lib/db/lobby";
import { fetchLobby, setPlayerNation } from "@/lib/db/lobby";

export default function LobbyPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();
  const { session, loading } = useSession();

  const [game, setGame] = useState<LobbyGame | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [meUserId, setMeUserId] = useState<string>("");
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/sign-in");
    }
  }, [loading, session, router]);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;

    (async () => {
      try {
        setError(null);
        const data = await fetchLobby(gameId);
        if (cancelled) return;
        setGame(data.game);
        setPlayers(data.players);
        setMeUserId(data.meUserId);
        setIsHost(data.isHost);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, gameId]);

  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel(`players:game:${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` },
        async () => {
          const { data, error } = await supabase
            .from("players")
            .select("id,game_id,user_id,display_name,is_host,nation")
            .eq("game_id", gameId)
            .order("created_at", { ascending: true });

          if (!error && data) setPlayers(data as LobbyPlayer[]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, gameId]);

  const joinLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join-game?gameId=${encodeURIComponent(gameId)}`;
  }, [gameId]);

  if (!loading && !session) return null;

  async function onSetNation(playerId: string, nation: string | null) {
    try {
      await setPlayerNation({ playerId, nation });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update nation");
    }
  }

  return (
    <main className="min-h-screen">
      <div className="space-y-6">
        <div className="rounded-2xl border p-5">
          <h1 className="text-2xl font-semibold">Lobby</h1>

          <div className="mt-3 grid gap-2 text-sm text-gray-700">
            <div>
              <span className="font-medium">Game ID:</span>{" "}
              <code className="rounded bg-gray-50 px-2 py-1">{gameId}</code>
            </div>

            <div>
              <span className="font-medium">Name:</span> {game?.name ?? "—"}
            </div>
            <div>
              <span className="font-medium">Scenario:</span> {game?.scenario ?? "—"}
            </div>

            <div className="pt-2">
              <div className="text-xs text-gray-600">Share link to join:</div>
              <input
                className="mt-1 w-full rounded-xl border p-3 text-sm"
                value={joinLink}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>

            {isHost ? (
              <div className="text-sm text-gray-600">
                You are the host. Assign nations below.
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                Waiting for host to assign nations.
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <PlayersLobby
          players={players}
          meUserId={meUserId}
          isHost={isHost}
          onSetNation={onSetNation}
        />
      </div>
    </main>
  );
}
