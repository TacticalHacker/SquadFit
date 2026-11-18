"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Hand } from "lucide-react";
import type { SquadFeedItem } from "@calci/shared";
import { toggleHighFive } from "@/server/actions/squad";
import Link from "next/link";
import { Avatar } from "./avatar";
import { noticeErrorClass } from "./form-bits";

const nf = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const shortDate = (d: string) =>
  new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

function sentence(i: SquadFeedItem): string {
  const name = i.member.displayName;
  if (i.kind === "pr" && i.pr) {
    const e = i.pr.e1rm !== null ? ` (e1RM ${nf.format(i.pr.e1rm)} kg)` : "";
    return `${name} hit a ${i.pr.exerciseName} PR: ${nf.format(i.pr.weightKg)} kg × ${i.pr.reps}${e}`;
  }
  if (i.kind === "protein_streak") return `${name} hit their protein target 7 days in a row`;
  if (i.kind === "streak_week") return `${name} completed week ${i.week} of their streak`;
  return `${name} logged their first workout`;
}

/** The last 20 squad events with one toggleable high-five per member (feature 010, FR-027–FR-029). */
export function SquadFeed({ items }: { items: SquadFeedItem[] }) {
  const [list, apply] = useOptimistic(items, (state, change: { id: string; on: boolean }) =>
    state.map((i) => (i.id === change.id ? { ...i, highFivedByMe: change.on, highFives: Math.max(0, i.highFives + (change.on ? 1 : -1)) } : i)),
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (item: SquadFeedItem) => {
    const on = !item.highFivedByMe;
    setError(null);
    startTransition(async () => {
      apply({ id: item.id, on });
      const r = await toggleHighFive(item.id, on);
      if (!r.ok) setError("Couldn't update the high-five. Try again.");
    });
  };

  if (list.length === 0) {
    return <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">Nothing yet. Log a workout to get things going.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className={noticeErrorClass}>
          {error}
        </p>
      ) : null}
      <ul aria-label="Squad activity" className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-card">
        {list.map((i) => (
          <li key={i.id} className="flex items-center gap-3 px-3 py-3">
            <Link href={`/squad/${i.member.userId}`} aria-label={`${i.member.displayName}'s profile`} className="shrink-0">
              <Avatar displayName={i.member.displayName} avatarUrl={i.member.avatarUrl} size={36} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">
                <Link href={`/squad/${i.member.userId}`} className="font-medium underline-offset-4 hover:underline">
                  {i.member.displayName}
                </Link>
                {sentence(i).slice(i.member.displayName.length)}
              </p>
              <p className="text-xs text-muted">{shortDate(i.date)}</p>
            </div>
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-pressed={i.highFivedByMe}
              aria-label={`High-five, ${i.highFives} so far`}
              className={`inline-flex min-h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-md border px-2.5 text-sm font-medium tabular-nums transition-colors duration-150 active:duration-0 ${
                i.highFivedByMe ? "border-accent bg-accent-soft text-accent" : "border-line-strong bg-surface text-muted hover:bg-surface-2 active:bg-line"
              }`}
            >
              <Hand aria-hidden size={16} strokeWidth={1.75} />
              {i.highFives}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
