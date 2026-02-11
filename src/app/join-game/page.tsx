import { Suspense } from "react";
import JoinGameClient from "./JoinGameClient";

// NOTE:
// Next.js requires useSearchParams() to be rendered under a <Suspense> boundary.
// By keeping this page as a Server Component and moving the hook into a Client
// Component, Vercel/Next can prerender the route without failing the build.

export default function JoinGamePage() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <JoinGameClient />
    </Suspense>
  );
}
