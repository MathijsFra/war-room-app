import { Suspense } from "react";
import SignInClient from "./SignInClient";

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-6">Loading…</div>}>
      <SignInClient />
    </Suspense>
  );
}
