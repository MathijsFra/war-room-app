"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

function isSafeNextPath(nextPath: string | null): nextPath is string {
  if (!nextPath) return false;
  // Only allow internal relative paths to avoid open redirects.
  return nextPath.startsWith("/") && !nextPath.startsWith("//");
}

export default function SignInClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextParam = useMemo(() => {
    const n = searchParams.get("next");
    return isSafeNextPath(n) ? n : null;
  }, [searchParams]);

  const target = nextParam ?? "/resume";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Prevent redirect loops in production (auth init can emit events multiple times).
  const didRedirect = useRef(false);

  const safeReplace = (to: string) => {
    if (didRedirect.current) return;
    didRedirect.current = true;
    router.replace(to);
  };

  useEffect(() => {
    let alive = true;

    // 1) If already signed in, go to target once (SPA navigation, no reload).
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!alive) return;

        if (!error && data.session) {
          safeReplace(target);
        }
      } catch (e) {
        // Show something instead of silently failing
        if (alive) {
          setStatus(e instanceof Error ? e.message : "Failed to read session.");
        }
      }
    })();

    // 2) Redirect only on SIGNED_IN (NOT TOKEN_REFRESHED).
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session && !didRedirect.current) {
        safeReplace(target);
      }
    });

    return () => {
      alive = false;
      try {
        sub.subscription.unsubscribe();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setBusy(true);

    try {
      const trimmedEmail = email.trim();

      if (!trimmedEmail || !password) {
        setStatus("Please enter email and password.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      // If session is present right away, do a hard navigation ONCE.
      // This avoids edge cases where some pages read session only on first load.
      if (data.session) {
        if (!didRedirect.current) {
          didRedirect.current = true;
          window.location.href = target;
        }
      } else {
        // Otherwise, rely on the SIGNED_IN event to navigate.
        setStatus("Signed in. Redirecting…");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>

      {status ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {status}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Email</span>
          <input
            className="rounded-md border px-3 py-2"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Password</span>
          <input
            className="rounded-md border px-3 py-2"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            required
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-xs text-muted-foreground">
        After signing in you should be redirected to{" "}
        <code className="rounded bg-gray-100 px-1 py-0.5">{target}</code>.
      </p>
    </div>
  );
}
