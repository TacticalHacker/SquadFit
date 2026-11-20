import type { StoredEntry } from "./day-view";
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from "./gym";
import { isWorkingSet, isWorkoutEntry, streakFigures, type SquadStats } from "./squad";

/**
 * Feature 016: the figures on a member's share card (and a posted feed card) for one of their own days.
 * Pure; the server computes it and the browser only draws it (constitution V). Never carries calories, body weight,
 * targets or anything about food.
 */

export const SHARE_MAX_ROWS = 5;

/** One stored workout entry of the day (gym or activity). */
export type ShareEntry = Pick<StoredEntry, "workoutId" | "name" | "minutes" | "kind" | "exerciseKind" | "muscleGroup" | "sets" | "jumpConfirmedAt" | "updatedAt" | "createdAt"> & {
  date: string;
};

export type ShareRow =
  | { kind: "strength"; exerciseId: string; name: string; top: { weightKg: number; reps: number }; volumeKg: number }
  | { kind: "minutes"; name: string; minutes: number };

export interface SharePr {
  exerciseId: string;
  name: string;
  weightKg: number;
  reps: number;
  e1rm: number | null;
  gainKg: number | null;
}

export interface ShareFigures {
  date: string;
  label: string | null;
  durationMin: number;
  exerciseCount: number;
  liftsImproved: number;
  rows: ShareRow[];
  moreCount: number;
  prs: SharePr[];
  streak: { weeks: number; weekDays: number; target: number };
  steps: number | null;
}

const isStrength = (e: ShareEntry) => e.kind === "gym" && e.exerciseKind !== "cardio";
const tenths = (n: number) => Math.round(n * 10);

/** Heaviest completed set (ties: more reps). Bodyweight sets count here, at 0 kg. */
function topSet(e: ShareEntry) {
  const done = (e.sets ?? []).filter((s) => s.completed && s.reps >= 1);
  if (done.length === 0) return null;
  const top = done.reduce((a, b) => (b.weightKg > a.weightKg || (b.weightKg === a.weightKg && b.reps > a.reps) ? b : a));
  return { weightKg: top.weightKg, reps: top.reps };
}

/** The day's two biggest muscle groups by completed strength sets ("Chest · Shoulders"); null without strength work. */
export function sessionLabel(entries: readonly ShareEntry[]): string | null {
  const counts = new Map<MuscleGroup, number>();
  for (const e of entries) {
    if (!isStrength(e) || !e.muscleGroup || e.muscleGroup === "cardio") continue;
    const n = (e.sets ?? []).filter((s) => s.completed).length;
    if (n > 0) counts.set(e.muscleGroup, (counts.get(e.muscleGroup) ?? 0) + n);
  }
  // Map keeps first-logged order, and the sort is stable, so ties go to the group logged first.
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 2);
  return top.length ? top.map(([g]) => MUSCLE_GROUP_LABELS[g]).join(" · ") : null;
}

export function buildShareSummary(args: {
  date: string;
  /** That day's entries (any order). */
  entries: readonly ShareEntry[];
  stats: SquadStats | null;
  weeklyTarget: number;
  steps: number | null;
}): ShareFigures {
  const { date, stats } = args;
  const day = args.entries
    .filter((e) => e.date === date && isWorkoutEntry(e))
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.createdAt ?? "").localeCompare(b.e.createdAt ?? "") || a.i - b.i)
    .map(({ e }) => e);

  const rows: ShareRow[] = day.map((e) => {
    const top = isStrength(e) ? topSet(e) : null;
    if (!top) return { kind: "minutes", name: e.name, minutes: e.minutes };
    const volumeKg = (e.sets ?? []).filter(isWorkingSet).reduce((t, s) => t + s.reps * tenths(s.weightKg), 0) / 10;
    return { kind: "strength", exerciseId: e.workoutId, name: e.name, top, volumeKg };
  });

  const strength = day.filter(isStrength);
  const liftsImproved = strength.filter((e) => stats?.lifts[e.workoutId]?.improvedDays?.includes(date)).length;
  const prs: SharePr[] = strength.flatMap((e) =>
    (stats?.lifts[e.workoutId]?.prDays ?? [])
      .filter((p) => p.date === date)
      .map((p) => ({ exerciseId: e.workoutId, name: e.name, weightKg: p.weightKg, reps: p.reps, e1rm: p.e1rm, gainKg: p.gainKg ?? null })),
  );
  const streak = streakFigures(stats?.weeks ?? {}, date, args.weeklyTarget);

  return {
    date,
    label: sessionLabel(day),
    durationMin: Math.round(day.reduce((t, e) => t + e.minutes, 0) * 10) / 10,
    exerciseCount: day.length,
    liftsImproved,
    rows: rows.slice(0, SHARE_MAX_ROWS),
    moreCount: Math.max(0, rows.length - SHARE_MAX_ROWS),
    prs,
    streak: { weeks: streak.current, weekDays: streak.weekDays, target: streak.target },
    steps: args.steps,
  };
}
