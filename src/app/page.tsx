"use client";

import { useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/lib/supabase/useSession";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const { session, loading } = useSession();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/sign-in");
    }
  }, [loading, session, router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/sign-in");
  }

  if (!loading && !session) return null;

  return (
    <main className="min-h-screen">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Menu</h1>
          <button
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            onClick={signOut}
          >
            Sign out
          </button>
        </div>

        <div className="grid gap-4 max-w-xl">
          <Link className="rounded-2xl border p-5 hover:bg-gray-50" href="/create-game">
            <div className="font-medium">🎲 Create a game</div>
            <div className="text-sm text-gray-600">Host a new War Room session.</div>
          </Link>

          <Link className="rounded-2xl border p-5 hover:bg-gray-50" href="/join-game">
            <div className="font-medium">🔗 Join a game</div>
            <div className="text-sm text-gray-600">Enter a Game ID shared by the host.</div>
          </Link>

          <Link className="rounded-2xl border p-5 hover:bg-gray-50" href="/health">
            <div className="font-medium">✅ Health check</div>
            <div className="text-sm text-gray-600">Verify auth + DB access.</div>
          </Link>
        </div>
      </div>
    </main>
  );
}
