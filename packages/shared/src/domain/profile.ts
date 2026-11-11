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
