import { z } from "zod";

export const MAX_MACRO_GRAMS = 500;

/** Display order on the food day. "preworkout" was added later, so it comes last. */
export const MEALS = ["breakfast", "lunch", "dinner", "snacks", "preworkout"] as const;
export type Meal = (typeof MEALS)[number];
export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
  preworkout: "Pre-workout",
};
export const MealSchema = z.enum(MEALS);

export const SERVINGS_MESSAGE = "Servings must be from 0.5 to 20 in steps of 0.5";
export const CALORIES_MESSAGE = "Calories must be a whole number from 1 to 5,000";

export const ServingsSchema = z
  .number({ error: SERVINGS_MESSAGE })
  .min(0.5, SERVINGS_MESSAGE)
  .max(20, SERVINGS_MESSAGE)
  .refine((n) => Number.isInteger(n * 2), SERVINGS_MESSAGE);

export const CaloriesSchema = z
  .number({ error: CALORIES_MESSAGE })
  .int(CALORIES_MESSAGE)
  .min(1, CALORIES_MESSAGE)
  .max(5000, CALORIES_MESSAGE);

export const GRAMS_MESSAGE = "Grams must be from 0 to 500 with at most one decimal";
const GramsSchema = z
  .number({ error: GRAMS_MESSAGE })
  .min(0, GRAMS_MESSAGE)
  .max(MAX_MACRO_GRAMS, GRAMS_MESSAGE)
  .refine((n) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-9, GRAMS_MESSAGE);

export const MacrosSchema = z.object({ protein: GramsSchema, carbs: GramsSchema, fat: GramsSchema });
export type Macros = z.infer<typeof MacrosSchema>;

/** Calories for `servings` of a food whose rate is `rateCalories` per serving (FR-003). Half rounds up. */
export function scaleCalories(rateCalories: number, servings: number): number {
  return Math.round(rateCalories * servings);
}

/** Grams scaled by servings, in whole tenths first so floating-point noise cannot change the result. */
export function scaleGrams(grams: number, servings: number): number {
  return Math.round(Math.round(grams * 10) * servings) / 10;
}

/** Macros are all-or-none: nothing given means none; any given fills the blanks with 0 (research R4). */
export function completeMacros(input: { protein?: number | undefined; carbs?: number | undefined; fat?: number | undefined } | null | undefined): Macros | null {
  if (!input) return null;
  const { protein, carbs, fat } = input;
  if (protein === undefined && carbs === undefined && fat === undefined) return null;
  return { protein: protein ?? 0, carbs: carbs ?? 0, fat: fat ?? 0 };
}

export function scaleMacros(macros: Macros | null, servings: number): Macros | null {
  return macros
    ? {
        protein: scaleGrams(macros.protein, servings),
        carbs: scaleGrams(macros.carbs, servings),
        fat: scaleGrams(macros.fat, servings),
      }
    : null;
}
