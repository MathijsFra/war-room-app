"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import PhaseIndicator from "@/components/PhaseIndicator";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/lib/supabase/useSession";
import { loadLastGameId } from "@/lib/ui/lastGame";

type ResumeGame = {
  gameId: string;
  scenario: string;
  status: "LOBBY" | "ACTIVE" | "FINISHED";
  round: number;
  phase: string;
  createdAt: string;
  startedAt: string | null;
  myDisplayName: string;
  isHost: boolean;
};

export default function ResumePage() {
  const router = useRouter();
  const { session, loading } = useSession();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<ResumeGame[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/sign-in");
      return;
    }

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session]);

  const preferredGameId = useMemo(() => loadLastGameId(), []);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/sign-in");
  }

  async function load() {
    if (!session?.user?.id) return;
    setBusy(true);
    setError(null);

    try {
      // 1) Find games the current user is a player in.
      const { data: playerRows, error: pErr } = await supabase
        .from("players")
        .select("id, game_id, display_name, is_host")
        .eq("user_id", session.user.id);

      if (pErr) throw new Error(pErr.message);
      const gameIds = Array.from(new Set((playerRows ?? []).map((p) => p.game_id)));

      if (gameIds.length === 0) {
        setGames([]);
        return;
      }

      // 2) Load game metadata, only for LOBBY/ACTIVE games.
      const { data: gameRows, error: gErr } = await supabase
        .from("games")
        .select("id, scenario, status, round, phase, created_at, started_at")
        .in("id", gameIds)
        .in("status", ["LOBBY", "ACTIVE"]);

      if (gErr) throw new Error(gErr.message);

      const byGameId = new Map<string, { display_name: string; is_host: boolean }>();
      for (const p of playerRows ?? []) {
        byGameId.set(p.game_id, { display_name: p.display_name, is_host: p.is_host });
      }

      const merged: ResumeGame[] = (gameRows ?? []).map((g) => {
        const me = byGameId.get(g.id);
        return {
          gameId: g.id,
          scenario: g.scenario,
          status: g.status,
          round: g.round,
          phase: g.phase,
          createdAt: g.created_at,
          startedAt: g.started_at,
          myDisplayName: me?.display_name ?? "—",
          isHost: !!me?.is_host,
        };
      });

      // Sort: ACTIVE first, then by startedAt/createdAt desc.
      merged.sort((a, b) => {
        if (a.status !== b.status) return a.status === "ACTIVE" ? -1 : 1;
        const aTime = Date.parse(a.startedAt ?? a.createdAt);
        const bTime = Date.parse(b.startedAt ?? b.createdAt);
        return bTime - aTime;
      });

      setGames(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load active games");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;
  if (!session) return null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppHeader
        rightSlot={
          <button
            onClick={signOut}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 hover:border-amber-400/40 hover:text-amber-200"
          >
            Sign out
          </button>
        }
      />

      <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 p-6">
          <div className="text-xs tracking-[0.2em] uppercase text-zinc-400">Continue</div>
          <h1 className="mt-1 text-2xl font-semibold">Resume your session</h1>
          <p className="mt-2 text-sm text-zinc-300">
            If you closed a tab or refreshed, you can always rejoin any lobby or in-session game tied to this account.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Link
              className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-amber-400/30"
              href="/create-game"
            >
              <div className="font-medium">🎲 Create a game</div>
              <div className="text-sm text-zinc-400">Host a new War Room session.</div>
            </Link>

            <Link
              className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-amber-400/30"
              href="/join-game"
            >
              <div className="font-medium">🔗 Join a game</div>
              <div className="text-sm text-zinc-400">Enter a Game ID shared by the host.</div>
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs tracking-[0.2em] uppercase text-zinc-400">Your active games</div>
              <h2 className="mt-1 text-lg font-semibold">Lobby & In Session</h2>
            </div>

            <button
              onClick={load}
              className="rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-200 hover:border-amber-400/40 hover:text-amber-200 disabled:opacity-60"
              disabled={busy}
            >
              {busy ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {games.length === 0 ? (
            <div className="mt-6 text-sm text-zinc-400">
              No lobby or in-session games found for this account.
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {games.map((g) => {
                const href = g.status === "LOBBY" ? `/lobby/${g.gameId}` : `/game/${g.gameId}`;
                const isPreferred = preferredGameId && g.gameId === preferredGameId;
                return (
                  <Link
                    key={g.gameId}
                    href={href}
                    className={["rounded-2xl border bg-zinc-950/40 p-5 hover:border-amber-400/30", isPreferred ? "border-amber-400/40" : "border-white/10"].join(" ")}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-xs tracking-[0.18em] uppercase text-zinc-400">
                          {g.status === "ACTIVE" ? "In Session" : "Lobby"}{g.isHost ? " • Host" : ""}{isPreferred ? " • Last opened" : ""}
                        </div>
                        <div className="mt-1 text-lg font-semibold">{g.scenario}</div>
                        <div className="mt-1 text-sm text-zinc-400">
                          You: <span className="text-zinc-200">{g.myDisplayName}</span>
                        </div>
                        <div className="mt-2 text-xs text-zinc-500">
                          Game ID: <code className="rounded bg-white/5 px-2 py-1">{g.gameId}</code>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <PhaseIndicator status={g.status} round={g.round} phase={g.phase} />
                        <span className="text-xs text-amber-200">Open →</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
