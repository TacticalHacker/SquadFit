import { z } from "zod";
import { MAX_CALORIES, MAX_MINUTES, MIN_CALORIES, MIN_MINUTES } from "./calories";

export interface WorkoutDef {
  id: string;
  name: string;
  defaultMinutes: number;
  defaultCalories: number;
}

/** Standard catalog (research R1). kcal figures are rough estimates for a ~70 kg adult. Ids are never reused. */
export const STANDARD_WORKOUTS: readonly WorkoutDef[] = [
  { id: "std-walking", name: "Walking", defaultMinutes: 30, defaultCalories: 120 },
  { id: "std-running", name: "Running", defaultMinutes: 30, defaultCalories: 300 },
  { id: "std-cycling", name: "Cycling", defaultMinutes: 30, defaultCalories: 240 },
  { id: "std-swimming", name: "Swimming", defaultMinutes: 30, defaultCalories: 250 },
  { id: "std-yoga", name: "Yoga", defaultMinutes: 30, defaultCalories: 90 },
  { id: "std-strength", name: "Strength training", defaultMinutes: 45, defaultCalories: 220 },
  { id: "std-hiit", name: "HIIT", defaultMinutes: 20, defaultCalories: 200 },
  { id: "std-jump-rope", name: "Jump rope", defaultMinutes: 15, defaultCalories: 150 },
  { id: "std-hiking", name: "Hiking", defaultMinutes: 60, defaultCalories: 350 },
  { id: "std-stretching", name: "Stretching", defaultMinutes: 15, defaultCalories: 45 },
  { id: "std-dancing", name: "Dancing", defaultMinutes: 30, defaultCalories: 150 },
  { id: "std-team-sport", name: "Team sport", defaultMinutes: 60, defaultCalories: 400 },
];

export const findStandardWorkout = (id: string) => STANDARD_WORKOUTS.find((w) => w.id === id);

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

/** True if `name` clashes with a standard workout or one of `existingNames` (ignoring case and spacing, FR-020). */
export function isNameTaken(name: string, existingNames: readonly string[]): boolean {
  const n = normalizeWorkoutName(name);
  return STANDARD_WORKOUTS.some((w) => normalizeWorkoutName(w.name) === n) ||
    existingNames.some((e) => normalizeWorkoutName(e) === n);
}
