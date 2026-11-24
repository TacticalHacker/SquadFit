import { z } from "zod";
import { DateSchema } from "../domain/day";
import { BodyWeightSchema } from "../domain/profile";
import { WEIGHT_RANGES } from "../domain/bodyweight";
import { SquadMemberSchema } from "./squad";

/** Feature 014 shapes. See specs/014-bodyweight-tracker/contracts/api.md. Owner-only: never in squad/public views. */

export const WeightRangeSchema = z.enum(WEIGHT_RANGES).default("M");

export const WeightEntrySchema = z.strictObject({
  id: z.string(),
  date: DateSchema,
  recordedAt: z.string(),
  weightKg: z.number(),
});
export type WeightEntry = z.infer<typeof WeightEntrySchema>;

const kg = z.number().nullable();
export const WeightSlotSchema = z.strictObject({
  start: DateSchema,
  end: DateSchema,
  count: z.number().int(),
  min: kg,
  max: kg,
  average: kg,
  trend: kg,
});

export const WeightViewSchema = z.strictObject({
  range: z.enum(WEIGHT_RANGES),
  start: DateSchema,
  end: DateSchema,
  summary: z.strictObject({ average: z.number(), min: z.number(), max: z.number() }).nullable(),
  slots: z.array(WeightSlotSchema),
  latest: z.strictObject({ date: DateSchema, weightKg: z.number(), recordedAt: z.string() }).nullable(),
  profileWeightKg: z.number().nullable(),
  editableDays: z.array(z.strictObject({ date: DateSchema, entries: z.array(WeightEntrySchema) })),
});

/** POST /me/weight. Date defaults to today in the member's timezone. */
export const WeightLogInputSchema = z.strictObject({
  weightKg: BodyWeightSchema,
  date: DateSchema.optional(),
});
export type WeightLogInput = z.infer<typeof WeightLogInputSchema>;

/**
 * Feature 017: GET /squad/weight. Only members who share their weight (and are on the leaderboard) appear, and only as
 * kg change from their first weigh-in in the window: never absolute weight. `sharing` = the caller shares theirs.
 */
export const SquadWeightSchema = z.strictObject({
  range: z.enum(WEIGHT_RANGES),
  start: DateSchema,
  end: DateSchema,
  slots: z.array(z.strictObject({ start: DateSchema, end: DateSchema })),
  sharing: z.boolean(),
  members: z.array(
    z.strictObject({
      member: SquadMemberSchema,
      deltas: z.array(z.number().nullable()),
      change: z.number(),
    }),
  ),
});
export type SquadWeight = z.infer<typeof SquadWeightSchema>;
