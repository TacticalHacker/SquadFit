import {
  bestsBefore,
  buildGymView,
  EMPTY_BESTS,
  effectiveBodyWeight,
  isEditableDay,
  isGymEntry,
  pickGymLast,
  summarize,
  toGymEntryView,
  toGymLast,
  type GymLast,
  type GymSaveResult,
  type GymView,
  type PrBests,
  type SquadStats,
} from "@calci/shared";
import type { DayContext } from "./day-context";
import type { Deps } from "./deps";
import { getLibrary } from "./gym-library";
import { weeklyStreakOf } from "./squad-view";

/** Feature 010: which of this day's entries carry an unusual-jump flag (read from the member's cached stats). */
const flaggedOn = (stats: SquadStats | null, date: string): Set<string> =>
  new Set((stats?.flags ?? []).filter((f) => f.date === date).map((f) => f.exerciseId));

/**
 * Feature 019: the member's bests before `date` for the drawer's live PR check. Unknown (null) for cardio and for
 * stats written before 019; an exercise the rebuilt stats don't list has never been logged (baseline).
 */
function bestsFor(stats: SquadStats | null, exerciseId: string, date: string): PrBests | null {
  if (!stats?.prRules) return null;
  const lift = stats.lifts[exerciseId];
  return lift ? bestsBefore(lift.prBase, date) : EMPTY_BESTS;
}

/** GET /workouts/gym: the day's gym list plus, per exercise, the latest earlier entry (research R5, from the GYMLAST index). */
export async function loadGymView(userId: string, ctx: DayContext, date: string, deps: Deps): Promise<GymView> {
  const [ownExercises, entries, stats, library, profile, index] = await Promise.all([
    deps.gym.listOwnExercises(userId),
    deps.workouts.listEntriesForDay(userId, date),
    deps.squad.getStats(userId),
    getLibrary(deps),
    deps.profiles.get(userId),
    deps.workouts.getGymLastIndex(userId),
  ]);
  const base = buildGymView({ date, today: ctx.today, timezone: ctx.timezone, ownExercises, library, entries, last: {}, bodyWeightKg: effectiveBodyWeight(profile ?? {}).kg });
  const lasts = await Promise.all(
    base.exercises.map(async (e) => {
      // One index read covers almost every exercise; query only when the index is missing (stats never rebuilt)
      // or can't tell (a past day older than every kept entry).
      const known = index ? pickGymLast(index, e.exerciseId, date) : undefined;
      if (known !== undefined) return [e.exerciseId, known] as const;
      const hit = await deps.gym.lastBefore(userId, e.exerciseId, date);
      return [e.exerciseId, hit ? toGymLast(hit) : null] as const;
    }),
  );
  const last: Record<string, GymLast | null> = Object.fromEntries(lasts);
  const flagged = flaggedOn(stats, date);
  return {
    ...base,
    exercises: base.exercises.map((e) => ({
      ...e,
      entry: e.entry ? { ...e.entry, jumpFlag: flagged.has(e.exerciseId) } : null,
      last: last[e.exerciseId] ?? null,
      bests: e.kind === "strength" ? bestsFor(stats, e.exerciseId, date) : null,
    })),
  };
}

/** Response of a gym save/remove: one day query, no "last" fan-out (SC-006). */
export async function loadGymSaveResult(userId: string, ctx: DayContext, date: string, exerciseId: string, deps: Deps): Promise<GymSaveResult> {
  const [entries, stats, profile] = await Promise.all([
    deps.workouts.listEntriesForDay(userId, date),
    deps.squad.getStats(userId),
    deps.profiles.get(userId),
  ]);
  const flagged = flaggedOn(stats, date);
  const entry = entries.find((e) => isGymEntry(e) && e.workoutId === exerciseId);
  const prDay = entry ? stats?.lifts[exerciseId]?.prDays.find((p) => p.date === date) : undefined;
  return {
    date,
    editable: isEditableDay(date, ctx.today),
    exerciseId,
    entry: entry ? { ...toGymEntryView(entry), jumpFlag: flagged.has(exerciseId) } : null,
    summary: summarize(entries),
    prs: prDay ? (prDay.records?.length ?? 1) : 0,
    streakWeeks: profile ? weeklyStreakOf(profile, stats, ctx.today).current : 0,
  };
}
