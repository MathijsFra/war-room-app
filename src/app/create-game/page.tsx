"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/supabase/useSession";
import { createGame } from "@/lib/db/createGame";

const SCENARIOS = [
  "Global War",
  "War in Europe",
  "War in the Pacific",
  "The Eastern Front",
  "North Africa",
] as const;

export default function CreateGamePage() {
  const router = useRouter();
  const { session, loading } = useSession();

  const [displayName, setDisplayName] = useState("");
  const [gameName, setGameName] = useState("War Room Night");
  const [scenario, setScenario] = useState<(typeof SCENARIOS)[number]>("Global War");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && !session) {
    router.replace("/sign-in");
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError("Please enter your player name.");
      return;
    }
    if (!gameName.trim()) {
      setError("Please enter a game name.");
      return;
    }

    setBusy(true);
    try {
      const gameId = await createGame({
        name: gameName,
        scenario,
        displayName,
      });
      router.push(`/lobby/${gameId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold">Create Game</h1>
        <p className="mt-2 text-sm text-gray-600">
          This creates a new game session in Supabase and registers you as the host.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
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

          <div>
            <label className="block text-sm font-medium">Game name</label>
            <input
              className="mt-1 w-full rounded-xl border p-3"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="War Room Night"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Scenario</label>
            <select
              className="mt-1 w-full rounded-xl border p-3"
              value={scenario}
              onChange={(e) => setScenario(e.target.value as any)}
            >
              {SCENARIOS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-black text-white px-5 py-3 font-medium disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create"}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </div>
    </main>
  );
}
