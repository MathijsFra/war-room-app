"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "password" | "magic";

export default function SignInClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialMode = useMemo<Mode>(() => {
    const m = searchParams.get("mode");
    return m === "magic" ? "magic" : "password";
  }, [searchParams]);

  const [mode, setMode] = useState<Mode>(initialMode);


  const nextParam = useMemo(() => {
    const raw = searchParams.get("next");
    if (!raw) return null;
    try {
      const decoded = decodeURIComponent(raw);
      // basic open-redirect protection: only allow local paths
      if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;
      return decoded;
    } catch {
      return null;
    }
  }, [searchParams]);

  // password form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // magic link form
  const [magicEmail, setMagicEmail] = useState("");

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(nextParam ?? "/");
    });
  }, [router]);

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setBusy(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    router.replace(nextParam ?? "/");
  }

  async function signUpWithPassword() {
    setBusy(true);
    setStatus(null);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setBusy(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Account created. If email confirmations are enabled, check your email to confirm.");
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: magicEmail.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setBusy(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Check your email for the sign-in link.");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-gray-600">
          Use password login for development (no email rate limits). Magic links also supported.
        </p>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("password")}
            className={`flex-1 rounded-xl border px-4 py-2 text-sm ${
              mode === "password" ? "bg-gray-50 font-medium" : "hover:bg-gray-50"
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setMode("magic")}
            className={`flex-1 rounded-xl border px-4 py-2 text-sm ${
              mode === "magic" ? "bg-gray-50 font-medium" : "hover:bg-gray-50"
            }`}
          >
            Magic link
          </button>
        </div>

        {mode === "password" ? (
          <div className="mt-6 space-y-4">
            <form className="space-y-4" onSubmit={signInWithPassword}>
              <div>
                <label className="block text-sm font-medium">Email</label>
                <input
                  className="mt-1 w-full rounded-xl border p-3"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Password</label>
                <input
                  className="mt-1 w-full rounded-xl border p-3"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                className="w-full rounded-xl bg-black text-white p-3 font-medium disabled:opacity-60"
                type="submit"
                disabled={busy}
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="border-t pt-4">
              <button
                className="w-full rounded-xl border p-3 text-sm hover:bg-gray-50 disabled:opacity-60"
                onClick={signUpWithPassword}
                disabled={busy || !email.trim() || !password}
                type="button"
              >
                {busy ? "Working…" : "Create account (sign up)"}
              </button>

              <p className="mt-2 text-xs text-gray-600">
                Tip: for fastest local testing, create a user in Supabase Auth → Users and set a password.
              </p>
            </div>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={sendMagicLink}>
            <div>
              <label className="block text-sm font-medium">Email</label>
              <input
                className="mt-1 w-full rounded-xl border p-3"
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </div>

            <button
              className="w-full rounded-xl bg-black text-white p-3 font-medium disabled:opacity-60"
              type="submit"
              disabled={busy}
            >
              {busy ? "Sending…" : "Send magic link"}
            </button>
          </form>
        )}

        {status && <p className="mt-4 text-sm">{status}</p>}
      </div>
    </main>
  );
}
