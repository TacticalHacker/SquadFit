import {
  completeMacros,
  EDIT_WINDOW_DAYS,
  addDays,
  GetPhotoInputSchema,
  GetPhotoShape,
  isEditableDay,
  ListPendingInputSchema,
  ListPendingShape,
  SubmitEstimateInputSchema,
  SubmitEstimateShape,
} from "@calci/shared";
import { ENTRY_ID_PATTERN, type FoodEntryItem } from "../food-repo";
import { describeIssues, fail, stripUnknown, type Tool, type ToolContext, type ToolResult } from "./types";
import { safeRefreshProtein } from "../protein-events";

// Photos, captions and entry values never go into error text or logs (spec FR-014).
const NOT_FOUND = "No such photo meal. Use list_pending_food_photos to see the current ones.";

/** The caller's own photo entry, or null: another member's id simply does not exist for this key (FR-016). */
async function ownPhotoEntry(ctx: ToolContext, date: string, entryId: string): Promise<FoodEntryItem | null> {
  if (!ENTRY_ID_PATTERN.test(entryId)) return null;
  const entry = await ctx.deps.food.getEntry(ctx.userId, date, entryId);
  return entry?.source === "photo" && entry.photoKey && entry.photo ? entry : null;
}

const listPendingFoodPhotos: Tool = {
  name: "list_pending_food_photos",
  description:
    "Lists the member's photo meals that still need a calorie and macro estimate (today and the two days before), newest first. Then call get_food_photo for each and submit_food_estimate.",
  shape: ListPendingShape,
  async run(args, ctx) {
    const parsed = ListPendingInputSchema.safeParse(stripUnknown(args, ListPendingShape));
    if (!parsed.success) return fail(describeIssues(parsed.error));
    const limit = parsed.data.limit ?? 20;
    const from = addDays(ctx.today, -EDIT_WINDOW_DAYS);
    const entries = (await ctx.deps.food.listEntriesInRange(ctx.userId, from, ctx.today))
      .filter((e) => e.source === "photo" && e.photo?.status === "pending")
      .sort((a, b) => (a.date === b.date ? (a.entryId < b.entryId ? 1 : -1) : a.date < b.date ? 1 : -1));
    return {
      text: JSON.stringify({
        timezone: ctx.timezone,
        today: ctx.today,
        hasMore: entries.length > limit,
        entries: entries.slice(0, limit).map((e) => ({
          date: e.date,
          entryId: e.entryId,
          meal: e.meal,
          caption: e.photo?.caption ?? "",
          createdAt: e.createdAt,
        })),
      }),
    };
  },
};

const getFoodPhoto: Tool = {
  name: "get_food_photo",
  description: "Returns the photo of one of the member's meals as an image, plus its meal and caption, so it can be analysed.",
  shape: GetPhotoShape,
  async run(args, ctx): Promise<ToolResult> {
    const parsed = GetPhotoInputSchema.safeParse(stripUnknown(args, GetPhotoShape));
    if (!parsed.success) return fail(describeIssues(parsed.error));
    const entry = await ownPhotoEntry(ctx, parsed.data.date, parsed.data.entryId);
    const photo = entry?.photoKey ? await ctx.deps.photos.get(entry.photoKey) : null;
    if (!entry || !photo) return fail(NOT_FOUND);
    return {
      image: { data: Buffer.from(photo.bytes).toString("base64"), mimeType: photo.contentType },
      text: JSON.stringify({ date: entry.date, entryId: entry.entryId, meal: entry.meal, caption: entry.photo?.caption ?? "" }),
    };
  },
};

const submitFoodEstimate: Tool = {
  name: "submit_food_estimate",
  description:
    "Saves your estimate of calories and macros (protein, carbs, fat in grams, all required) for a pending photo meal. The meal then counts in the member's day and is labelled AI-estimated. Works once per meal and only while it is still pending.",
  shape: SubmitEstimateShape,
  async run(args, ctx) {
    const parsed = SubmitEstimateInputSchema.safeParse(stripUnknown(args, SubmitEstimateShape));
    if (!parsed.success) return fail(describeIssues(parsed.error));
    const { date, entryId, calories, protein, carbs, fat } = parsed.data;
    const entry = await ownPhotoEntry(ctx, date, entryId);
    if (!entry) return fail(NOT_FOUND);
    if (!isEditableDay(date, ctx.today)) return fail("That day is locked, so this meal can no longer be analysed.");
    if (entry.photo?.status !== "pending") return fail("This meal is not pending (already analysed or filled in); it was not changed.");

    const macros = completeMacros({ protein, carbs, fat });
    const applied = await ctx.deps.food.updateEntryIf(
      ctx.userId,
      date,
      entryId,
      { calories, macros, rate: { calories, macros }, photoStatus: "ai" },
      ctx.deps.now().toISOString(),
      ["pending"],
    );
    if (!applied) return fail("This meal is no longer pending; it was not changed.");
    await safeRefreshProtein(ctx.userId, ctx.deps);
    return { text: `Estimate saved for ${entry.meal} on ${date}: ${calories} kcal, P ${protein} g, C ${carbs} g, F ${fat} g.` };
  },
};

export const photoTools: readonly Tool[] = [listPendingFoodPhotos, getFoodPhoto, submitFoodEstimate];
