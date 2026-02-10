"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/lib/supabase/useSession";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const { session, loading } = useSession();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/sign-in");
  }

  if (loading) return <div className="p-6">Loading…</div>;

  if (!session) {
    router.replace("/sign-in");
    return null;
  }

  return (
    <main className="min-h-screen p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">War Room Companion</h1>
        <button className="rounded-xl border px-4 py-2" onClick={signOut}>
          Sign out
        </button>
      </header>

      <section className="mt-8 grid gap-4 max-w-xl">
        <Link className="rounded-2xl border p-5 hover:bg-gray-50" href="/create-game">
          <div className="font-medium">🎲 Create a game</div>
          <div className="text-sm text-gray-600">Host a new War Room session.</div>
        </Link>

        <Link className="rounded-2xl border p-5 hover:bg-gray-50" href="/health">
          <div className="font-medium">✅ Supabase health check</div>
          <div className="text-sm text-gray-600">
            Confirms you can read data as an authenticated user.
          </div>
        </Link>

        <div className="rounded-2xl border p-5 text-sm text-gray-600">
          Next screens to build: Join Game, Lobby (players), Planning (O&P).
        </div>
      </section>
    </main>
  );
}
