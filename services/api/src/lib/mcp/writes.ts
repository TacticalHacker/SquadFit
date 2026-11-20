import {
  EntryPatchSchema,
  findGymExercise,
  findGymExerciseByName,
  findStandardFood,
  formatLogId,
  isEditableDay,
  normalizeWorkoutName,
  parseLogId,
  STANDARD_FOODS,
  summarize,
  UpdateWorkoutCaloriesInputSchema,
  UpdateWorkoutCaloriesShape,
  UpsertFoodInputSchema,
  UpsertFoodShape,
  UpsertWorkoutInputSchema,
  UpsertWorkoutShape,
  type EntryCreate,
  type GymEntryPut,
  type UpsertFoodInput,
} from "@calci/shared";
import { createFoodEntry, patchFoodEntry } from "../food-write";
import { ENTRY_ID_PATTERN } from "../food-repo";
import { getLibrary } from "../gym-library";
import { saveGymEntry, type WriteFailure } from "../gym-save";
import { describeIssues, fail, stripUnknown, type Tool, type ToolContext, type ToolResult } from "./types";

/**
 * AI write tools (feature 007). They act only as the key's member, only on the member's edit window
 * (today and the 2 previous days, clarification Q1), and go through the same rules as the app (research R1).
 * Nothing written here is logged.
 */

export const NOT_FOUND = "Log not found";
export const STALE = "This log changed since you read it; call get_full_context again.";

/** Error text when the member could not change `date` either, or null when it is writable. */
export function writableDateProblem(date: string, today: string): string | null {
  if (date > today) return "Date cannot be in the future";
  if (!isEditableDay(date, today)) return "That day can no longer be changed (only today and the 2 previous days).";
  return null;
}

/** Day burned total, as the Workouts and Food screens compute it. */
async function burnedOn(ctx: ToolContext, date: string) {
  return summarize(await ctx.deps.workouts.listEntriesForDay(ctx.userId, date)).totalCalories;
}

const updateWorkoutCalories: Tool = {
  name: "update_workout_calories",
  description:
    "Replaces the app's simple estimate for one logged workout (gym exercise or activity) with your own calories and duration, plus a one-line reason the member sees next to an \"AI adjusted\" badge. Use the member's body weight from get_full_context. Sets and volume are not changed. The day's burned total and the food ledger follow automatically. Only today and the 2 previous days can be changed; if the member edits the workout later, the app's estimate comes back.",
  shape: UpdateWorkoutCaloriesShape,
  async run(args, ctx) {
    const parsed = UpdateWorkoutCaloriesInputSchema.safeParse(stripUnknown(args, UpdateWorkoutCaloriesShape));
    if (!parsed.success) return fail(describeIssues(parsed.error));
    const { logId, updatedCalories, updatedDurationMins, reasoning } = parsed.data;
    const ref = parseLogId(logId);
    if (!ref) return fail(NOT_FOUND);
    const problem = writableDateProblem(ref.date, ctx.today);
    if (problem) return fail(problem);

    const entry = await ctx.deps.workouts.getEntry(ctx.userId, ref.date, ref.id);
    if (!entry) return fail(NOT_FOUND);
    const before = await burnedOn(ctx, ref.date);
    const result = await ctx.deps.workouts.setAiAdjustment(
      ctx.userId,
      ref.date,
      ref.id,
      { minutes: updatedDurationMins, calories: updatedCalories, aiNote: reasoning },
      entry.updatedAt,
      ctx.deps.now().toISOString(),
    );
    if (result === "missing") return fail(NOT_FOUND);
    if (result === "conflict") return fail(STALE);
    const after = before - entry.calories + updatedCalories;
    return {
      text:
        `Updated ${entry.name} on ${ref.date}: ${entry.calories} → ${updatedCalories} kcal, ` +
        `${entry.minutes} → ${updatedDurationMins} min. Day burned: ${before} → ${after} kcal.`,
    };
  },
};

/** A write failure from the shared services, as tool text: the general message plus the field detail, if any. */
function failWrite(f: WriteFailure): ToolResult {
  const detail = f.fields ? Object.values(f.fields)[0] : undefined;
  return fail(detail && detail !== f.message ? `${f.message}: ${detail}` : f.message);
}

const nf = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

const upsertWorkoutLog: Tool = {
  name: "upsert_workout_log",
  description:
    "Logs a gym exercise for the member, or replaces that exercise's entry for the day (one entry per exercise per day). exercise: an id (gx-..., gc-...) or the exact exercise name. Strength exercises take sets (reps, weightKg; completed defaults to true); cardio exercises take minutes. Minutes, calories and volume are computed by the app, so do not send them; call update_workout_calories afterwards for a body-weight-based estimate. Only today and the 2 previous days.",
  shape: UpsertWorkoutShape,
  async run(args, ctx) {
    const parsed = UpsertWorkoutInputSchema.safeParse(stripUnknown(args, UpsertWorkoutShape));
    if (!parsed.success) return fail(describeIssues(parsed.error));
    const { date, exercise, sets, minutes } = parsed.data;
    const problem = writableDateProblem(date, ctx.today);
    if (problem) return fail(problem);

    const [own, library] = await Promise.all([ctx.deps.gym.listOwnExercises(ctx.userId), getLibrary(ctx.deps)]);
    const isId = findGymExercise(exercise, library) || own.some((e) => e.exerciseId === exercise && !e.removedAt);
    const exerciseId = isId ? exercise : findGymExerciseByName(exercise, own, library);
    if (!exerciseId) {
      const q = normalizeWorkoutName(exercise);
      const words = q.split(" ").filter((w) => w.length > 2);
      const close = [...library.map((e) => e.name), ...own.filter((e) => !e.removedAt).map((e) => e.name)]
        .filter((n) => words.some((w) => normalizeWorkoutName(n).includes(w)))
        .slice(0, 5);
      return fail(`Exercise not found.${close.length ? ` Close matches: ${close.join(", ")}.` : ""}`);
    }
    if (sets && minutes !== undefined) return fail("Give sets for a strength exercise or minutes for cardio, not both");
    if (!sets && minutes === undefined) return fail("Give sets (strength) or minutes (cardio)");

    const body: GymEntryPut = sets
      ? { sets: sets.map((s, i) => ({ setNumber: i + 1, reps: s.reps, weightKg: s.weightKg, completed: s.completed ?? true })) }
      : { minutes: minutes! };
    const saved = await saveGymEntry(ctx.userId, date, exerciseId, body, ctx.deps);
    if (!saved.ok) return failWrite(saved);
    const e = saved.entry;
    const detail = e.sets ? `${e.sets.length} ${e.sets.length === 1 ? "set" : "sets"}, ${nf.format(e.volumeKg ?? 0)} kg volume` : `${e.minutes} min`;
    return { text: `Saved ${e.name} on ${date}: ${detail}, ${e.calories} kcal. logId ${formatLogId(date, exerciseId)}` };
  },
};

const LIST_ONLY = "Calories and macros follow the servings for foods from a list";

/** A built-in or own food for `food` (id, then exact name), or null for a free-form entry. */
async function resolveFood(ctx: ToolContext, food: string) {
  if (findStandardFood(food)) return { kind: "standard" as const, foodId: food };
  const own = await ctx.deps.food.listOwnFoods(ctx.userId);
  if (own.some((f) => f.foodId === food)) return { kind: "own" as const, foodId: food };
  const n = normalizeWorkoutName(food);
  const std = STANDARD_FOODS.find((f) => normalizeWorkoutName(f.name) === n);
  if (std) return { kind: "standard" as const, foodId: std.id };
  const mine = own.find((f) => normalizeWorkoutName(f.name) === n);
  return mine ? { kind: "own" as const, foodId: mine.foodId } : null;
}

const macrosOf = (v: UpsertFoodInput) =>
  v.protein !== undefined ? { protein: v.protein, carbs: v.carbs!, fat: v.fat! } : undefined;

async function createFood(ctx: ToolContext, v: UpsertFoodInput): Promise<ToolResult> {
  const date = v.date!;
  const problem = writableDateProblem(date, ctx.today);
  if (problem) return fail(problem);
  const list = await resolveFood(ctx, v.food!);
  let input: EntryCreate;
  if (list) {
    if (v.calories !== undefined || v.protein !== undefined || v.name !== undefined) return fail(LIST_ONLY);
    input = { kind: list.kind, meal: v.meal!, foodId: list.foodId, servings: v.servings ?? 1 };
  } else {
    if (v.calories === undefined) return fail("calories: required for a food that is not in the built-in or the member's own foods");
    if (v.servings !== undefined) return fail("servings: only for foods from a list; give the total calories instead");
    const macros = macrosOf(v);
    input = { kind: "typed", meal: v.meal!, name: v.food!, calories: v.calories, ...(macros ? { macros } : {}) };
  }
  const created = await createFoodEntry(ctx.userId, date, input, ctx.deps);
  if (!created.ok) return failWrite(created);
  const e = created.entry;
  const what = e.source === "typed" ? e.name : `${e.servings} × ${e.name}`;
  return { text: `Logged ${what} (${e.calories} kcal) for ${e.meal} on ${date}. logId ${formatLogId(date, created.entryId)}` };
}

async function updateFood(ctx: ToolContext, v: UpsertFoodInput): Promise<ToolResult> {
  const ref = parseLogId(v.logId!);
  if (!ref || !ENTRY_ID_PATTERN.test(ref.id)) return fail(NOT_FOUND);
  if (v.date !== undefined || v.food !== undefined) return fail("To update, give logId with the fields to change (not date or food)");
  const problem = writableDateProblem(ref.date, ctx.today);
  if (problem) return fail(problem);
  const existing = await ctx.deps.food.getEntry(ctx.userId, ref.date, ref.id);
  if (!existing) return fail(NOT_FOUND);
  const macros = macrosOf(v);
  const patch = EntryPatchSchema.parse({
    ...(v.meal !== undefined ? { meal: v.meal } : {}),
    ...(v.servings !== undefined ? { servings: v.servings } : {}),
    ...(v.name !== undefined ? { name: v.name } : {}),
    ...(v.calories !== undefined ? { calories: v.calories } : {}),
    ...(macros ? { macros } : {}),
  });
  const saved = await patchFoodEntry(ctx.userId, existing, patch, ctx.deps);
  if (!saved.ok) return failWrite(saved);
  const after = await ctx.deps.food.getEntry(ctx.userId, ref.date, ref.id);
  return { text: `Updated ${after?.name ?? existing.name} on ${ref.date}: ${after?.calories ?? existing.calories} kcal. logId ${v.logId}` };
}

const upsertFoodLog: Tool = {
  name: "upsert_food_log",
  description:
    "Logs a food entry for the member, or updates one. Create: date, meal (breakfast, lunch, dinner, snacks) and food: a built-in id (sf-...), the member's own food id, the exact name of either (then servings, default 1; calories follow the servings), or any other name for a free-form entry (then calories, and optionally protein, carbs and fat together). Update: logId plus the fields to change (meal; servings for list foods; name, calories, macros for free-form). Photo meals are filled with submit_food_estimate instead. Only today and the 2 previous days.",
  shape: UpsertFoodShape,
  async run(args, ctx) {
    const parsed = UpsertFoodInputSchema.safeParse(stripUnknown(args, UpsertFoodShape));
    if (!parsed.success) return fail(describeIssues(parsed.error));
    return parsed.data.logId !== undefined ? updateFood(ctx, parsed.data) : createFood(ctx, parsed.data);
  },
};

export const writeTools: readonly Tool[] = [updateWorkoutCalories, upsertWorkoutLog, upsertFoodLog];
