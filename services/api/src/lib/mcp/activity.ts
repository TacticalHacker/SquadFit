import { HistoryInputSchema, HistoryShape, UpsertActivityInputSchema, UpsertActivityShape, isStepGoalHit, validateHistoryWindow } from "@calci/shared";
import { saveActivity } from "../activity-write";
import { stepSettingsOf } from "../profile-repo";
import { describeIssues, fail, stripUnknown, type Tool } from "./types";

/** Feature 012: daily activity tools. They act only as the key's member; values are never logged. */

const upsertDailyActivity: Tool = {
  name: "upsert_daily_activity",
  description:
    "Save the member's daily activity (steps, optional active kcal and distance km) into SquadFit. You are the sync: whenever you can read the member's Apple Health or other health data (for example through a Health tool in this conversation), call this tool yourself with those numbers instead of telling the member to enable anything; SquadFit has no native iPhone app and no in-app Health switch. Use the member's local date (today, as given in the server instructions, and up to 30 days back). Send whole-day totals, not individual samples. Re-sending a date overwrites it. Call it when the member asks to sync, log or connect their steps/activity.",
  shape: UpsertActivityShape,
  annotations: { title: "Save daily steps", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async run(args, ctx) {
    const parsed = UpsertActivityInputSchema.safeParse(stripUnknown(args, UpsertActivityShape));
    if (!parsed.success) return fail(describeIssues(parsed.error));
    const profile = await ctx.deps.profiles.get(ctx.userId);
    if (!profile) return fail("Profile setup is not complete; finish it in the app first.");
    const outcome = await saveActivity(profile, parsed.data.days, "mcp", ctx.deps);
    if (!outcome.ok) return fail(`Nothing was saved. ${outcome.message}`);
    return { text: JSON.stringify(outcome.result) };
  },
};

const getDailyActivity: Tool = {
  name: "get_daily_activity",
  description:
    "Returns the member's synced daily activity (steps, active kcal, distance km, source, sync time, whether the step goal was hit) for each synced day in a date window (at most 31 days, ending no later than today), plus their daily step goal. Use it to see what is already synced before calling upsert_daily_activity.",
  shape: HistoryShape,
  annotations: { title: "Read synced steps", readOnlyHint: true, openWorldHint: false },
  async run(args, ctx) {
    const parsed = HistoryInputSchema.safeParse(stripUnknown(args, HistoryShape));
    if (!parsed.success) return fail(describeIssues(parsed.error));
    const { startDate, endDate } = parsed.data;
    const problem = validateHistoryWindow(startDate, endDate, ctx.today);
    if (problem) return fail(problem);
    const profile = await ctx.deps.profiles.get(ctx.userId);
    const goal = stepSettingsOf(profile ?? {}).dailyStepGoal;
    const days = await ctx.deps.activity.listRange(ctx.userId, startDate, endDate);
    return {
      text: JSON.stringify({
        today: ctx.today,
        timezone: ctx.timezone,
        stepGoal: goal,
        days: days.map((d) => ({
          date: d.date,
          steps: d.steps,
          activeKcal: d.activeKcal,
          distanceKm: d.distanceKm,
          source: d.source,
          syncedAt: d.syncedAt,
          goalHit: isStepGoalHit(d.steps, goal),
        })),
      }),
    };
  },
};

export const activityTools: readonly Tool[] = [upsertDailyActivity, getDailyActivity];
