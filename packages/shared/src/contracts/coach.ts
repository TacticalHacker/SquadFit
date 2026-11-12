import { z } from "zod";
import {
  ACTION_MAX,
  AI_NOTE_MAX,
  COACH_STATUSES,
  HEADLINE_MAX,
  HIGHLIGHT_MAX,
  MAX_ACTIONS,
  MAX_HIGHLIGHTS,
  NOTE_MAX_RECOMMENDATIONS,
  NOTE_RECOMMENDATION_MAX,
  NOTE_SUMMARY_MAX,
} from "../domain/coach-note";
import { DateSchema } from "../domain/day";
import { MinutesSchema } from "../domain/calories";
import { FoodNameSchema } from "../domain/foods";
import { GYM_MAX_SETS } from "../domain/gym";
import { CaloriesSchema, MacrosSchema, MealSchema, ServingsSchema } from "../domain/nutrition";
import { GymSetSchema } from "./gym";
import { CalorieTargetSchema, ProteinTargetSchema } from "../domain/profile";

/** Raw shapes are what the MCP SDK registers; the strict objects below are what handlers parse with. */
/** Retired markdown note (feature 004): kept only so old agents get a clear error from post_daily_coach_note. */
export const CoachNoteShape = {
  date: DateSchema.describe("Date the note is for, YYYY-MM-DD (today or up to 30 days ago)"),
  summaryMarkdown: z
    .string()
    .trim()
    .min(1, "Summary is required")
    .max(NOTE_SUMMARY_MAX, `Summary must be at most ${NOTE_SUMMARY_MAX} characters`)
    .describe("Markdown summary of performance and nutrition"),
  recommendations: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Recommendations cannot be empty")
        .max(NOTE_RECOMMENDATION_MAX, `Each recommendation must be at most ${NOTE_RECOMMENDATION_MAX} characters`),
    )
    .min(1, "At least one recommendation is required")
    .max(NOTE_MAX_RECOMMENDATIONS, `At most ${NOTE_MAX_RECOMMENDATIONS} recommendations`)
    .describe("Actionable tips, one per item"),
};

export const HistoryShape = {
  startDate: z.string().describe("Start date, YYYY-MM-DD"),
  endDate: z.string().describe("End date, YYYY-MM-DD (not after today; window at most 31 days)"),
};
export const HistoryInputSchema = z.strictObject(HistoryShape);

/** Feature 007: get_full_context window; both ends optional (default the last 7 days). */
export const FullContextShape = {
  startDate: DateSchema.optional().describe("Start date, YYYY-MM-DD (optional)"),
  endDate: DateSchema.optional().describe("End date, YYYY-MM-DD, not after today (optional; window at most 31 days)"),
};
export const FullContextInputSchema = z.strictObject(FullContextShape);

export const TargetsShape = {
  dailyCalorieTarget: CalorieTargetSchema.optional().describe("Daily calorie target in kcal (500-10000)"),
  dailyProteinTarget: ProteinTargetSchema.nullable().optional().describe("Daily protein target in grams (10-500); null clears it"),
};
export const TargetsInputSchema = z
  .strictObject(TargetsShape)
  .refine((v) => v.dailyCalorieTarget !== undefined || v.dailyProteinTarget !== undefined, {
    message: "Provide dailyCalorieTarget and/or dailyProteinTarget",
  });
export type TargetsInput = z.infer<typeof TargetsInputSchema>;

/** A single line of text: trimmed, `min`–`max` characters, no line breaks. */
const line = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} cannot be empty`)
    .max(max, `${label} must be at most ${max} characters`)
    .refine((v) => !/[\r\n]/.test(v), `${label} must be a single line`);

export const CoachStatusSchema = z.enum(COACH_STATUSES);

/** Feature 007: the structured overall note (FR-015). Replaces the markdown note. */
export const OverallNoteShape = {
  date: DateSchema.describe("Date the note is for, YYYY-MM-DD (today or up to 30 days ago)"),
  headline: line("Headline", HEADLINE_MAX).describe(
    `Punchy one-liner (at most ${HEADLINE_MAX} characters) shown on one line in the compact bar on the member's home screen`,
  ),
  status: CoachStatusSchema.describe("on_track, needs_attention, or pr_alert (a personal record today)"),
  highlights: z
    .array(line("Highlight", HIGHLIGHT_MAX))
    .min(1, "At least one highlight is required")
    .max(MAX_HIGHLIGHTS, `At most ${MAX_HIGHLIGHTS} highlights`)
    .describe(`1-${MAX_HIGHLIGHTS} short bullets covering gym performance and nutrition (each at most ${HIGHLIGHT_MAX} characters)`),
  actionItems: z
    .array(line("Action item", ACTION_MAX))
    .max(MAX_ACTIONS, `At most ${MAX_ACTIONS} action items`)
    .describe(`0-${MAX_ACTIONS} things the member can do and tick off today (each at most ${ACTION_MAX} characters)`),
};
export const OverallNoteInputSchema = z.strictObject(OverallNoteShape);
export type OverallNoteInput = z.infer<typeof OverallNoteInputSchema>;

export const CoachActionSchema = z.object({ text: z.string(), done: z.boolean() });
export const OverallNoteSchema = z.object({
  date: DateSchema,
  headline: z.string(),
  status: CoachStatusSchema,
  highlights: z.array(z.string()),
  actions: z.array(CoachActionSchema),
  generatedBy: z.literal("AI"),
  updatedAt: z.iso.datetime(),
});
export type OverallNote = z.infer<typeof OverallNoteSchema>;

export const PulseMetricsSchema = z.object({ netCalories: z.number(), proteinG: z.number(), gymVolumeKg: z.number() });
export type PulseMetrics = z.infer<typeof PulseMetricsSchema>;

/** GET /coach-note: `metrics` is present exactly when `note` is. */
export const CoachPulseResponseSchema = z.object({ note: OverallNoteSchema.nullable(), metrics: PulseMetricsSchema.nullable() });
export type CoachPulseResponse = z.infer<typeof CoachPulseResponseSchema>;

/** PUT /coach-note/{date}/actions/{index}. `noteUpdatedAt` pins the note version the member saw. */
export const CoachActionPutSchema = z.strictObject({ done: z.boolean(), noteUpdatedAt: z.iso.datetime() });
export const CoachActionsResponseSchema = z.object({ actions: z.array(CoachActionSchema) });
export type CoachActionsResponse = z.infer<typeof CoachActionsResponseSchema>;

/** Feature 007: the AI adjusts one workout entry's calories and duration with a one-line reason (FR-008). */
export const UpdateWorkoutCaloriesShape = {
  logId: z.string().describe("The workout's logId from get_full_context or get_user_history"),
  updatedCalories: z.number().int("Whole kcal").min(1, "1-5000 kcal").max(5000, "1-5000 kcal").describe("New calories burned (whole number, 1-5000)"),
  updatedDurationMins: z.number().int("Whole minutes").min(1, "1-600 minutes").max(600, "1-600 minutes").describe("New duration in minutes (1-600)"),
  reasoning: line("Reasoning", AI_NOTE_MAX).describe(
    `One line (at most ${AI_NOTE_MAX} characters) shown to the member, e.g. "6.0 MET compound lift + rest intervals @ 78kg"`,
  ),
};
export const UpdateWorkoutCaloriesInputSchema = z.strictObject(UpdateWorkoutCaloriesShape);

/** Feature 007: the AI creates or replaces one gym exercise entry (FR-010). Totals are always the app's own. */
const AiSetSchema = z.object({
  reps: GymSetSchema.shape.reps,
  weightKg: GymSetSchema.shape.weightKg,
  completed: z.boolean().optional().describe("Whether the set was done; default true"),
});
export const UpsertWorkoutShape = {
  date: DateSchema.describe("Day of the workout, YYYY-MM-DD (today or the 2 previous days)"),
  exercise: z.string().trim().min(1, "Exercise is required").max(60).describe(
    "Exercise id (gx-..., gc-...) or its exact name, e.g. \"Bench Press\" (case and spacing ignored)",
  ),
  sets: z
    .array(AiSetSchema)
    .min(1, "Add at least one set")
    .max(GYM_MAX_SETS, `At most ${GYM_MAX_SETS} sets`)
    .optional()
    .describe("Strength exercises: each set's reps and weightKg (0 = bodyweight, steps of 0.5)"),
  minutes: MinutesSchema.optional().describe("Cardio exercises only: minutes (1-600)"),
};
export const UpsertWorkoutInputSchema = z.strictObject(UpsertWorkoutShape);

/** Feature 007: the AI logs or corrects a food entry (FR-011). Either `logId` (update) or `date`+`meal`+`food` (create). */
export const UpsertFoodShape = {
  logId: z.string().optional().describe("Update this existing entry (from get_full_context); omit to create"),
  date: DateSchema.optional().describe("Create: day, YYYY-MM-DD (today or the 2 previous days)"),
  meal: MealSchema.optional().describe("breakfast, lunch, dinner or snacks (required to create)"),
  food: FoodNameSchema.optional().describe(
    "Create: a built-in food id (sf-...), the member's own food id, the exact name of either, or any other name for a free-form entry",
  ),
  servings: ServingsSchema.optional().describe("Foods from a list: servings (default 1); calories follow"),
  name: FoodNameSchema.optional().describe("Update of a free-form entry: new name"),
  calories: CaloriesSchema.optional().describe("Free-form entries only: total calories (1-5000)"),
  protein: MacrosSchema.shape.protein.optional().describe("Free-form entries only, with carbs and fat: grams"),
  carbs: MacrosSchema.shape.carbs.optional().describe("Free-form entries only, with protein and fat: grams"),
  fat: MacrosSchema.shape.fat.optional().describe("Free-form entries only, with protein and carbs: grams"),
};
export const UpsertFoodInputSchema = z
  .strictObject(UpsertFoodShape)
  .refine((v) => [v.protein, v.carbs, v.fat].every((x) => x === undefined) || [v.protein, v.carbs, v.fat].every((x) => x !== undefined), {
    message: "Give protein, carbs and fat together, or none of them",
    path: ["protein"],
  })
  .refine((v) => v.logId !== undefined || (v.date !== undefined && v.meal !== undefined && v.food !== undefined), {
    message: "Give logId to update, or date, meal and food to create",
    path: ["logId"],
  });
export type UpsertFoodInput = z.infer<typeof UpsertFoodInputSchema>;

/** Photo food log tools (feature 005). `date` is part of an entry's id because entries are keyed by day. */
export const ListPendingShape = {
  limit: z.number().int().min(1).max(50).optional().describe("How many pending meals to return (1-50, default 20)"),
};
export const ListPendingInputSchema = z.strictObject(ListPendingShape);

export const GetPhotoShape = {
  date: DateSchema.describe("The entry's date, YYYY-MM-DD, as listed"),
  entryId: z.string().describe("The entry id, as listed"),
};
export const GetPhotoInputSchema = z.strictObject(GetPhotoShape);

export const SubmitEstimateShape = {
  ...GetPhotoShape,
  calories: CaloriesSchema.describe("Estimated total calories for the whole meal (whole number, 1-5000)"),
  protein: MacrosSchema.shape.protein.describe("Estimated protein in grams (0-500, one decimal)"),
  carbs: MacrosSchema.shape.carbs.describe("Estimated carbohydrates in grams (0-500, one decimal)"),
  fat: MacrosSchema.shape.fat.describe("Estimated fat in grams (0-500, one decimal)"),
};
export const SubmitEstimateInputSchema = z.strictObject(SubmitEstimateShape);
