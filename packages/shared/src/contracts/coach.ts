import { z } from "zod";
import {
  NOTE_MAX_RECOMMENDATIONS,
  NOTE_RECOMMENDATION_MAX,
  NOTE_SUMMARY_MAX,
} from "../domain/coach-note";
import { DateSchema } from "../domain/day";
import { CaloriesSchema, MacrosSchema } from "../domain/nutrition";
import { CalorieTargetSchema, ProteinTargetSchema } from "../domain/profile";

/** Raw shapes are what the MCP SDK registers; the strict objects below are what handlers parse with. */
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
export const CoachNoteInputSchema = z.strictObject(CoachNoteShape);
export type CoachNoteInput = z.infer<typeof CoachNoteInputSchema>;

export const HistoryShape = {
  startDate: z.string().describe("Start date, YYYY-MM-DD"),
  endDate: z.string().describe("End date, YYYY-MM-DD (not after today; window at most 31 days)"),
};
export const HistoryInputSchema = z.strictObject(HistoryShape);

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

export const CoachNoteSchema = z.object({
  date: DateSchema,
  summaryMarkdown: z.string(),
  recommendations: z.array(z.string()),
  generatedBy: z.literal("AI"),
  updatedAt: z.iso.datetime(),
});
export type CoachNote = z.infer<typeof CoachNoteSchema>;

export const CoachNoteResponseSchema = z.object({ note: CoachNoteSchema.nullable() });
export type CoachNoteResponse = z.infer<typeof CoachNoteResponseSchema>;

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
