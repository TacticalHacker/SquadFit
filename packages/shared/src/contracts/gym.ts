import { z } from "zod";
import { DateSchema } from "../domain/day";
import {
  ExerciseNameSchema,
  GYM_MAX_REPS,
  GYM_MAX_SETS,
  GYM_MAX_WEIGHT,
  GYM_MAX_INCLINE,
  GYM_MAX_SPEED,
  GYM_MIN_SPEED,
  GYM_MINUTES_MESSAGE,
  INCLINE_MESSAGE,
  MuscleGroupSchema,
  SPEED_MESSAGE,
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
export const InclinePctSchema = z
  .number({ error: INCLINE_MESSAGE })
  .min(0, INCLINE_MESSAGE)
  .max(GYM_MAX_INCLINE, INCLINE_MESSAGE)
  .refine((n) => Number.isInteger(n * 2), INCLINE_MESSAGE);
export const SpeedKmhSchema = z
  .number({ error: SPEED_MESSAGE })
  .min(GYM_MIN_SPEED, SPEED_MESSAGE)
  .max(GYM_MAX_SPEED, SPEED_MESSAGE)
  .refine((n) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-9, SPEED_MESSAGE);

export const GymCardioPutSchema = z.strictObject({
  minutes: z.number({ error: GYM_MINUTES_MESSAGE }).int(GYM_MINUTES_MESSAGE).min(1, GYM_MINUTES_MESSAGE).max(600, GYM_MINUTES_MESSAGE),
  /** Treadmill only (Incline Treadmill Walk); each optional. */
  inclinePct: InclinePctSchema.optional(),
  speedKmh: SpeedKmhSchema.optional(),
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
  aiNote: z.string().nullable().default(null),
  /** Feature 010: an unusual jump awaiting "Looks right"; rollout-safe default. */
  jumpFlag: z.boolean().default(false),
  /** Treadmill details; defaults cover an API deployed before them. */
  inclinePct: z.number().nullable().default(null),
  speedKmh: z.number().nullable().default(null),
  updatedAt: z.string(),
});

export const GymLastSchema = z.object({
  date: DateSchema,
  sets: z.array(GymSetSchema).nullable(),
  minutes: z.number(),
  inclinePct: z.number().nullable().default(null),
  speedKmh: z.number().nullable().default(null),
  top: z.object({ weightKg: z.number(), reps: z.number() }).nullable(),
});

/** Feature 019: the member's own bests before the viewed day (the drawer's live PR check). Owner-only. */
export const PrBestsSchema = z.strictObject({
  sessions: z.number().int().nonnegative(),
  bestWeight: z.strictObject({ weightKg: z.number(), reps: z.number().int(), date: DateSchema }).nullable(),
  bestE1rm: z.number().nullable(),
  frontier: z.array(z.strictObject({ weightKg: z.number(), reps: z.number().int() })),
});

export const GymExerciseSchema = z.object({
  exerciseId: z.string(),
  name: z.string(),
  group: MuscleGroupSchema,
  kind: ExerciseKindSchema,
  isBuiltIn: z.boolean(),
  treadmill: z.boolean().default(false),
  rateMinutes: z.number().nullable(),
  rateCalories: z.number().nullable(),
  entry: GymEntryViewSchema.nullable(),
  last: GymLastSchema.nullable(),
  /** null = unknown (no badge); cardio is always null. */
  bests: PrBestsSchema.nullable().default(null),
});

export const GymViewSchema = z.object({
  /** The caller's own effective body weight; default covers an API deployed before it. */
  bodyWeightKg: z.number().default(75),
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
  /** Feature 019: PR records of this exercise on this date after the save (the toast). */
  prs: z.number().int().nonnegative().default(0),
  /** Feature 019: current weekly streak (0 = hidden in the toast). */
  streakWeeks: z.number().int().nonnegative().default(0),
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
