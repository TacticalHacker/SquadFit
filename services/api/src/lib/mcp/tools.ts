import {
  addDays,
  CoachNoteShape,
  currentStreak,
  dateRange,
  EDIT_WINDOW_DAYS,
  FullContextInputSchema,
  FullContextShape,
  HistoryInputSchema,
  HistoryShape,
  OverallNoteInputSchema,
  OverallNoteShape,
  summarize,
  TargetsInputSchema,
  TargetsShape,
  validateHistoryWindow,
  validateNoteDate,
} from "@calci/shared";
import { buildHistoryDays, noteSummary, pendingHint, profileBlock } from "./history";
import { photoTools } from "./photos";
import { writeTools } from "./writes";
import { describeIssues, fail, stripUnknown, type Tool, type ToolContext, type ToolResult } from "./types";

const getUserHistory: Tool = {
  name: "get_user_history",
  description:
    "Returns the member's own food and workout entries for each day in a date window (at most 31 days, ending no later than today), with daily totals, their targets and body weight (75 kg default when unset). Every entry has a logId for the write tools. Gym exercises carry kind \"gym\", their muscle group and, for lifts, each set's reps, weightKg (0 = bodyweight) and whether it was completed, plus total volume. Prefer get_full_context for a daily review.",
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
    const days = buildHistoryDays(ctx, startDate, endDate, food, workouts);
    return {
      text: JSON.stringify({
        timezone: ctx.timezone,
        today: ctx.today,
        targets: { calories: ctx.calorieTarget, protein: ctx.proteinTarget },
        profile: profileBlock(ctx),
        days,
        ...pendingHint(days),
      }),
    };
  },
};

const DEFAULT_CONTEXT_DAYS = 7;

const getFullContext: Tool = {
  name: "get_full_context",
  description:
    "Everything for a daily review in one call: the member's profile (body weight in kg, 75 default when unset; calorie and protein targets), every workout (gym sets, reps, weightKg, volume; activities) and food entry with its logId, daily totals (eaten, burned, net, macros, gym volume), the day's coach note headline, the current activity streak, and editableFrom (the oldest date write tools accept). Window: startDate/endDate (YYYY-MM-DD, at most 31 days, not after today); default is the last 7 days. There is no leaderboard yet.",
  shape: FullContextShape,
  async run(args, ctx) {
    const parsed = FullContextInputSchema.safeParse(stripUnknown(args, FullContextShape));
    if (!parsed.success) return fail(describeIssues(parsed.error));
    const span = DEFAULT_CONTEXT_DAYS - 1;
    let { startDate, endDate } = parsed.data;
    if (startDate === undefined && endDate === undefined) endDate = ctx.today;
    if (startDate === undefined) startDate = addDays(endDate!, -span);
    if (endDate === undefined) endDate = [addDays(startDate, span), ctx.today].sort()[0]!;
    const problem = validateHistoryWindow(startDate, endDate, ctx.today);
    if (problem) return fail(problem);

    // One workout read covers both the window and the 62 days the streak looks back over (same as the Workouts page).
    const streakFrom = addDays(ctx.today, -61);
    const workoutsFrom = startDate < streakFrom ? startDate : streakFrom;
    const [food, workouts, notes] = await Promise.all([
      ctx.deps.food.listEntriesInRange(ctx.userId, startDate, endDate),
      ctx.deps.workouts.listEntriesInRange(ctx.userId, workoutsFrom, ctx.today),
      ctx.deps.coach.listInRange(ctx.userId, startDate, endDate),
    ]);
    const inWindow = workouts.filter((w) => w.date >= startDate && w.date <= endDate!);
    const days = buildHistoryDays(ctx, startDate, endDate, food, inWindow).map((d) => ({
      ...d,
      coachNote: noteSummary(notes.find((n) => n.date === d.date)),
    }));
    const perDay = dateRange(streakFrom, ctx.today).map((date) => ({
      date,
      totalMinutes: summarize(workouts.filter((w) => w.date === date)).totalMinutes,
    }));
    return {
      text: JSON.stringify({
        today: ctx.today,
        timezone: ctx.timezone,
        profile: profileBlock(ctx),
        editableFrom: addDays(ctx.today, -EDIT_WINDOW_DAYS),
        streak: currentStreak(perDay, ctx.today),
        leaderboard: null,
        leaderboardNote: "Scoring is not built yet, so there is no leaderboard or squad standing.",
        days,
        ...pendingHint(days),
      }),
    };
  },
};

const postOverallCoachNote: Tool = {
  name: "post_overall_coach_note",
  description:
    "Saves the member's daily coach verdict, shown in a compact bar on their home screen. headline: one punchy line (max 65 chars) that must make sense on its own; status: on_track, needs_attention or pr_alert; highlights: 1-3 short bullets covering gym performance and nutrition; actionItems: 0-3 things the member can do and tick off today. One note per date (today or up to 30 days ago); posting again replaces it and resets the ticks.",
  shape: OverallNoteShape,
  async run(args, ctx) {
    const parsed = OverallNoteInputSchema.safeParse(stripUnknown(args, OverallNoteShape));
    if (!parsed.success) return fail(describeIssues(parsed.error));
    const problem = validateNoteDate(parsed.data.date, ctx.today);
    if (problem) return fail(problem);
    await ctx.deps.coach.put(ctx.userId, parsed.data, ctx.deps.now().toISOString());
    return { text: `Coach note saved for ${parsed.data.date}.` };
  },
};

/** Retired in feature 007 (FR-016): still listed so old agents get a clear answer instead of "unknown tool". */
const postDailyCoachNote: Tool = {
  name: "post_daily_coach_note",
  description: "Retired. Use post_overall_coach_note instead.",
  shape: CoachNoteShape,
  async run() {
    return fail("This tool was replaced. Use post_overall_coach_note with a headline, status, highlights and actionItems.");
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

export const TOOLS: readonly Tool[] = [getFullContext, getUserHistory, postOverallCoachNote, postDailyCoachNote, updateUserTargets, ...writeTools, ...photoTools];
