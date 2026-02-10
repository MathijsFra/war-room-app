"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/lib/supabase/useSession";

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading } = useSession();

  const showHeader =
    pathname !== "/sign-in" && !pathname.startsWith("/auth/callback");

  const showBack = pathname !== "/";

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/sign-in");
  }

  if (!showHeader) return null;

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-semibold">
            War Room Companion
          </Link>

          {showBack && (
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
              aria-label="Go back"
            >
              ← Back
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!loading && session ? (
            <button
              onClick={signOut}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/sign-in"
              className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
