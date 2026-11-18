import {
  buildGymView,
  isEditableDay,
  isGymEntry,
  summarize,
  toGymEntryView,
  toGymLast,
  type GymLast,
  type GymSaveResult,
  type GymView,
} from "@calci/shared";
import type { DayContext } from "./day-context";
import type { Deps } from "./deps";

/** Feature 010: which of this day's entries carry an unusual-jump flag (read from the member's cached stats). */
async function flaggedOn(userId: string, date: string, deps: Deps): Promise<Set<string>> {
  const stats = await deps.squad.getStats(userId);
  return new Set((stats?.flags ?? []).filter((f) => f.date === date).map((f) => f.exerciseId));
}

/** GET /workouts/gym: the day's gym list plus, per exercise, the latest earlier entry (research R5). */
export async function loadGymView(userId: string, ctx: DayContext, date: string, deps: Deps): Promise<GymView> {
  const [ownExercises, entries, flagged] = await Promise.all([
    deps.gym.listOwnExercises(userId),
    deps.workouts.listEntriesForDay(userId, date),
    flaggedOn(userId, date, deps),
  ]);
  const base = buildGymView({ date, today: ctx.today, timezone: ctx.timezone, ownExercises, entries, last: {} });
  const lasts = await Promise.all(
    base.exercises.map(async (e) => {
      const hit = await deps.gym.lastBefore(userId, e.exerciseId, date);
      return [e.exerciseId, hit ? toGymLast(hit) : null] as const;
    }),
  );
  const last: Record<string, GymLast | null> = Object.fromEntries(lasts);
  return {
    ...base,
    exercises: base.exercises.map((e) => ({
      ...e,
      entry: e.entry ? { ...e.entry, jumpFlag: flagged.has(e.exerciseId) } : null,
      last: last[e.exerciseId] ?? null,
    })),
  };
}

/** Response of a gym save/remove: one day query, no "last" fan-out (SC-006). */
export async function loadGymSaveResult(userId: string, ctx: DayContext, date: string, exerciseId: string, deps: Deps): Promise<GymSaveResult> {
  const [entries, flagged] = await Promise.all([deps.workouts.listEntriesForDay(userId, date), flaggedOn(userId, date, deps)]);
  const entry = entries.find((e) => isGymEntry(e) && e.workoutId === exerciseId);
  return {
    date,
    editable: isEditableDay(date, ctx.today),
    exerciseId,
    entry: entry ? { ...toGymEntryView(entry), jumpFlag: flagged.has(exerciseId) } : null,
    summary: summarize(entries),
  };
}
