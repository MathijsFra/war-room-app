"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/supabase/useSession";

export default function LobbyPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();
  const { session, loading } = useSession();

  if (!loading && !session) {
    router.replace("/sign-in");
    return null;
  }

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold">Lobby</h1>
      <p className="mt-2 text-sm text-gray-600">
        Game ID: <code>{gameId}</code>
      </p>
      <p className="mt-6">
        Next: show player list, shareable join code/link, and nation assignment.
      </p>
    </main>
  );
}
