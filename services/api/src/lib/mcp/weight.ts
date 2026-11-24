import { z } from "zod";
import { BodyWeightSchema, DateSchema, WEIGHT_RANGES } from "@calci/shared";
import { loadWeightView, logWeight } from "../weight-write";
import { describeIssues, fail, stripUnknown, type Tool, type ToolContext } from "./types";

/** Feature 017: the member's own weigh-ins for their AI agent. Never another member's weight; values are never logged. */

const GetWeightShape = {
  range: z.enum(WEIGHT_RANGES).optional().describe("W = last 7 days, M = last 30 days (default), 6M = 26 weeks, Y = 12 months"),
};
const LogWeightShape = {
  weightKg: BodyWeightSchema.describe("Body weight in kg, 20–400, at most one decimal"),
  date: DateSchema.optional().describe("YYYY-MM-DD, the member's local date; default today. Only today and the 2 previous days."),
};

/** Same view as the app's chart, trimmed to what an agent needs. */
async function weightText(ctx: ToolContext, range: (typeof WEIGHT_RANGES)[number]) {
  const view = await loadWeightView(ctx.userId, ctx.today, range, ctx.deps);
  const daily = range === "W" || range === "M";
  const entries = daily
    ? (await ctx.deps.weights.listRange(ctx.userId, view.start, ctx.today)).map((i) => ({ date: i.date, weightKg: i.weightKg, recordedAt: i.recordedAt }))
    : undefined;
  return JSON.stringify({
    today: ctx.today,
    timezone: ctx.timezone,
    range,
    start: view.start,
    end: view.end,
    latest: view.latest,
    summary: view.summary,
    // W/M: one slot per day with the 7-day trend; 6M: weeks; Y: months. Slots without weigh-ins are left out.
    slots: view.slots.filter((s) => s.count > 0).map(({ start, end, count, average, min, max, trend }) => ({ start, end, count, average, min, max, ...(daily ? { trend } : {}) })),
    ...(entries ? { entries } : {}),
  });
}

const getWeightLog: Tool = {
  name: "get_weight_log",
  description:
    "Returns the member's own body weight log: latest weigh-in, average/min/max for the period, per-day (W, M) or per-week/month (6M, Y) averages with a 7-day trend for W and M, and for W and M every individual weigh-in. Use it to coach on weight change; get_full_context's profile body weight is just the latest value.",
  shape: GetWeightShape,
  annotations: { title: "Read weight log", readOnlyHint: true, openWorldHint: false },
  async run(args, ctx) {
    const parsed = z.strictObject(GetWeightShape).safeParse(stripUnknown(args, GetWeightShape));
    if (!parsed.success) return fail(describeIssues(parsed.error));
    return { text: await weightText(ctx, parsed.data.range ?? "M") };
  },
};

const logWeightTool: Tool = {
  name: "log_weight",
  description:
    "Logs a weigh-in for the member (kg), e.g. from Apple Health or a smart scale you can read, or when the member tells you their weight. Several weigh-ins a day are allowed (up to 10); the latest one becomes the member's body weight used for treadmill calories. Only today and the 2 previous days. Returns the 30-day weight log.",
  shape: LogWeightShape,
  annotations: { title: "Log weight", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  async run(args, ctx) {
    const parsed = z.strictObject(LogWeightShape).safeParse(stripUnknown(args, LogWeightShape));
    if (!parsed.success) return fail(describeIssues(parsed.error));
    const r = await logWeight({ userId: ctx.userId, username: "", isAdmin: false }, parsed.data, "M", ctx.deps);
    if (!r.ok) {
      const body = typeof r.response === "object" && typeof r.response.body === "string" ? r.response.body : "{}";
      return fail(`Nothing was saved. ${(JSON.parse(body) as { error?: { message?: string } }).error?.message ?? "The weigh-in was rejected."}`);
    }
    return { text: await weightText(ctx, "M") };
  },
};

export const weightTools: readonly Tool[] = [getWeightLog, logWeightTool];
