"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/supabase/useSession";
import { joinGame } from "@/lib/db/joinGame";

export default function JoinGamePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading } = useSession();

  const [gameId, setGameId] = useState(searchParams.get("gameId") ?? "");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/sign-in");
    }
  }, [loading, session, router]);

  if (!loading && !session) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!gameId.trim()) {
      setError("Please enter a Game ID.");
      return;
    }
    if (!displayName.trim()) {
      setError("Please enter your name.");
      return;
    }

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
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold">Join Game</h1>
        <p className="mt-2 text-sm text-gray-600">
          Enter the Game ID shared by the host.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
            disabled={busy}
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
