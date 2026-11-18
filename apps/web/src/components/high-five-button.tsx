"use client";

import { useState, useTransition } from "react";
import { Hand } from "lucide-react";
import { toggleHighFive } from "@/server/actions/squad";

/** One toggleable high-five (feature 010/011). `id` is `<authorSub>~<eventId>`. Your own items show the count only. */
export function HighFiveButton({ id, count, mine, canHighFive }: { id: string; count: number; mine: boolean; canHighFive: boolean }) {
  const [state, setState] = useState({ count, mine });
  const [error, setError] = useState(false);
  const [, startTransition] = useTransition();

  if (!canHighFive) {
    return count > 0 ? (
      <span className="inline-flex items-center gap-1.5 text-sm tabular-nums text-muted">
        <Hand aria-hidden size={16} strokeWidth={1.75} />
        {count}
      </span>
    ) : null;
  }
  const toggle = () => {
    const on = !state.mine;
    const before = state;
    setError(false);
    setState({ mine: on, count: Math.max(0, state.count + (on ? 1 : -1)) });
    startTransition(async () => {
      const r = await toggleHighFive(id, on);
      if (!r.ok) {
        setState(before);
        setError(true);
      }
    });
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={state.mine}
      aria-label={`High-five, ${state.count} so far${error ? ". Couldn't update, try again" : ""}`}
      className={`inline-flex min-h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-md border px-2.5 text-sm font-medium tabular-nums transition-colors duration-150 active:duration-0 ${
        state.mine ? "border-accent bg-accent-soft text-accent" : "border-line-strong bg-surface text-muted hover:bg-surface-2 active:bg-line"
      }`}
    >
      <Hand aria-hidden size={16} strokeWidth={1.75} />
      {state.count}
    </button>
  );
}
