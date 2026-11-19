"use client";

import { useState, useTransition } from "react";
import type { ReactionType, Reactions as ReactionsData } from "@calci/shared";
import { toggleReaction } from "@/server/actions/squad";

// Emoji are fine here: they are the members' own reactions, not UI icons (feature 013).
const TYPES: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "fire", emoji: "🔥", label: "Fire" },
  { type: "muscle", emoji: "💪", label: "Strong" },
  { type: "crown", emoji: "👑", label: "Crown" },
];

/**
 * Three toggleable reactions on a feed item or workout day; one of each per member. `id` is `<authorSub>~<eventId>`.
 * On your own items the counts show but cannot be pressed.
 */
export function Reactions({ id, reactions, canReact }: { id: string; reactions: ReactionsData; canReact: boolean }) {
  const [state, setState] = useState(reactions);
  const [error, setError] = useState(false);
  const [, startTransition] = useTransition();

  const toggle = (type: ReactionType) => {
    const before = state;
    const on = !state[type].mine;
    setError(false);
    setState({ ...state, [type]: { mine: on, count: Math.max(0, state[type].count + (on ? 1 : -1)) } });
    startTransition(async () => {
      const r = await toggleReaction(id, type, on);
      if (r.ok) setState(r.reactions);
      else {
        setState(before);
        setError(true);
      }
    });
  };

  const shown = canReact ? TYPES : TYPES.filter((t) => state[t.type].count > 0);
  if (shown.length === 0) return null;
  return (
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label={error ? "Reactions. Couldn't update, try again" : "Reactions"}>
      {shown.map(({ type, emoji, label }) =>
        canReact ? (
          <button
            key={type}
            type="button"
            onClick={() => toggle(type)}
            aria-pressed={state[type].mine}
            aria-label={`${label}, ${state[type].count}`}
            className={`inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center gap-1 rounded-md border px-2 text-sm font-medium tabular-nums transition-colors duration-150 active:duration-0 ${
              state[type].mine ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-muted hover:bg-surface-2 active:bg-line"
            }`}
          >
            <span aria-hidden>{emoji}</span>
            {state[type].count > 0 ? state[type].count : null}
          </button>
        ) : (
          <span key={type} className="inline-flex items-center gap-1 px-1 text-sm tabular-nums text-muted" aria-label={`${label}, ${state[type].count}`}>
            <span aria-hidden>{emoji}</span>
            {state[type].count}
          </span>
        ),
      )}
    </div>
  );
}
