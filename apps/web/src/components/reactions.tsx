"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { Users } from "lucide-react";
import type { ReactionType, Reactions as ReactionsData } from "@calci/shared";
import { toggleReaction } from "@/server/actions/squad";
import { NOTIFY_COPY, REACTIONS } from "@/lib/plain";

const ReactorsSheet = dynamic(() => import("./reactors-sheet").then((m) => m.ReactorsSheet), { ssr: false });

/**
 * Three toggleable reactions on a feed item or workout day; one of each per member. `id` is `<authorSub>~<eventId>`.
 * On your own items the counts show but cannot be pressed; tapping them opens who reacted (feature 022), and
 * elsewhere a people button does.
 */
export function Reactions({ id, reactions, canReact }: { id: string; reactions: ReactionsData; canReact: boolean }) {
  const [state, setState] = useState(reactions);
  const [error, setError] = useState(false);
  const [whoOpen, setWhoOpen] = useState(false);
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

  const total = state.fire.count + state.muscle.count + state.crown.count;
  const shown = canReact ? REACTIONS : REACTIONS.filter((t) => state[t.type].count > 0);
  if (shown.length === 0) return null;
  const sheet = whoOpen ? <ReactorsSheet id={id} open={whoOpen} onClose={() => setWhoOpen(false)} /> : null;

  if (!canReact) {
    return (
      <>
        <button
          type="button"
          onClick={() => setWhoOpen(true)}
          aria-label={`${NOTIFY_COPY.whoButton}: ${shown.map((t) => `${t.label} ${state[t.type].count}`).join(", ")}`}
          className="inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-1 rounded-md px-2 text-sm tabular-nums text-muted transition-colors duration-150 hover:bg-surface-2 active:bg-line active:duration-0"
        >
          {shown.map(({ type, emoji }) => (
            <span key={type} className="inline-flex items-center gap-1 px-1">
              <span aria-hidden>{emoji}</span>
              {state[type].count}
            </span>
          ))}
        </button>
        {sheet}
      </>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label={error ? "Reactions. Couldn't update, try again" : "Reactions"}>
      {shown.map(({ type, emoji, label }) => (
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
      ))}
      {total > 0 ? (
        <button
          type="button"
          onClick={() => setWhoOpen(true)}
          aria-label={NOTIFY_COPY.whoButton}
          className="grid min-h-11 min-w-11 shrink-0 touch-manipulation place-items-center rounded-md text-muted transition-colors duration-150 hover:text-ink active:bg-surface-2 active:duration-0"
        >
          <Users aria-hidden size={18} strokeWidth={1.75} />
        </button>
      ) : null}
      {sheet}
    </div>
  );
}
