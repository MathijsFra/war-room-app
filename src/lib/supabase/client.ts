import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // This makes the problem obvious in production instead of “nothing happens”.
  throw new Error(
    "Missing Supabase env vars. NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is undefined at runtime."
  );
}

/**
 * IMPORTANT:
 * We use @supabase/ssr's createBrowserClient so auth is stored in cookies.
 * That allows Next.js middleware (server-side) to see the session and not
 * bounce users back to /sign-in after a successful client login.
 */
export const supabase = createBrowserClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
