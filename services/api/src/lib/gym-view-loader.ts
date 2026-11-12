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

/** GET /workouts/gym: the day's gym list plus, per exercise, the latest earlier entry (research R5). */
export async function loadGymView(userId: string, ctx: DayContext, date: string, deps: Deps): Promise<GymView> {
  const [ownExercises, entries] = await Promise.all([
    deps.gym.listOwnExercises(userId),
    deps.workouts.listEntriesForDay(userId, date),
  ]);
  const base = buildGymView({ date, today: ctx.today, timezone: ctx.timezone, ownExercises, entries, last: {} });
  const lasts = await Promise.all(
    base.exercises.map(async (e) => {
      const hit = await deps.gym.lastBefore(userId, e.exerciseId, date);
      return [e.exerciseId, hit ? toGymLast(hit) : null] as const;
    }),
  );
  const last: Record<string, GymLast | null> = Object.fromEntries(lasts);
  return { ...base, exercises: base.exercises.map((e) => ({ ...e, last: last[e.exerciseId] ?? null })) };
}

/** Response of a gym save/remove: one day query, no "last" fan-out (SC-006). */
export async function loadGymSaveResult(userId: string, ctx: DayContext, date: string, exerciseId: string, deps: Deps): Promise<GymSaveResult> {
  const entries = await deps.workouts.listEntriesForDay(userId, date);
  const entry = entries.find((e) => isGymEntry(e) && e.workoutId === exerciseId);
  return {
    date,
    editable: isEditableDay(date, ctx.today),
    exerciseId,
    entry: entry ? toGymEntryView(entry) : null,
    summary: summarize(entries),
  };
}
