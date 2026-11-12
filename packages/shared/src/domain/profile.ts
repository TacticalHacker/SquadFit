import { z } from "zod";

export const CALORIE_TARGET_MIN = 500;
export const CALORIE_TARGET_MAX = 10_000;

export const DisplayNameSchema = z
  .string()
  .trim()
  .min(1, "Display name is required")
  .max(40, "Display name must be at most 40 characters");

export const CalorieTargetSchema = z
  .number()
  .int("Must be between 500 and 10,000 kcal")
  .min(CALORIE_TARGET_MIN, "Must be between 500 and 10,000 kcal")
  .max(CALORIE_TARGET_MAX, "Must be between 500 and 10,000 kcal");

export const PasswordSchema = z.string().min(8, "Password must be at least 8 characters");

/** Up to two uppercase initials, used when a user has no avatar (FR-013). */
export function initials(displayName: string): string {
  return displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0]?.toUpperCase() ?? "")
    .join("");
}

export const PROTEIN_TARGET_MIN = 10;
export const PROTEIN_TARGET_MAX = 500;

/** Optional daily protein target in grams (feature 004, FR-009). */
export const ProteinTargetSchema = z
  .number()
  .int("Must be between 10 and 500 g")
  .min(PROTEIN_TARGET_MIN, "Must be between 10 and 500 g")
  .max(PROTEIN_TARGET_MAX, "Must be between 10 and 500 g");

/** Body weight for the AI coach's calorie estimates (feature 007, FR-001). */
export const DEFAULT_BODY_WEIGHT_KG = 75;
const BODY_WEIGHT_MESSAGE = "Must be between 20 and 400 kg, at most one decimal";
export const BodyWeightSchema = z
  .number({ error: BODY_WEIGHT_MESSAGE })
  .min(20, BODY_WEIGHT_MESSAGE)
  .max(400, BODY_WEIGHT_MESSAGE)
  .refine((n) => Number.isInteger(Math.round(n * 10 * 1e6) / 1e6), BODY_WEIGHT_MESSAGE);

export function effectiveBodyWeight(p: { bodyWeightKg?: number | null }): { kg: number; isDefault: boolean } {
  return typeof p.bodyWeightKg === "number" ? { kg: p.bodyWeightKg, isDefault: false } : { kg: DEFAULT_BODY_WEIGHT_KG, isDefault: true };
}
