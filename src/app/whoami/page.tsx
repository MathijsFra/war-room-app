"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function WhoAmIPage() {
  const [out, setOut] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("whoami");
      if (error) setOut({ error: error.message, details: error });
      else setOut(data);
    })();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>whoami()</h1>
      <pre>{JSON.stringify(out, null, 2)}</pre>
    </main>
  );
}
