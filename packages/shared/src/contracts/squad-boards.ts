import { z } from "zod";
import { DateSchema } from "../domain/day";
import { BIG3_LIFT_IDS } from "../domain/squad";
import { RECORD_IDS } from "../domain/boards";
import { SquadMemberSchema } from "./squad";

/** Feature 013 API shapes. See specs/013-squad-v2/contracts/api.md. All strict (constitution VI). */

export const ClubSchema = z.enum(["club225", "club300", "club400", "club450", "club500"]);
export type Club = z.infer<typeof ClubSchema>;

export const REACTION_TYPES = ["fire", "muscle", "crown"] as const;
export const ReactionTypeSchema = z.enum(REACTION_TYPES);
export type ReactionType = z.infer<typeof ReactionTypeSchema>;
const ReactionCount = z.strictObject({ count: z.number().int().min(0), mine: z.boolean() });
export const ReactionsSchema = z.strictObject({ fire: ReactionCount, muscle: ReactionCount, crown: ReactionCount });
export type Reactions = z.infer<typeof ReactionsSchema>;
export const ReactionResultSchema = z.strictObject({ reactions: ReactionsSchema });

const Rank = z.number().int().min(1).nullable();
const row = <T extends z.ZodRawShape>(shape: T) => z.strictObject({ member: SquadMemberSchema, rank: Rank, club: ClubSchema.nullable(), ...shape });
const int = z.number().int().min(0);

export const SquadBoardSchema = z.discriminatedUnion("id", [
  z.strictObject({ id: z.literal("workouts"), rows: z.array(row({ days: int })) }),
  z.strictObject({ id: z.literal("streak"), rows: z.array(row({ weeks: int, best: int, weekDays: int, target: int })) }),
  z.strictObject({ id: z.literal("improved"), rows: z.array(row({ count: int })) }),
  z.strictObject({ id: z.literal("steps"), rows: z.array(row({ avgSteps: int, syncedDays: int })) }),
  z.strictObject({
    id: z.literal("prJump"),
    rows: z.array(row({ kg: z.number(), liftName: z.string(), pct: int, pctRank: Rank, pctLiftName: z.string(), pctKg: z.number() })),
  }),
  z.strictObject({
    id: z.literal("strength"),
    rows: z.array(row({ big3: z.number().nullable(), big4: z.number().nullable(), big4Rank: Rank, big3Partial: z.number(), missing: z.array(z.string()) })),
  }),
  z.strictObject({ id: z.literal("protein"), rows: z.array(row({ hitDays: int, loggedDays: int })) }),
]);
export type SquadBoardView = z.infer<typeof SquadBoardSchema>;

export const SquadBoardsSchema = z.strictObject({
  /** "YYYY-MM" in the squad timezone. */
  month: z.string().regex(/^\d{4}-\d{2}$/),
  viewer: z.strictObject({ hidden: z.boolean(), nutritionPrompt: z.boolean(), targetsPrompt: z.boolean() }),
  boards: z.array(SquadBoardSchema),
});
export type SquadBoards = z.infer<typeof SquadBoardsSchema>;

export const HallOfFameSchema = z.strictObject({
  records: z.array(
    z.strictObject({
      id: z.enum(RECORD_IDS),
      holder: SquadMemberSchema.nullable(),
      club: ClubSchema.nullable(),
      value: z.number(),
      liftName: z.string().nullable(),
      date: DateSchema.nullable(),
      month: z.string().nullable(),
    }),
  ),
});
export type HallOfFame = z.infer<typeof HallOfFameSchema>;

/** For tests and copy: the Big 3 is these lifts. */
export const BIG3_IDS = BIG3_LIFT_IDS;
