import { z } from "zod";
import { DateSchema } from "../domain/day";
import { SQUAD_MAX_TARGET, SQUAD_MIN_TARGET } from "../domain/squad";
import { FeedWorkoutSchema } from "./share";

/** Feature 010 API shapes. See specs/010-squad-leaderboard/contracts/api.md. */

/** What other members may see (constitution VI): name, avatar and whether it is the caller. Nothing else. */
export const SquadMemberSchema = z.strictObject({
  userId: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  isYou: z.boolean(),
});

export const NutritionSharingSchema = z.enum(["off", "totals", "meals"]);
export type NutritionSharing = z.infer<typeof NutritionSharingSchema>;

export const SquadSettingsSchema = z.strictObject({
  weeklyTarget: z.number().int().min(SQUAD_MIN_TARGET).max(SQUAD_MAX_TARGET),
  leaderboardVisible: z.boolean(),
  shareBodyWeight: z.boolean(),
  /** Feature 011: what food other members may see. Default off. */
  // Defaults to off so a web app that is ahead of the API (or the reverse during a deploy) still parses.
  nutritionSharing: NutritionSharingSchema.default("off"),
});
export type SquadSettings = z.infer<typeof SquadSettingsSchema>;
export const DEFAULT_SQUAD_SETTINGS: SquadSettings = { weeklyTarget: 3, leaderboardVisible: true, shareBodyWeight: false, nutritionSharing: "off" };

/** PUT /me/squad body. `nutritionSharing` may be left out (keeps the current level); `dismissPrompt` only hides the one-time card. */
export const SquadSettingsInputSchema = SquadSettingsSchema.extend({
  nutritionSharing: NutritionSharingSchema.optional(),
  dismissPrompt: z.boolean().optional(),
});
export type SquadSettingsInput = z.infer<typeof SquadSettingsInputSchema>;

export const WeeklyStreakSchema = z.strictObject({
  current: z.number().int(),
  best: z.number().int(),
  weekDays: z.number().int(),
  target: z.number().int(),
});
export type WeeklyStreak = z.infer<typeof WeeklyStreakSchema>;

export const SquadFeedItemSchema = z.strictObject({
  id: z.string(),
  member: SquadMemberSchema,
  kind: z.enum(["pr", "streak_week", "first_workout", "protein_streak", "step_streak", "badge", "workout_day"]),
  date: DateSchema,
  pr: z
    .strictObject({
      exerciseName: z.string(),
      weightKg: z.number(),
      reps: z.number().int(),
      e1rm: z.number().nullable(),
      /** Feature 013: gain over the previous best; null on items written before it. */
      gainKg: z.number().nullable(),
      /** Feature 019: null on items written before it. */
      type: z.enum(["weight", "reps", "e1rm"]).nullable().default(null),
      gainReps: z.number().int().nullable().default(null),
    })
    .nullable(),
  week: z.number().int().nullable(),
  /** Feature 013: badge items only. */
  club: z.enum(["club225", "club300", "club400", "club450", "club500"]).nullable(),
  /** Feature 016: a workout day the member posted; computed on read. Absent/null for other kinds. */
  workout: FeedWorkoutSchema.nullable().default(null),
  reactions: z.strictObject({
    fire: z.strictObject({ count: z.number().int().min(0), mine: z.boolean() }),
    muscle: z.strictObject({ count: z.number().int().min(0), mine: z.boolean() }),
    crown: z.strictObject({ count: z.number().int().min(0), mine: z.boolean() }),
  }),
  canReact: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type SquadFeedItem = z.infer<typeof SquadFeedItemSchema>;
export const SquadFeedSchema = z.strictObject({ items: z.array(SquadFeedItemSchema).max(20) });
export type SquadFeed = z.infer<typeof SquadFeedSchema>;


/** Body of PUT /workouts/gym/entries/{date}/{exerciseId}/confirm. */
export const JumpConfirmSchema = z.strictObject({ updatedAt: z.iso.datetime() });
