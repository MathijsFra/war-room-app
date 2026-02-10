"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/supabase/useSession";

export default function SignInPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  if (!loading && session) {
    router.replace("/");
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // after clicking the email link, send user here
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (error) setStatus(error.message);
    else setStatus("Check your email for the sign-in link.");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-gray-600">
          Use an email magic link (great for phone/tablet at the table).
        </p>

        <form className="mt-6 space-y-4" onSubmit={sendMagicLink}>
          <label className="block text-sm font-medium">Email</label>
          <input
            className="w-full rounded-xl border p-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="you@example.com"
            required
          />
          <button
            className="w-full rounded-xl bg-black text-white p-3 font-medium"
            type="submit"
          >
            Send magic link
          </button>
        </form>

        {status && <p className="mt-4 text-sm">{status}</p>}
      </div>
    </main>
  );
}
