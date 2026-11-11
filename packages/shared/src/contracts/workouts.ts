import { z } from "zod";
import { MinutesSchema } from "../domain/calories";
import { DateSchema } from "../domain/day";

export const EntryPutSchema = z.object({ minutes: MinutesSchema.optional() });
export type EntryPut = z.infer<typeof EntryPutSchema>;

const SummarySchema = z.object({ totalMinutes: z.number(), totalCalories: z.number() });

export const WorkoutRowSchema = z.object({
  workoutId: z.string(),
  name: z.string(),
  isStandard: z.boolean(),
  removed: z.boolean(),
  defaultMinutes: z.number(),
  defaultCalories: z.number(),
  entry: z
    .object({
      minutes: z.number(),
      calories: z.number(),
      rateMinutes: z.number(),
      rateCalories: z.number(),
    })
    .nullable(),
});

export const DayViewSchema = z.object({
  date: DateSchema,
  today: DateSchema,
  timezone: z.string(),
  editable: z.boolean(),
  rows: z.array(WorkoutRowSchema),
  summary: SummarySchema,
});

export const CustomWorkoutSchema = z.object({
  workoutId: z.string(),
  name: z.string(),
  defaultMinutes: z.number(),
  defaultCalories: z.number(),
});
export const CustomWorkoutResponseSchema = z.object({ workout: CustomWorkoutSchema });
export type CustomWorkoutResponse = z.infer<typeof CustomWorkoutResponseSchema>;

export const SummaryRangeResponseSchema = z.object({
  days: z.array(z.object({ date: DateSchema, totalMinutes: z.number(), totalCalories: z.number() })),
});
export type SummaryRangeResponse = z.infer<typeof SummaryRangeResponseSchema>;
