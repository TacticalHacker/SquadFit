"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Trophy } from "lucide-react";
import type { DayCard as DayCardData, DayLog } from "@calci/shared";
import { loadDay } from "@/server/actions/squad";
import { Avatar } from "./avatar";
import { cardClass, badgeClass } from "./form-bits";
import { INFO, bestSet, cardioLine, heaviestLift, isDumbbell, kg, minutes, sessionLine, setSummary } from "@/lib/plain";
import { InfoTip } from "./info-tip";
import { Reactions } from "./reactions";
import { NutritionDay } from "./nutrition-view";
import { StepsLine } from "./steps-chart";
import { ShareButton } from "./share-button";

const dayLabel = (d: string) =>
  new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

type Sessions = DayCardData["sessions"];

/**
 * Every session of a day in plain words (feature 013): the gym summary once, then each exercise. With `detailed`,
 * strength exercises show their sets ("3 sets of 10 reps at 15 kg"); otherwise their best set.
 */
export function SessionList({ sessions, detailed }: { sessions: Sessions; detailed: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {sessions.map((s, i) =>
        s.kind === "gym" ? (
          <li key={i} className="flex flex-col gap-1.5">
            <p className="flex items-center gap-0.5 text-sm text-muted">
              <span className="tabular-nums">{sessionLine(s.minutes, s.exercises.length, s.volumeKg)}</span>
              {s.volumeKg > 0 ? <InfoTip title="Total weight lifted" text={INFO.totalLifted} /> : null}
            </p>
            <ul className="flex flex-col gap-1.5">
              {s.exercises.map((e) =>
                e.kind === "cardio" ? (
                  <li key={e.exerciseId} className="text-sm text-ink">
                    {cardioLine(e.exerciseName, e.minutes)}
                  </li>
                ) : (
                  <li key={e.exerciseId} className="flex flex-col text-sm">
                    <span className="text-ink">{e.exerciseName}</span>
                    <span className="tabular-nums text-muted">
                      {detailed && e.sets
                        ? setSummary(e.sets, isDumbbell(e.exerciseId, e.exerciseName))
                        : e.topSet
                          ? bestSet(e.topSet.weightKg, e.topSet.reps, isDumbbell(e.exerciseId, e.exerciseName))
                          : "No sets finished"}
                    </span>
                  </li>
                ),
              )}
            </ul>
          </li>
        ) : (
          <li key={i} className="text-sm text-ink">
            {cardioLine(s.name, s.minutes)}
          </li>
        ),
      )}
    </ul>
  );
}

/** One "PR" badge per new personal best. */
export function PrBadges({ badges }: { badges: DayCardData["prBadges"] }) {
  if (badges.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Personal bests">
      {badges.map((b) => (
        <li key={`${b.exerciseName}-${b.weightKg}`} className={`${badgeClass} border-accent/40 text-accent`}>
          <Trophy aria-hidden size={12} strokeWidth={1.75} />
          PR · {b.exerciseName} {kg(b.weightKg)} × {b.reps} {b.reps === 1 ? "rep" : "reps"}
        </li>
      ))}
    </ul>
  );
}

/**
 * One workout day (feature 011; wording and reactions 013): sessions, PR badges, reactions, nutrition per the member's level.
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
    // Feature 022: notifications link to `#day-<date>` on the member's profile (not on Today, where dates repeat).
    <article id={member ? undefined : `day-${card.date}`} className={`${cardClass} flex scroll-mt-4 flex-col gap-3 p-3`}>
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
            {card.topSet ? heaviestLift(card.topSet.exerciseName, card.topSet.weightKg, card.topSet.reps) : minutes(card.durationMin)}
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
      <div className="flex items-center justify-end gap-2">
        {/* Feature 016: only your own days can be shared (members never react to their own cards). */}
        {!card.canReact ? <ShareButton date={card.date} className="mr-auto -ml-3" /> : null}
        <Reactions id={card.id} reactions={card.reactions} canReact={card.canReact} />
      </div>
    </article>
  );
}
