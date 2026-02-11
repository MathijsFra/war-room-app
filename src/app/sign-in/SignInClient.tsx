"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

function isSafeNextPath(nextPath: string | null): nextPath is string {
  if (!nextPath) return false;
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
  const [mode, setMode] = useState<"signin" | "signup" | "magic">("signin");

  // Prevent any redirect loops / double redirects
  const didRedirect = useRef(false);
  const safeReplace = (to: string) => {
    if (didRedirect.current) return;
    didRedirect.current = true;
    router.replace(to);
  };

  useEffect(() => {
    let alive = true;

    // If already signed in, go to target
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!alive) return;
        if (!error && data.session) safeReplace(target);
      } catch (e) {
        if (alive) {
          setStatus(e instanceof Error ? e.message : "Failed to read session.");
        }
      }
    })();

    // Redirect on SIGNED_IN only (avoid TOKEN_REFRESHED loops)
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

  async function signInWithPassword(e: React.FormEvent) {
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

      // If session is present immediately, redirect right away
      if (data.session) safeReplace(target);
      else setStatus("Signed in. Redirecting…");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function signUpWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setBusy(true);

    try {
      const trimmedEmail = email.trim();
      if (!trimmedEmail || !password) {
        setStatus("Please enter email and password.");
        return;
      }

      // IMPORTANT: email confirmations may be enabled in Supabase.
      // If enabled, the user must confirm before they can sign in.
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          // If your project sends confirmation emails, this is where
          // the user will be returned after clicking the email link.
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}${target}`
              : undefined,
        },
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      // If confirmations are OFF, you may get a session right away.
      if (data.session) {
        safeReplace(target);
      } else {
        setStatus(
          "Account created. Check your email to confirm your account, then sign in."
        );
        setMode("signin");
        setPassword("");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Sign-up failed.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setBusy(true);

    try {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        setStatus("Please enter your email.");
        return;
      }

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}${target}`
          : undefined;

      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true, // lets new users create via magic link
        },
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus("Magic link sent! Check your email to finish signing in.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to send magic link."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>

      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded-md border px-3 py-1 text-sm ${
            mode === "signin" ? "bg-gray-100" : ""
          }`}
          onClick={() => {
            setStatus(null);
            setMode("signin");
          }}
          disabled={busy}
        >
          Password
        </button>
        <button
          type="button"
          className={`rounded-md border px-3 py-1 text-sm ${
            mode === "magic" ? "bg-gray-100" : ""
          }`}
          onClick={() => {
            setStatus(null);
            setMode("magic");
          }}
          disabled={busy}
        >
          Magic link
        </button>
        <button
          type="button"
          className={`rounded-md border px-3 py-1 text-sm ${
            mode === "signup" ? "bg-gray-100" : ""
          }`}
          onClick={() => {
            setStatus(null);
            setMode("signup");
          }}
          disabled={busy}
        >
          Create account
        </button>
      </div>

      {status ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {status}
        </div>
      ) : null}

      <form
        onSubmit={
          mode === "signin"
            ? signInWithPassword
            : mode === "signup"
              ? signUpWithPassword
              : sendMagicLink
        }
        className="flex flex-col gap-3"
      >
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

        {mode !== "magic" ? (
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Password</span>
            <input
              className="rounded-md border px-3 py-2"
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              required
            />
          </label>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {busy
            ? "Working…"
            : mode === "signin"
              ? "Sign in"
              : mode === "signup"
                ? "Create account"
                : "Send magic link"}
        </button>
      </form>

      <p className="text-xs text-muted-foreground">
        After signing in you’ll be redirected to{" "}
        <code className="rounded bg-gray-100 px-1 py-0.5">{target}</code>.
      </p>
    </div>
  );
}
