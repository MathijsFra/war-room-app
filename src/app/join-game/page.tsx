"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/supabase/useSession";
import { joinGame } from "@/lib/db/joinGame";
import { getJoinInfo, type JoinInfo } from "@/lib/db/joinInfo";

export default function JoinGamePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading } = useSession();

  const [gameId, setGameId] = useState(searchParams.get("gameId") ?? "");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<JoinInfo | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace("/sign-in");
  }, [loading, session, router]);

  useEffect(() => {
    setInfo(null);
    setError(null);
    const id = gameId.trim();
    if (!id) return;

    // Fetch join info (works even if you're not a member yet)
    getJoinInfo(id)
      .then(setInfo)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to check game"));
  }, [gameId]);

  if (!loading && !session) return null;

  const canJoin = info?.ok === true;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!gameId.trim()) return setError("Please enter a Game ID.");
    if (!displayName.trim()) return setError("Please enter your name.");

    setBusy(true);
    try {
      const id = await joinGame({ gameId, displayName });
      router.push(`/lobby/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold">Join Game</h1>
        <p className="text-sm text-gray-600">
          Enter the Game ID shared by the host.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Game ID</label>
            <input
              className="mt-1 w-full rounded-xl border p-3"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              required
            />
          </div>

          {info && (
            <div className="rounded-2xl border p-4 text-sm">
              {info.ok ? (
                <div className="text-green-700">
                  ✅ Joinable — {info.current}/{info.max} players
                </div>
              ) : (
                <div className="text-red-700">
                  ❌ Not joinable — {info.reason}
                  {typeof info.current === "number" && typeof info.max === "number"
                    ? ` (${info.current}/${info.max})`
                    : ""}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium">Your name</label>
            <input
              className="mt-1 w-full rounded-xl border p-3"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Mathijs"
              required
            />
          </div>

          <button
            type="submit"
            disabled={busy || !canJoin}
            className="rounded-xl bg-black text-white px-5 py-3 font-medium disabled:opacity-60"
          >
            {busy ? "Joining…" : "Join"}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </div>
    </main>
  );
}
