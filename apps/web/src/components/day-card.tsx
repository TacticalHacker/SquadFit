"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Trophy } from "lucide-react";
import type { DayCard as DayCardData, DayLog } from "@calci/shared";
import { loadDay } from "@/server/actions/squad";
import { Avatar } from "./avatar";
import { cardClass, badgeClass } from "./form-bits";
import { HighFiveButton } from "./high-five-button";
import { NutritionDay } from "./nutrition-view";
import { StepsLine } from "./steps-chart";

const nf = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const dayLabel = (d: string) =>
  new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

type Sessions = DayCardData["sessions"];

/** Every session of a day listed separately; with `detailed`, each exercise shows its sets as weight × reps. */
export function SessionList({ sessions, detailed }: { sessions: Sessions; detailed: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {sessions.map((s, i) =>
        s.kind === "gym" ? (
          <li key={i} className="flex flex-col gap-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Gym · {nf.format(s.volumeKg)} kg · {Math.round(s.minutes)} min
            </p>
            <ul className="flex flex-col gap-1.5">
              {s.exercises.map((e) => (
                <li key={e.exerciseId} className="text-sm">
                  <p className="flex justify-between gap-3">
                    <span className="min-w-0 truncate text-ink">{e.exerciseName}</span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {e.kind === "cardio" ? `${Math.round(e.minutes)} min` : e.topSet ? `top ${nf.format(e.topSet.weightKg)} × ${e.topSet.reps}` : "no sets"}
                    </span>
                  </p>
                  {detailed && e.sets && e.sets.length > 0 ? (
                    <ol className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted">
                      {e.sets.map((set, n) => (
                        <li key={n} className={set.completed ? undefined : "text-faint line-through"}>
                          {n + 1}. {nf.format(set.weightKg)} × {set.reps}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </li>
              ))}
            </ul>
          </li>
        ) : (
          <li key={i} className="flex justify-between gap-3 text-sm">
            <span className="text-ink">{s.name}</span>
            <span className="tabular-nums text-muted">{Math.round(s.minutes)} min</span>
          </li>
        ),
      )}
    </ul>
  );
}

export function PrBadges({ badges }: { badges: DayCardData["prBadges"] }) {
  if (badges.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Personal records">
      {badges.map((b) => (
        <li key={`${b.exerciseName}-${b.weightKg}`} className={`${badgeClass} border-accent/40 text-accent`}>
          <Trophy aria-hidden size={12} strokeWidth={1.75} />
          PR · {b.exerciseName} {nf.format(b.weightKg)} × {b.reps}
        </li>
      ))}
    </ul>
  );
}

/**
 * One workout day (feature 011): sessions, volume, top set, PR badges, high-five, nutrition per the member's level.
 * Tapping the header expands the full set-by-set log, fetched on first expand.
 */
export function DayCard({ card, memberId, member }: { card: DayCardData; memberId: string; member?: { displayName: string; avatarUrl: string | null; userId: string } }) {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<Extract<DayLog, { rest: false }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !log) {
      const r = await loadDay(memberId, card.date);
      if (r.ok && !r.log.rest) setLog(r.log);
      else setError("Couldn't load the sets. Try again.");
    }
  };

  return (
    <article className={`${cardClass} flex flex-col gap-3 p-3`}>
      {member ? (
        <Link href={`/squad/${member.userId}`} className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink">
          <Avatar displayName={member.displayName} avatarUrl={member.avatarUrl} size={28} />
          {member.displayName}
        </Link>
      ) : null}
      <button type="button" onClick={toggle} aria-expanded={open} className="flex min-h-11 w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="block text-sm font-semibold text-ink">{dayLabel(card.date)}</span>
          <span className="block text-xs tabular-nums text-muted">
            {card.volumeKg > 0 ? `${nf.format(card.volumeKg)} kg · ` : ""}
            {Math.round(card.durationMin)} min
            {card.topSet ? ` · top ${nf.format(card.topSet.weightKg)} × ${card.topSet.reps}` : ""}
          </span>
        </span>
        <ChevronDown aria-hidden size={16} strokeWidth={1.75} className={`shrink-0 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      <SessionList sessions={open && log ? log.sessions : card.sessions} detailed={open && log !== null} />
      {open && !log && !error ? <p className="text-xs text-muted">Loading sets…</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
      <PrBadges badges={card.prBadges} />
      {card.steps ? <StepsLine steps={card.steps.steps} goalHit={card.steps.goalHit} /> : null}
      {card.nutrition ? <NutritionDay n={card.nutrition} /> : null}
      <div className="flex justify-end">
        <HighFiveButton id={card.id} count={card.highFives} mine={card.highFivedByMe} canHighFive={card.canHighFive} />
      </div>
    </article>
  );
}
