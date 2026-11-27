import { z } from "zod";
import { DateSchema } from "../domain/day";
import { MealSchema } from "../domain/nutrition";
import { SquadMemberSchema } from "./squad";
import { ClubSchema, ReactionsSchema } from "./squad-boards";
import { StepsDaySchema } from "./activity";

/** Feature 011 API shapes. See specs/011-squad-profiles-nutrition/contracts/api.md. All strict. */

const MacrosShare = z.strictObject({ protein: z.number(), carbs: z.number(), fat: z.number() });

/** Daily totals level: the only food figures another member may see without "Totals + meals". */
export const NutritionTotalsSchema = z.strictObject({
  caloriesIn: z.number(),
  calorieTarget: z.number().nullable(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  proteinTarget: z.number().nullable(),
  burned: z.number(),
  burnedAdjusted: z.boolean(),
  pending: z.number().int(),
});
export const NutritionMealsSchema = NutritionTotalsSchema.extend({
  meals: z.array(
    z.strictObject({
      meal: MealSchema,
      subtotalCalories: z.number(),
      macros: MacrosShare.nullable(),
      items: z.array(
        z.strictObject({
          name: z.string(),
          servings: z.number(),
          calories: z.number(),
          macros: MacrosShare.nullable(),
          caption: z.string().optional(),
          photoUrl: z.string().optional(),
        }),
      ),
    }),
  ),
});
/** Level off never reaches a schema: the `nutrition` key is simply absent. */
export const NutritionSchema = z.union([NutritionMealsSchema, NutritionTotalsSchema]);

const SetRowSchema = z.strictObject({ weightKg: z.number(), reps: z.number().int(), completed: z.boolean() });
const TopSetSchema = z.strictObject({ weightKg: z.number(), reps: z.number().int() });
export const ExerciseSummarySchema = z.strictObject({
  exerciseId: z.string(),
  exerciseName: z.string(),
  kind: z.enum(["strength", "cardio"]),
  minutes: z.number(),
  volumeKg: z.number(),
  topSet: TopSetSchema.nullable(),
  sets: z.array(SetRowSchema).optional(),
});
export const SessionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("gym"), exercises: z.array(ExerciseSummarySchema), minutes: z.number(), volumeKg: z.number() }),
  z.strictObject({ kind: z.literal("activity"), name: z.string(), minutes: z.number() }),
]);

export const DayCardSchema = z.strictObject({
  date: DateSchema,
  sessions: z.array(SessionSchema),
  volumeKg: z.number(),
  durationMin: z.number(),
  topSet: z.strictObject({ exerciseName: z.string(), weightKg: z.number(), reps: z.number().int() }).nullable(),
  prBadges: z.array(z.strictObject({ exerciseName: z.string(), weightKg: z.number(), reps: z.number().int(), e1rm: z.number().nullable() })),
  /** `<authorSub>~day#<date>`, the id the reaction endpoints take. */
  id: z.string(),
  reactions: ReactionsSchema,
  canReact: z.boolean(),
  nutrition: NutritionSchema.optional(),
  /** Feature 012: present only when the owner shares steps (or is the viewer) and synced that day. */
  steps: StepsDaySchema.optional(),
});
export type DayCard = z.infer<typeof DayCardSchema>;

export const DayLogSchema = z.union([
  DayCardSchema.extend({ rest: z.literal(false) }),
  z.strictObject({ date: DateSchema, rest: z.literal(true), isToday: z.boolean() }),
]);
export type DayLog = z.infer<typeof DayLogSchema>;

const LiftSetSchema = z.strictObject({ weightKg: z.number(), reps: z.number().int(), e1rm: z.number().nullable(), date: DateSchema });

export const NutritionLevelSchema = z.enum(["off", "totals", "meals"]);

export const MemberProfileSchema = z.strictObject({
  member: SquadMemberSchema,
  memberSince: DateSchema,
  streak: z.strictObject({ current: z.number().int(), best: z.number().int() }),
  weeklyTarget: z.number().int(),
  week: z.strictObject({ days: z.number().int(), target: z.number().int() }),
  prs: z.array(z.strictObject({ exerciseId: z.string(), exerciseName: z.string(), best: LiftSetSchema.nullable(), bestE1rm: LiftSetSchema.nullable() })),
  heatmap: z.strictObject({ cells: z.array(z.strictObject({ date: DateSchema, level: z.number().int().min(0).max(4) })) }),
  nutritionLevel: NutritionLevelSchema,
  isYou: z.boolean(),
  /** Feature 013: total weight lifted (reps × weight) this week so far and all of last week; profile only, never ranked. */
  weightLifted: z.strictObject({ thisWeek: z.number().min(0), lastWeek: z.number().min(0) }),
  /** Feature 013: club badges held, lowest first. */
  badges: z.array(z.strictObject({ club: ClubSchema, date: DateSchema })),
  /** Feature 021: raids this member helped clear (Raid Cleared stickers). */
  raidsCleared: z.number().int().nonnegative().default(0),
  /**
   * Feature 012: absent when the owner does not share steps. Active calories and distance appear only here, as
   * information from Apple Health (constitution VI 2.5.0). `shared` tells the owner whether others see it.
   */
  steps: z
    .strictObject({
      goal: z.number().int(),
      shared: z.boolean(),
      days: z.array(
        z.strictObject({ date: DateSchema, steps: z.number().int().nullable(), activeKcal: z.number().int().nullable(), distanceKm: z.number().nullable() }),
      ),
    })
    .optional(),
});
export type MemberProfile = z.infer<typeof MemberProfileSchema>;

export const TimelineSchema = z.strictObject({
  items: z.array(
    z.discriminatedUnion("type", [
      z.strictObject({ type: z.literal("day"), card: DayCardSchema }),
      z.strictObject({
        type: z.literal("milestone"),
        id: z.string(),
        kind: z.enum(["streak_week", "first_workout", "protein_streak", "step_streak"]),
        date: DateSchema,
        week: z.number().int().nullable(),
        reactions: ReactionsSchema,
        canReact: z.boolean(),
      }),
    ]),
  ),
  nextCursor: DateSchema.nullable(),
});
export type Timeline = z.infer<typeof TimelineSchema>;

export const TodaySchema = z.strictObject({
  date: DateSchema,
  cards: z.array(DayCardSchema.extend({ member: SquadMemberSchema })),
  /** Feature 012: members sharing steps who synced this day but did not train ("Rest day · 11,240 steps"). */
  restDays: z.array(z.strictObject({ member: SquadMemberSchema, steps: StepsDaySchema })).default([]),
});
export type TodayCards = z.infer<typeof TodaySchema>;
