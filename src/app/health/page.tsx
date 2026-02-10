"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/lib/supabase/useSession";
import { useRouter } from "next/navigation";

export default function HealthPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [result, setResult] = useState<string>("Running…");

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/sign-in");
      return;
    }

    if (!session) return;

    supabase
      .from("regions")
      .select("id,name,status")
      .limit(1)
      .then(({ data, error }) => {
        if (error) setResult(`❌ Error: ${error.message}`);
        else setResult(`✅ OK. regions rows fetched: ${data?.length ?? 0}`);
      });
  }, [loading, session, router]);

  if (!loading && !session) return null;

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold">Health Check</h1>
      <p className="mt-4">{result}</p>
    </main>
  );
}
