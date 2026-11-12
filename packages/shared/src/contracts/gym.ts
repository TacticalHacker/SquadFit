import { z } from "zod";
import { DateSchema } from "../domain/day";
import {
  ExerciseNameSchema,
  GYM_MAX_REPS,
  GYM_MAX_SETS,
  GYM_MAX_WEIGHT,
  GYM_MINUTES_MESSAGE,
  MuscleGroupSchema,
  REPS_MESSAGE,
  WEIGHT_MESSAGE,
} from "../domain/gym";

/** Feature 006 API shapes. See specs/006-gym-set-logger/contracts/api.md. */

const SummarySchema = z.object({ totalMinutes: z.number(), totalCalories: z.number() });
export const ExerciseKindSchema = z.enum(["strength", "cardio"]);

export const GymSetSchema = z.object({
  setNumber: z.number().int().min(1),
  reps: z.number({ error: REPS_MESSAGE }).int(REPS_MESSAGE).min(1, REPS_MESSAGE).max(GYM_MAX_REPS, REPS_MESSAGE),
  weightKg: z
    .number({ error: WEIGHT_MESSAGE })
    .min(0, WEIGHT_MESSAGE)
    .max(GYM_MAX_WEIGHT, WEIGHT_MESSAGE)
    .refine((n) => Number.isInteger(n * 2), WEIGHT_MESSAGE),
  completed: z.boolean(),
});
export type GymSetDto = z.infer<typeof GymSetSchema>;

/** Body of PUT /workouts/gym/entries/{date}/{exerciseId}. Strict: client totals are rejected (FR-014). */
export const GymStrengthPutSchema = z.strictObject({
  sets: z
    .array(GymSetSchema)
    .min(1, "Add at least one set")
    .max(GYM_MAX_SETS, `At most ${GYM_MAX_SETS} sets`)
    .refine((sets) => sets.every((s, i) => s.setNumber === i + 1), "Sets must be numbered 1, 2, 3… in order"),
});
export const GymCardioPutSchema = z.strictObject({
  minutes: z.number({ error: GYM_MINUTES_MESSAGE }).int(GYM_MINUTES_MESSAGE).min(1, GYM_MINUTES_MESSAGE).max(600, GYM_MINUTES_MESSAGE),
});
export const GymEntryPutSchema = z.union([GymStrengthPutSchema, GymCardioPutSchema]);
export type GymEntryPut = z.infer<typeof GymEntryPutSchema>;

export const GymEntryViewSchema = z.object({
  exerciseId: z.string(),
  name: z.string(),
  muscleGroup: MuscleGroupSchema,
  exerciseKind: ExerciseKindSchema,
  sets: z.array(GymSetSchema).nullable(),
  volumeKg: z.number().nullable(),
  minutes: z.number(),
  calories: z.number(),
  updatedAt: z.string(),
});

export const GymLastSchema = z.object({
  date: DateSchema,
  sets: z.array(GymSetSchema).nullable(),
  minutes: z.number(),
  top: z.object({ weightKg: z.number(), reps: z.number() }).nullable(),
});

export const GymExerciseSchema = z.object({
  exerciseId: z.string(),
  name: z.string(),
  group: MuscleGroupSchema,
  kind: ExerciseKindSchema,
  isBuiltIn: z.boolean(),
  rateMinutes: z.number().nullable(),
  rateCalories: z.number().nullable(),
  entry: GymEntryViewSchema.nullable(),
  last: GymLastSchema.nullable(),
});

export const GymViewSchema = z.object({
  date: DateSchema,
  today: DateSchema,
  timezone: z.string(),
  editable: z.boolean(),
  exercises: z.array(GymExerciseSchema),
  summary: SummarySchema,
});

/** Response of gym entry PUT/DELETE: no per-exercise "last" lookups (SC-006). */
export const GymSaveResultSchema = z.object({
  date: DateSchema,
  editable: z.boolean(),
  exerciseId: z.string(),
  entry: GymEntryViewSchema.nullable(),
  summary: SummarySchema,
});
export type GymSaveResult = z.infer<typeof GymSaveResultSchema>;

/** Own exercises are strength only, so Cardio is not a valid group (FR-005). */
export const GymExerciseInputSchema = z.object({
  name: ExerciseNameSchema,
  group: MuscleGroupSchema.exclude(["cardio"], { error: "Choose a muscle group other than Cardio" }),
});
export type GymExerciseInput = z.infer<typeof GymExerciseInputSchema>;

export const GymExerciseResponseSchema = z.object({ exercise: GymExerciseSchema });
export type GymExerciseResponse = z.infer<typeof GymExerciseResponseSchema>;

/** A drawer draft kept in the browser only (FR-023, research R8). */
export const GymDraftSchema = z.object({
  v: z.literal(1),
  savedAt: z.string(),
  baseUpdatedAt: z.string().nullable(),
  state: z.object({
    mode: ExerciseKindSchema,
    defaultReps: z.number().int().min(1).max(GYM_MAX_REPS),
    rows: z
      .array(
        z.object({
          weightKg: z.number().min(0).max(GYM_MAX_WEIGHT),
          reps: z.number().int().min(1).max(GYM_MAX_REPS),
          completed: z.boolean(),
          repsEdited: z.boolean(),
        }),
      )
      .max(GYM_MAX_SETS),
    minutes: z.number().int().min(0).max(600),
    dirty: z.boolean(),
  }),
});
export type GymDraft = z.infer<typeof GymDraftSchema>;
