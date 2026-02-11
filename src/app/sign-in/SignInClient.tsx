"use client";

import React, { useEffect, useMemo, useState } from "react";
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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  function go(to: string) {
    // Hard navigation is the most reliable after auth in production.
    // It also ensures /resume loads fresh and reads the persisted session.
    if (typeof window !== "undefined") window.location.assign(to);
    else router.replace(to);
  }

  useEffect(() => {
    let unsub: { data: { subscription: { unsubscribe: () => void } } } | null =
      null;

    (async () => {
      // If the user is already signed in, send them onward.
      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session) {
        go(nextParam ?? "/resume");
      }
    })();

    // Redirect as soon as Supabase confirms sign-in.
    unsub = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        go(nextParam ?? "/resume");
      }
    });

    return () => {
      try {
        unsub?.data.subscription.unsubscribe();
      } catch {
        // ignore
      }
    };
  }, [nextParam]); // intentionally not depending on router/go to avoid re-subscribing loops

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

      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      // Some production builds can be slow to emit the auth event;
      // redirect immediately when sign-in succeeded.
      go(nextParam ?? "/resume");
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

        <button
          type="button"
          disabled={busy}
          onClick={() => go("/resume")}
          className="rounded-md border px-4 py-2 disabled:opacity-50"
        >
          Continue without signing in
        </button>
      </form>

      <p className="text-xs text-muted-foreground">
        After signing in you should be redirected to{" "}
        <code className="rounded bg-gray-100 px-1 py-0.5">/resume</code>
        {nextParam ? (
          <>
            {" "}
            (or back to{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5">{nextParam}</code>)
          </>
        ) : null}
        .
      </p>
    </div>
  );
}
