import { z } from "zod";
import { DateSchema } from "../domain/day";
import { SQUAD_MAX_TARGET, SQUAD_MIN_TARGET } from "../domain/squad";

/** Feature 010 API shapes. See specs/010-squad-leaderboard/contracts/api.md. */

/** What other members may see (constitution VI): name, avatar and whether it is the caller. Nothing else. */
export const SquadMemberSchema = z.strictObject({
  userId: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  isYou: z.boolean(),
});
export const PeriodSchema = z.enum(["week", "30d", "all"]);
/** null = unranked (hidden viewer's own row, or "—" on the relative toggle). */
export const RankSchema = z.number().int().min(1).nullable();

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

export const SquadLeaderboardSchema = z.strictObject({
  period: PeriodSchema,
  viewerHidden: z.boolean(),
  streaks: z.array(
    z.strictObject({
      member: SquadMemberSchema,
      rank: RankSchema,
      current: z.number().int(),
      best: z.number().int(),
      week: z.strictObject({ days: z.number().int(), target: z.number().int() }),
    }),
  ),
  prs: z.array(
    z.strictObject({
      member: SquadMemberSchema,
      rank: RankSchema,
      count: z.number().int().min(1),
      lifts: z.array(
        z.strictObject({
          exerciseName: z.string(),
          date: DateSchema,
          weightKg: z.number(),
          reps: z.number().int(),
          e1rm: z.number().nullable(),
        }),
      ),
    }),
  ),
  consistency: z.array(
    z.strictObject({
      member: SquadMemberSchema,
      rank: RankSchema,
      percent: z.number().int().min(0).max(100).nullable(),
      weekDays: z.number().int(),
      target: z.number().int(),
      weekVolumeKg: z.number(),
    }),
  ),
  lift: z.strictObject({
    exerciseId: z.string(),
    exerciseName: z.string(),
    options: z.array(z.strictObject({ exerciseId: z.string(), name: z.string() })),
    rows: z.array(
      z.strictObject({
        member: SquadMemberSchema,
        rank: RankSchema,
        relativeRank: RankSchema,
        e1rm: z.number(),
        weightKg: z.number(),
        reps: z.number().int(),
        relative: z.number().nullable(),
      }),
    ),
  }),
});
export type SquadLeaderboard = z.infer<typeof SquadLeaderboardSchema>;

export const SquadFeedItemSchema = z.strictObject({
  id: z.string(),
  member: SquadMemberSchema,
  kind: z.enum(["pr", "streak_week", "first_workout", "protein_streak"]),
  date: DateSchema,
  pr: z
    .strictObject({ exerciseName: z.string(), weightKg: z.number(), reps: z.number().int(), e1rm: z.number().nullable() })
    .nullable(),
  week: z.number().int().nullable(),
  highFives: z.number().int().min(0),
  highFivedByMe: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type SquadFeedItem = z.infer<typeof SquadFeedItemSchema>;
export const SquadFeedSchema = z.strictObject({ items: z.array(SquadFeedItemSchema).max(20) });
export type SquadFeed = z.infer<typeof SquadFeedSchema>;

export const HighFiveResultSchema = z.strictObject({ highFives: z.number().int().min(0), highFivedByMe: z.boolean() });
export type HighFiveResult = z.infer<typeof HighFiveResultSchema>;

/** Body of PUT /workouts/gym/entries/{date}/{exerciseId}/confirm. */
export const JumpConfirmSchema = z.strictObject({ updatedAt: z.iso.datetime() });
