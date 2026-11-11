import { z } from "zod";

export const MIN_MINUTES = 1;
export const MAX_MINUTES = 600;
export const MIN_CALORIES = 1;
export const MAX_CALORIES = 5000;

export const MINUTES_MESSAGE = "Minutes must be a whole number from 1 to 600";

export const MinutesSchema = z
  .number({ error: MINUTES_MESSAGE })
  .int(MINUTES_MESSAGE)
  .min(MIN_MINUTES, MINUTES_MESSAGE)
  .max(MAX_MINUTES, MINUTES_MESSAGE);

/** Calories for `minutes` of a workout whose rate is `rateCalories` per `rateMinutes` (FR-008). Half rounds up. */
export function caloriesFor(rateMinutes: number, rateCalories: number, minutes: number): number {
  return Math.round((rateCalories * minutes) / rateMinutes);
}

export interface Summary {
  totalMinutes: number;
  totalCalories: number;
}

/** Sum of the (already rounded) entry values, so the screen always adds up (SC-003). */
export function summarize(entries: readonly { minutes: number; calories: number }[]): Summary {
  let totalMinutes = 0;
  let totalCalories = 0;
  for (const e of entries) {
    totalMinutes += e.minutes;
    totalCalories += e.calories;
  }
  return { totalMinutes, totalCalories };
}
