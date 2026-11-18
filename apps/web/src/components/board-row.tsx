"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { DayLog, NutritionTotals } from "@calci/shared";
import { loadDay } from "@/server/actions/squad";
import { Avatar } from "./avatar";
import { PrBadges, SessionList } from "./day-card";
import { NutritionLine } from "./nutrition-view";
import { StepsLine } from "./steps-chart";

interface RowMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isYou: boolean;
}

/** Which row is open. On phones only one row is open at a time (feature 011, FR-015); wider screens may keep several. */
const OpenRows = createContext<{ open: ReadonlySet<string>; toggle: (id: string) => void }>({ open: new Set(), toggle: () => undefined });

/** The ranked list shell: one card, hairline dividers, no horizontal scroll. */
export function BoardList({ children, label }: { children: ReactNode; label: string }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        if (typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches) next.clear();
        next.add(id);
      }
      return next;
    });
  }, []);
  return (
    <OpenRows.Provider value={{ open, toggle }}>
      <ol aria-label={label} className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-card">
        {children}
      </ol>
    </OpenRows.Provider>
  );
}

/** Full workout of a member for the selected day, loaded when its row is first opened and then kept. */
const dayCache = new Map<string, DayLog>();

type StepsDay = { steps: number; goalHit: boolean };

function RowWorkout({ memberId, date, trained, isToday, steps }: { memberId: string; date: string; trained: boolean; isToday: boolean; steps?: StepsDay | undefined }) {
  const key = `${memberId}:${date}`;
  const [log, setLog] = useState<DayLog | null>(() => dayCache.get(key) ?? null);
  const [error, setError] = useState(false);

  // Fetch after mount, never during render (setState in render would update the router while rendering).
  useEffect(() => {
    if (!trained || dayCache.has(key)) return;
    let live = true;
    void loadDay(memberId, date).then((r) => {
      if (!live) return;
      if (r.ok) {
        dayCache.set(key, r.log);
        setLog(r.log);
      } else setError(true);
    });
    return () => {
      live = false;
    };
  }, [key, memberId, date, trained]);
  const empty = !trained || (log !== null && log.rest);
  // Feature 012: a day without a workout but with synced steps reads "Rest day · 11,240 steps".
  if (empty) return steps ? <StepsLine steps={steps.steps} goalHit={steps.goalHit} rest /> : <p className="text-sm text-muted">{isToday ? "Nothing logged yet" : "Rest day"}</p>;
  if (error) return <p className="text-sm text-danger">Couldn&apos;t load this workout.</p>;
  if (!log || log.rest) return <p className="text-sm text-muted">Loading…</p>;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs tabular-nums text-muted">
        {Math.round(log.volumeKg)} kg · {Math.round(log.durationMin)} min
        {log.topSet ? ` · top ${log.topSet.exerciseName} ${log.topSet.weightKg} × ${log.topSet.reps}` : ""}
      </p>
      <SessionList sessions={log.sessions} detailed />
      <PrBadges badges={log.prBadges} />
      {steps ? <StepsLine steps={steps.steps} goalHit={steps.goalHit} /> : null}
    </div>
  );
}

/**
 * One board row (features 010/011): rank, avatar, name (a link to the profile), the main figure large in tabular
 * numerals and a muted secondary line. Tapping the row (not the name) opens that member's workout for `day.date`.
 * `expand` is extra board-specific detail (e.g. the PR list).
 */
export function BoardRow({
  rank,
  member,
  main,
  unit,
  secondary,
  below,
  expand,
  day,
}: {
  rank: number | null;
  member: RowMember;
  main: ReactNode;
  unit?: string;
  secondary?: ReactNode;
  /** Extra content under the name (e.g. a progress bar). */
  below?: ReactNode;
  expand?: ReactNode;
  day?: { date: string; trained: boolean; isToday: boolean; nutrition?: NutritionTotals; steps?: StepsDay };
}) {
  const { open, toggle } = useContext(OpenRows);
  const expandable = Boolean(expand || day);
  const isOpen = expandable && open.has(member.userId);
  const profileHref = `/squad/${member.userId}`;

  return (
    <li className={member.isYou ? "bg-accent-soft" : undefined}>
      <div className="relative">
        {expandable ? (
          <button
            type="button"
            onClick={() => toggle(member.userId)}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? "Hide" : "Show"} ${member.displayName}'s workout`}
            className="absolute inset-0 w-full touch-manipulation active:bg-line/40"
          />
        ) : null}
        <div className="pointer-events-none relative flex min-h-14 items-center gap-3 px-3 py-3">
          <span className="w-6 shrink-0 text-center text-sm font-medium tabular-nums text-muted">{rank ?? "—"}</span>
          <Link href={profileHref} aria-label={`${member.displayName}'s profile`} className="pointer-events-auto shrink-0">
            <Avatar displayName={member.displayName} avatarUrl={member.avatarUrl} size={36} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">
              <Link href={profileHref} className="pointer-events-auto underline-offset-4 hover:underline">
                {member.displayName}
              </Link>
              {member.isYou ? <span className="ml-1.5 text-xs font-normal text-muted">you</span> : null}
            </p>
            {secondary ? <p className="truncate text-xs text-muted">{secondary}</p> : null}
            {below}
            {day?.nutrition ? <NutritionLine n={day.nutrition} /> : null}
          </div>
          <p className="shrink-0 text-right text-2xl font-semibold tabular-nums text-ink">
            {main}
            {unit ? <span className="ml-1 text-sm font-normal text-muted">{unit}</span> : null}
          </p>
          {expandable ? (
            <ChevronDown aria-hidden size={16} strokeWidth={1.75} className={`shrink-0 text-muted transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
          ) : null}
        </div>
      </div>
      {isOpen ? (
        <div className="flex flex-col gap-3 border-t border-line px-4 py-3 pl-[3.75rem]">
          {expand}
          {day ? <RowWorkout memberId={member.userId} date={day.date} trained={day.trained} isToday={day.isToday} steps={day.steps} /> : null}
        </div>
      ) : null}
    </li>
  );
}

export function EmptyBoard({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">{children}</p>;
}
