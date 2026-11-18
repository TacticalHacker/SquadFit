import { addDays } from "./day";
import type { GymSet } from "./gym";
import type { StoredEntry } from "./day-view";
import { isWorkingSet, isWorkoutEntry, type PrDay } from "./squad";
import { weekStart } from "./week";

/** Feature 011: profile day cards, timeline paging and the heatmap. Pure; see specs/011-squad-profiles-nutrition. */

export interface ProfileEntry extends StoredEntry {
  date: string;
}

export interface SetRow {
  weightKg: number;
  reps: number;
  completed: boolean;
}
export interface ExerciseSummary {
  exerciseId: string;
  exerciseName: string;
  kind: "strength" | "cardio";
  minutes: number;
  volumeKg: number;
  topSet: { weightKg: number; reps: number } | null;
  sets?: SetRow[];
}
export type Session =
  | { kind: "gym"; exercises: ExerciseSummary[]; minutes: number; volumeKg: number }
  | { kind: "activity"; name: string; minutes: number };

export interface PrBadge {
  exerciseName: string;
  weightKg: number;
  reps: number;
  e1rm: number | null;
}
export interface DayCardData {
  date: string;
  sessions: Session[];
  volumeKg: number;
  durationMin: number;
  topSet: { exerciseName: string; weightKg: number; reps: number } | null;
  prBadges: PrBadge[];
  /** Latest `updatedAt` of the day's entries; orders "Today's workouts". Not sent to clients. */
  updatedAt: string;
}

const tenths = (n: number) => Math.round(n * 10);
const setsOf = (e: StoredEntry): GymSet[] => e.sets ?? [];

function summarize(e: ProfileEntry, withSets: boolean): ExerciseSummary {
  const kind = e.exerciseKind === "cardio" ? "cardio" : "strength";
  const working = kind === "strength" ? setsOf(e).filter(isWorkingSet) : [];
  const top = working.length
    ? working.reduce((a, b) => (b.weightKg > a.weightKg || (b.weightKg === a.weightKg && b.reps > a.reps) ? b : a))
    : null;
  return {
    exerciseId: e.workoutId,
    exerciseName: e.name,
    kind,
    minutes: e.minutes,
    volumeKg: working.reduce((t, s) => t + s.reps * tenths(s.weightKg), 0) / 10,
    topSet: top ? { weightKg: top.weightKg, reps: top.reps } : null,
    ...(withSets && kind === "strength" ? { sets: setsOf(e).map((s) => ({ weightKg: s.weightKg, reps: s.reps, completed: s.completed })) } : {}),
  };
}

/**
 * One day's card from that day's entries, or null when none of them counts as a workout (feature 010 FR-007).
 * Sessions: the gym session first (all gym exercises), then each activity by name. `prs` are the member's PR days by
 * exercise id, so a day shows a badge for each PR achieved on it.
 */
export function buildDayCard(
  date: string,
  entries: readonly ProfileEntry[],
  prs: Readonly<Record<string, readonly PrDay[]>>,
  opts: { withSets?: boolean } = {},
): DayCardData | null {
  const counted = entries.filter((e) => e.date === date && isWorkoutEntry(e));
  if (counted.length === 0) return null;
  const withSets = opts.withSets ?? false;
  const gym = counted.filter((e) => e.kind === "gym").map((e) => summarize(e, withSets)).sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
  const activities = counted.filter((e) => e.kind !== "gym").sort((a, b) => a.name.localeCompare(b.name));

  const sessions: Session[] = [];
  if (gym.length) {
    sessions.push({
      kind: "gym",
      exercises: gym,
      minutes: gym.reduce((t, g) => t + g.minutes, 0),
      volumeKg: gym.reduce((t, g) => t + tenths(g.volumeKg), 0) / 10,
    });
  }
  for (const a of activities) sessions.push({ kind: "activity", name: a.name, minutes: a.minutes });

  let top: DayCardData["topSet"] = null;
  for (const g of gym) {
    if (g.topSet && (top === null || g.topSet.weightKg > top.weightKg || (g.topSet.weightKg === top.weightKg && g.topSet.reps > top.reps))) {
      top = { exerciseName: g.exerciseName, ...g.topSet };
    }
  }
  const prBadges: PrBadge[] = [];
  for (const g of gym) for (const pr of prs[g.exerciseId] ?? []) if (pr.date === date) prBadges.push({ exerciseName: g.exerciseName, weightKg: pr.weightKg, reps: pr.reps, e1rm: pr.e1rm });

  return {
    date,
    sessions,
    volumeKg: gym.reduce((t, g) => t + tenths(g.volumeKg), 0) / 10,
    durationMin: counted.reduce((t, e) => t + e.minutes, 0),
    topSet: top,
    prBadges,
    updatedAt: counted.reduce((m, e) => ((e.updatedAt ?? "") > m ? (e.updatedAt ?? "") : m), ""),
  };
}

/** Cards for every workout day in `entries`, newest first. */
export function buildDayCards(entries: readonly ProfileEntry[], prs: Readonly<Record<string, readonly PrDay[]>>): DayCardData[] {
  const dates = [...new Set(entries.map((e) => e.date))];
  return dates
    .map((d) => buildDayCard(d, entries, prs))
    .filter((c): c is DayCardData => c !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export const TIMELINE_PAGE_DAYS = 10;

/**
 * One timeline page (research R3). `cards` must contain every workout day older than `cursor` that could belong to the
 * page plus at least one more if there is one. The cursor is the oldest date already returned (exclusive), so a day is
 * never split or repeated across pages.
 */
export function pageTimeline(cards: readonly DayCardData[], cursor: string | null, size = TIMELINE_PAGE_DAYS) {
  const older = cards.filter((c) => cursor === null || c.date < cursor).sort((a, b) => b.date.localeCompare(a.date));
  const page = older.slice(0, size);
  return { page, nextCursor: older.length > size ? page[page.length - 1]!.date : null };
}

export type HeatLevel = 0 | 1 | 2 | 3 | 4;
export const HEATMAP_WEEKS = 12;

/**
 * 12 Monday-aligned weeks up to `today` (research R5). Level 0 = no workout, 1 = trained without volume (activities or
 * cardio), 2-4 = terciles of the member's own working-set volume over the window.
 */
export function heatmapCells(entries: readonly ProfileEntry[], today: string): { date: string; level: HeatLevel }[] {
  const from = addDays(weekStart(today), -7 * (HEATMAP_WEEKS - 1));
  const trained = new Set<string>();
  const volume = new Map<string, number>();
  for (const e of entries) {
    if (e.date < from || e.date > today || !isWorkoutEntry(e)) continue;
    trained.add(e.date);
    if (e.kind === "gym" && e.exerciseKind !== "cardio") {
      const v = setsOf(e).filter(isWorkingSet).reduce((t, s) => t + s.reps * tenths(s.weightKg), 0);
      volume.set(e.date, (volume.get(e.date) ?? 0) + v);
    }
  }
  const sorted = [...volume.values()].filter((v) => v > 0).sort((a, b) => a - b);
  const q = (frac: number) => sorted[Math.max(0, Math.ceil(sorted.length * frac) - 1)] ?? 0;
  const q1 = q(1 / 3);
  const q2 = q(2 / 3);
  const cells: { date: string; level: HeatLevel }[] = [];
  for (let d = from; d <= today; d = addDays(d, 1)) {
    const v = volume.get(d) ?? 0;
    const level: HeatLevel = !trained.has(d) ? 0 : v <= 0 ? 1 : v <= q1 ? 2 : v <= q2 ? 3 : 4;
    cells.push({ date: d, level });
  }
  return cells;
}
