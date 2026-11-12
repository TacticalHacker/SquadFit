import { z } from "zod";
import { MAX_CALORIES, MAX_MINUTES, MIN_CALORIES, MIN_MINUTES } from "./calories";

/*
 * Feature 007 removed the 12 built-in activities (walking, running, …, team sport). Members log their own
 * activities only; past entries with the old `std-*` ids keep their stored name, minutes and calories.
 */

export const normalizeWorkoutName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

export const WorkoutNameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1, "Name is required").max(40, "Name must be at most 40 characters"));

export const CustomWorkoutInputSchema = z.object({
  name: WorkoutNameSchema,
  defaultMinutes: z
    .number({ error: "Default minutes must be a whole number from 1 to 600" })
    .int("Default minutes must be a whole number from 1 to 600")
    .min(MIN_MINUTES, "Default minutes must be a whole number from 1 to 600")
    .max(MAX_MINUTES, "Default minutes must be a whole number from 1 to 600"),
  defaultCalories: z
    .number({ error: "Default calories must be a whole number from 1 to 5,000" })
    .int("Default calories must be a whole number from 1 to 5,000")
    .min(MIN_CALORIES, "Default calories must be a whole number from 1 to 5,000")
    .max(MAX_CALORIES, "Default calories must be a whole number from 1 to 5,000"),
});
export type CustomWorkoutInput = z.infer<typeof CustomWorkoutInputSchema>;

/** True if `name` clashes with one of `existingNames`, ignoring case and spacing (002 FR-020; own names only since 007). */
export function isNameTaken(name: string, existingNames: readonly string[]): boolean {
  const n = normalizeWorkoutName(name);
  return existingNames.some((e) => normalizeWorkoutName(e) === n);
}
