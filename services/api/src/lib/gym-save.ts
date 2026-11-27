import {
  STRENGTH_RATE,
  cardioEntryTotals,
  effectiveBodyWeight,
  findGymExercise,
  gymTotals,
  type ApiErrorCode,
  type ExerciseKind,
  type GymEntryPut,
  type MuscleGroup,
} from "@calci/shared";
import type { Deps } from "./deps";
import type { GymEntryItem } from "./gym-repo";
import { getLibrary } from "./gym-library";
import { safeRefresh } from "./squad-stats";

export type WriteFailure = { ok: false; status: number; code: ApiErrorCode; message: string; fields?: Record<string, string> };

interface Target {
  name: string;
  group: MuscleGroup;
  kind: ExerciseKind;
  rateMinutes: number;
  rateCalories: number;
  treadmill: boolean;
}

/**
 * Save (create or replace) one gym exercise on one day for `userId`. Shared by `PUT /workouts/gym/entries` and the
 * MCP `upsert_workout_log` tool so the agent obeys exactly the member's rules (feature 007, research R1).
 * Totals are always recomputed from the sets or minutes (006 FR-014). The full replace also drops any `aiNote`.
 * The caller has already checked that `date` is writable.
 */
export async function saveGymEntry(
  userId: string,
  date: string,
  exerciseId: string,
  data: GymEntryPut,
  deps: Deps,
): Promise<{ ok: true; entry: GymEntryItem; raidKg: number } | WriteFailure> {
  const existing = await deps.gym.getGymEntry(userId, date, exerciseId);
  const existingGym = existing?.kind === "gym" ? existing : null;

  // Current definition: library (built-in or active catalog, feature 015), or the caller's active own exercise.
  // A retired catalog exercise is absent, so it falls back to the day's snapshot below like a removed own one.
  let target: Target | null = null;
  const builtIn = findGymExercise(exerciseId, await getLibrary(deps));
  if (builtIn) {
    target = {
      name: builtIn.name,
      group: builtIn.group,
      kind: builtIn.kind,
      rateMinutes: builtIn.rateMinutes ?? STRENGTH_RATE.rateMinutes,
      rateCalories: builtIn.rateCalories ?? STRENGTH_RATE.rateCalories,
      treadmill: builtIn.treadmill === true,
    };
  } else if (exerciseId.startsWith("gc-")) {
    const own = await deps.gym.getOwnExercise(userId, exerciseId);
    if (own && !own.removedAt) target = { name: own.name, group: own.group, kind: "strength", ...STRENGTH_RATE, treadmill: false };
  }
  // A removed own exercise can still be re-saved on a day it was logged, keeping its stored snapshot (006 FR-018).
  if (!target && existingGym) {
    target = {
      name: existingGym.name,
      group: existingGym.muscleGroup ?? "chest",
      kind: existingGym.exerciseKind ?? "strength",
      rateMinutes: existingGym.rateMinutes,
      rateCalories: existingGym.rateCalories,
      treadmill: existingGym.inclinePct !== undefined || existingGym.speedKmh !== undefined,
    };
  }
  if (!target) return { ok: false, status: 404, code: "NOT_FOUND", message: "Exercise not found" };

  if (target.kind === "strength" && !("sets" in data)) {
    return { ok: false, status: 400, code: "VALIDATION_FAILED", message: "This exercise is logged in sets", fields: { sets: "Add at least one set" } };
  }
  if (target.kind === "cardio" && !("minutes" in data)) {
    return { ok: false, status: 400, code: "VALIDATION_FAILED", message: "This exercise is logged in minutes", fields: { minutes: "Enter the minutes" } };
  }

  if ("minutes" in data && (data.inclinePct !== undefined || data.speedKmh !== undefined) && !target.treadmill) {
    return { ok: false, status: 400, code: "VALIDATION_FAILED", message: "Only treadmill exercises take incline and speed" };
  }

  const nowIso = deps.now().toISOString();
  const common = {
    date,
    workoutId: exerciseId,
    name: target.name,
    kind: "gym" as const,
    muscleGroup: target.group,
    exerciseKind: target.kind,
    rateMinutes: target.rateMinutes,
    rateCalories: target.rateCalories,
    createdAt: existingGym?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
  let entry: GymEntryItem;
  if ("sets" in data) {
    const totals = gymTotals(data.sets);
    entry = { ...common, sets: data.sets, volumeKg: totals.volumeKg, minutes: totals.minutes, calories: totals.calories };
  } else {
    // Treadmill with incline and speed: the ACSM equation at the member's body weight; otherwise minutes × rate.
    const detailed = target.treadmill && data.inclinePct !== undefined && data.speedKmh !== undefined;
    const bodyWeightKg = detailed ? effectiveBodyWeight((await deps.profiles.get(userId)) ?? {}).kg : 0;
    const totals = cardioEntryTotals({
      rateMinutes: target.rateMinutes,
      rateCalories: target.rateCalories,
      minutes: data.minutes,
      treadmill: detailed ? { inclinePct: data.inclinePct, speedKmh: data.speedKmh, bodyWeightKg } : null,
    });
    entry = {
      ...common,
      minutes: totals.minutes,
      calories: totals.calories,
      ...(data.inclinePct !== undefined ? { inclinePct: data.inclinePct } : {}),
      ...(data.speedKmh !== undefined ? { speedKmh: data.speedKmh } : {}),
    };
  }
  await deps.gym.putGymEntry(userId, entry);
  // Feature 010: streaks, PRs and feed follow every gym save, from the app or the AI agent alike.
  const { raidKg } = await safeRefresh(userId, deps);
  return { ok: true, entry, raidKg };
}
