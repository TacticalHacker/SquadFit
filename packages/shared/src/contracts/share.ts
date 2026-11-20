import { z } from "zod";
import { DateSchema } from "../domain/day";
import { MAX_PHOTO_BYTES } from "../domain/photo-entry";

/** Feature 016 API shapes. See specs/016-share-workout-story/contracts/api.md. All strict: no calories, body weight or targets. */

export const ShareRowSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("strength"),
    exerciseId: z.string(),
    name: z.string(),
    top: z.strictObject({ weightKg: z.number(), reps: z.number().int() }),
    volumeKg: z.number(),
  }),
  z.strictObject({ kind: z.literal("minutes"), name: z.string(), minutes: z.number() }),
]);
export type ShareRowDto = z.infer<typeof ShareRowSchema>;

export const SharePrSchema = z.strictObject({
  exerciseId: z.string(),
  name: z.string(),
  weightKg: z.number(),
  reps: z.number().int(),
  e1rm: z.number().nullable(),
  gainKg: z.number().nullable(),
});

export const SharePostStateSchema = z.strictObject({ posted: z.boolean(), hasPhoto: z.boolean(), canPost: z.boolean() });
export type SharePostState = z.infer<typeof SharePostStateSchema>;

const workoutFields = {
  label: z.string().nullable(),
  durationMin: z.number(),
  exerciseCount: z.number().int(),
  liftsImproved: z.number().int(),
  rows: z.array(ShareRowSchema).max(5),
  moreCount: z.number().int().min(0),
  prs: z.array(SharePrSchema),
};

/** GET /me/share/{date}: the caller's own figures for one day. */
export const ShareSummarySchema = z.strictObject({
  date: DateSchema,
  ...workoutFields,
  streak: z.strictObject({ weeks: z.number().int(), weekDays: z.number().int(), target: z.number().int() }),
  steps: z.number().int().nullable(),
  post: SharePostStateSchema,
});
export type ShareSummary = z.infer<typeof ShareSummarySchema>;

/** The workout block of a posted day in the squad feed: no steps, streak, calories or body weight. */
export const FeedWorkoutSchema = z.strictObject({ ...workoutFields, photoUrl: z.string().nullable() });
export type FeedWorkout = z.infer<typeof FeedWorkoutSchema>;

/** Base64 of a JPEG/WebP of at most 1.5 MB (the browser shrinks it first, like food photos); the server sniffs it. */
export const SharePostInputSchema = z.strictObject({
  photo: z.union([z.literal("keep"), z.literal("remove"), z.strictObject({ data: z.string().min(1).max(Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 4) })]),
});
export type SharePostInput = z.infer<typeof SharePostInputSchema>;

export const SharePostResultSchema = z.strictObject({ post: SharePostStateSchema });
