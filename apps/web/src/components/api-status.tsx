"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";

type State = { kind: "loading" } | { kind: "ok"; stage: string } | { kind: "error"; message: string };

export function ApiStatus() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    getHealth()
      .then((h) => setState({ kind: "ok", stage: h.stage }))
      .catch((e: unknown) => setState({ kind: "error", message: e instanceof Error ? e.message : String(e) }));
  }, []);

  if (state.kind === "loading") return <p className="text-sm text-zinc-500">Checking API…</p>;
  if (state.kind === "error") return <p className="text-sm text-red-600">API unreachable: {state.message}</p>;
  return <p className="text-sm text-emerald-600">API healthy · stage {state.stage}</p>;
}
