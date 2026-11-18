import { z } from "zod";
import { DateSchema } from "../domain/day";
import { ACTIVITY_SOURCES, STEP_GOAL_DEFAULT, STEP_GOAL_MAX, STEP_GOAL_MIN } from "../domain/activity";

/** Feature 012 shapes. See specs/012-health-activity-sync/contracts/api.md. Request bodies of the sync route are parsed leniently by `extractActivityDays` + `parseActivityDays`. */

export const ActivitySourceSchema = z.enum(ACTIVITY_SOURCES);

export const SavedActivityDaySchema = z.strictObject({
  date: DateSchema,
  steps: z.number().int(),
  activeKcal: z.number().int().nullable(),
  distanceKm: z.number().nullable(),
  goalHit: z.boolean(),
});
export type SavedActivityDay = z.infer<typeof SavedActivityDaySchema>;

export const ActivitySaveResultSchema = z.strictObject({
  saved: z.array(SavedActivityDaySchema),
  stepGoal: z.number().int(),
  source: ActivitySourceSchema,
});
export type ActivitySaveResult = z.infer<typeof ActivitySaveResultSchema>;

const STEP_GOAL_MESSAGE = "Step goal must be a whole number from 1,000 to 50,000";
export const StepSettingsSchema = z.strictObject({
  dailyStepGoal: z.number({ error: STEP_GOAL_MESSAGE }).int(STEP_GOAL_MESSAGE).min(STEP_GOAL_MIN, STEP_GOAL_MESSAGE).max(STEP_GOAL_MAX, STEP_GOAL_MESSAGE),
  shareSteps: z.boolean(),
});
export type StepSettings = z.infer<typeof StepSettingsSchema>;
export const DEFAULT_STEP_SETTINGS: StepSettings = { dailyStepGoal: STEP_GOAL_DEFAULT, shareSteps: true };

/** GET /me/health-sync */
export const HealthSyncStatusSchema = z.strictObject({
  token: z.strictObject({ createdAt: z.iso.datetime(), lastUsedAt: z.iso.datetime().nullable() }).nullable(),
  lastSync: z.strictObject({ syncedAt: z.iso.datetime(), source: ActivitySourceSchema, date: DateSchema }).nullable(),
  steps: StepSettingsSchema,
});
export type HealthSyncStatus = z.infer<typeof HealthSyncStatusSchema>;

/** POST /me/health-token: the only response that ever carries the token. */
export const HealthTokenIssuedSchema = z.strictObject({
  token: z.string().regex(/^sfh_[A-Za-z0-9_-]{43}$/),
  createdAt: z.iso.datetime(),
});
export type HealthTokenIssued = z.infer<typeof HealthTokenIssuedSchema>;

/** A member's steps for one day as shown to squad members (FR-021/023). */
export const StepsDaySchema = z.strictObject({ steps: z.number().int(), goalHit: z.boolean() });

/** MCP `upsert_daily_activity` input (feature 012). Values are then normalised and range-checked by `parseActivityDays`. */
export const UpsertActivityShape = {
  days: z
    .array(
      z.object({
        date: z.string().describe("The member's local calendar date, YYYY-MM-DD (today or up to 30 days ago)"),
        steps: z.number().describe("Whole-day step total, 0-100000"),
        active_kcal: z.number().optional().describe("Whole-day active energy in kcal, 0-5000 (optional)"),
        distance_km: z.number().optional().describe("Whole-day walking + running distance in km, 0-150 (optional)"),
      }),
    )
    .min(1)
    .max(31)
    .describe("One entry per day, at most 31"),
};
export const UpsertActivityInputSchema = z.object(UpsertActivityShape);
