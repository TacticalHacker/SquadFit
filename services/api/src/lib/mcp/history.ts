import { buildFoodDay, dateRange, dayGymVolume, formatLogId, summarize, type StoredEntry } from "@calci/shared";
import type { CoachNoteItem } from "../coach-repo";
import type { FoodEntryItem } from "../food-repo";
import type { ToolContext } from "./types";

/** One workout line for the agent: every entry carries its `logId` (feature 007, R2); gym lifts add their sets. */
function workoutLine(w: StoredEntry & { date: string }) {
  const base = {
    logId: formatLogId(w.date, w.workoutId),
    kind: w.kind === "gym" ? ("gym" as const) : ("activity" as const),
    name: w.name,
    minutes: w.minutes,
    calories: w.calories,
    aiNote: w.aiNote ?? null,
  };
  if (w.kind !== "gym") return base;
  const lift = w.exerciseKind !== "cardio";
  return {
    ...base,
    muscleGroup: w.muscleGroup,
    exerciseKind: w.exerciseKind ?? "strength",
    ...(lift && w.sets
      ? { sets: w.sets.map((s) => ({ set: s.setNumber, reps: s.reps, weightKg: s.weightKg, done: s.completed })), volumeKg: w.volumeKg ?? 0 }
      : {}),
    // Treadmill details: with both, the app already computed calories from them (ACSM, body weight).
    ...(w.inclinePct !== undefined ? { inclinePct: w.inclinePct } : {}),
    ...(w.speedKmh !== undefined ? { speedKmh: w.speedKmh } : {}),
  };
}

export type HistoryDay = ReturnType<typeof buildHistoryDays>[number];

/**
 * Per-day food, workouts and totals for `get_user_history` and `get_full_context`. Totals use the Food screen's
 * ledger math (pending photo meals count in nothing) plus the day's gym volume.
 */
export function buildHistoryDays(
  ctx: ToolContext,
  startDate: string,
  endDate: string,
  food: readonly FoodEntryItem[],
  workouts: readonly (StoredEntry & { date: string })[],
) {
  return dateRange(startDate, endDate).map((date) => {
    const dayWorkouts = workouts.filter((w) => w.date === date);
    const view = buildFoodDay({
      date,
      today: ctx.today,
      timezone: ctx.timezone,
      target: ctx.calorieTarget,
      proteinTarget: ctx.proteinTarget,
      burnedCalories: summarize(dayWorkouts).totalCalories,
      entries: food.filter((e) => e.date === date),
    });
    return {
      date,
      food: view.meals.flatMap((m) =>
        m.entries.map((e) => ({
          logId: formatLogId(date, e.entryId),
          meal: e.meal,
          name: e.name,
          source: e.source,
          servings: e.servings,
          calories: e.calories,
          ...(e.macros ?? {}),
          ...(e.photo
            ? { status: e.photo.status, caption: e.photo.caption, ...(e.photo.status === "pending" ? { pending: true } : {}) }
            : {}),
        })),
      ),
      workouts: dayWorkouts.map(workoutLine),
      totals: {
        eaten: view.ledger.eaten,
        burned: view.ledger.burned,
        net: view.ledger.net,
        protein: view.ledger.macros.protein,
        carbs: view.ledger.macros.carbs,
        fat: view.ledger.macros.fat,
        gymVolumeKg: dayGymVolume(dayWorkouts),
      },
    };
  });
}

/** Profile figures every read tool returns (FR-004, FR-005). */
export function profileBlock(ctx: ToolContext) {
  return {
    bodyWeightKg: ctx.bodyWeight.kg,
    bodyWeightIsDefault: ctx.bodyWeight.isDefault,
    calorieTarget: ctx.calorieTarget,
    proteinTarget: ctx.proteinTarget,
  };
}

/** The pending-photo hint both read tools add, so the agent fills meals in the app rather than guessing in a note. */
export function pendingHint(days: readonly HistoryDay[]) {
  const pendingPhotoMeals = days.reduce((n, d) => n + d.food.filter((f) => "pending" in f).length, 0);
  return pendingPhotoMeals > 0
    ? {
        pendingPhotoMeals,
        next: "Some photo meals are pending with no calories. Do not just estimate them in a note: call list_pending_food_photos, then get_food_photo for each, then submit_food_estimate to save the numbers in the app.",
      }
    : {};
}

export const noteSummary = (n: CoachNoteItem | undefined) => (n ? { headline: n.headline, status: n.status } : null);
