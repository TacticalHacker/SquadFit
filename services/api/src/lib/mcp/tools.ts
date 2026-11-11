import {
  buildFoodDay,
  CoachNoteInputSchema,
  CoachNoteShape,
  dateRange,
  HistoryInputSchema,
  HistoryShape,
  summarize,
  TargetsInputSchema,
  TargetsShape,
  validateHistoryWindow,
  validateNoteDate,
} from "@calci/shared";
import { photoTools } from "./photos";
import { describeIssues, fail, stripUnknown, type Tool, type ToolContext, type ToolResult } from "./types";

const getUserHistory: Tool = {
  name: "get_user_history",
  description:
    "Returns the member's own food and workout entries for each day in a date window (at most 31 days, ending no later than today), with daily totals and their current targets.",
  shape: HistoryShape,
  async run(args, ctx) {
    const parsed = HistoryInputSchema.safeParse(args);
    if (!parsed.success) return fail(describeIssues(parsed.error));
    const { startDate, endDate } = parsed.data;
    const problem = validateHistoryWindow(startDate, endDate, ctx.today);
    if (problem) return fail(problem);

    const [food, workouts] = await Promise.all([
      ctx.deps.food.listEntriesInRange(ctx.userId, startDate, endDate),
      ctx.deps.workouts.listEntriesInRange(ctx.userId, startDate, endDate),
    ]);
    const days = dateRange(startDate, endDate).map((date) => {
      const dayWorkouts = workouts.filter((w) => w.date === date);
      const view = buildFoodDay({
        date,
        today: ctx.today,
        timezone: ctx.timezone,
        target: ctx.calorieTarget,
        proteinTarget: ctx.proteinTarget,
        burnedCalories: summarize(dayWorkouts).totalCalories,
        entries: food.filter((e) => e.date === date),
      });
      return {
        date,
        food: view.meals.flatMap((m) =>
          m.entries.map((e) => ({
            meal: e.meal,
            name: e.name,
            servings: e.servings,
            calories: e.calories,
            ...(e.macros ?? {}),
            ...(e.photo
              ? { status: e.photo.status, caption: e.photo.caption, ...(e.photo.status === "pending" ? { pending: true } : {}) }
              : {}),
          })),
        ),
        workouts: dayWorkouts.map((w) => ({ name: w.name, minutes: w.minutes, calories: w.calories })),
        totals: {
          eaten: view.ledger.eaten,
          burned: view.ledger.burned,
          net: view.ledger.net,
          protein: view.ledger.macros.protein,
          carbs: view.ledger.macros.carbs,
          fat: view.ledger.macros.fat,
        },
      };
    });
    const pendingPhotoMeals = days.reduce((n, d) => n + d.food.filter((f) => "pending" in f).length, 0);
    return {
      text: JSON.stringify({
        timezone: ctx.timezone,
        today: ctx.today,
        targets: { calories: ctx.calorieTarget, protein: ctx.proteinTarget },
        days,
        ...(pendingPhotoMeals > 0
          ? {
              pendingPhotoMeals,
              next: "Some photo meals are pending with no calories. Do not just estimate them in a note: call list_pending_food_photos, then get_food_photo for each, then submit_food_estimate to save the numbers in the app.",
            }
          : {}),
      }),
    };
  },
};

const postDailyCoachNote: Tool = {
  name: "post_daily_coach_note",
  description:
    "Saves an AI coaching note (markdown summary plus recommendations) on the member's day screen. One note per date; posting again replaces it. Date: today or up to 30 days ago.",
  shape: CoachNoteShape,
  async run(args, ctx) {
    const parsed = CoachNoteInputSchema.safeParse(stripUnknown(args, CoachNoteShape));
    if (!parsed.success) return fail(describeIssues(parsed.error));
    const problem = validateNoteDate(parsed.data.date, ctx.today);
    if (problem) return fail(problem);
    await ctx.deps.coach.put(ctx.userId, parsed.data, ctx.deps.now().toISOString());
    return { text: `Coach note saved for ${parsed.data.date}.` };
  },
};

const updateUserTargets: Tool = {
  name: "update_user_targets",
  description:
    "Updates the member's daily calorie target (500-10000 kcal) and/or protein target (10-500 g; null clears it). Only the fields provided change.",
  shape: TargetsShape,
  async run(args, ctx) {
    const parsed = TargetsInputSchema.safeParse(stripUnknown(args, TargetsShape));
    if (!parsed.success) return fail(describeIssues(parsed.error));
    const updated = await ctx.deps.profiles.setTargets(
      ctx.userId,
      {
        ...(parsed.data.dailyCalorieTarget !== undefined ? { dailyCalorieTarget: parsed.data.dailyCalorieTarget } : {}),
        ...(parsed.data.dailyProteinTarget !== undefined ? { dailyProteinTarget: parsed.data.dailyProteinTarget } : {}),
      },
      ctx.deps.now().toISOString(),
    );
    if (!updated) return fail("Profile setup is not complete; finish it in the app first.");
    return {
      text: `Targets updated: calories ${updated.dailyCalorieTarget}, protein ${updated.dailyProteinTarget ?? "none"}.`,
    };
  },
};

export const TOOLS: readonly Tool[] = [getUserHistory, postDailyCoachNote, updateUserTargets, ...photoTools];
