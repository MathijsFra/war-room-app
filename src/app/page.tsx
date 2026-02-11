"use client";

import { useEffect } from "react";
import { useSession } from "@/lib/supabase/useSession";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const { session, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace(`/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    // Authenticated users should always be able to resume their most recent
    // lobby/game even after closing the tab.
    router.replace("/resume");
  }, [loading, session, router]);

  if (loading) return null;
  if (!session) return null;

  // We immediately redirect authenticated users to /resume.
  return null;
}
