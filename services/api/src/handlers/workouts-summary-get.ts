import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { dateRange, daysBetween, summarize, type SummaryRangeResponse } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { loadDayContext, resolveReadDate } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { weeklyStreakOf } from "../lib/squad-view";

const MAX_DAYS = 62;

/** GET /workouts/summary?from&to : per-day totals for the history strip. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const q = event.queryStringParameters ?? {};
  if (q.from === undefined || q.to === undefined) {
    return apiError(400, "VALIDATION_FAILED", "from and to are required", {
      ...(q.from === undefined ? { from: "Required" } : {}),
      ...(q.to === undefined ? { to: "Required" } : {}),
    });
  }
  const from = resolveReadDate(q.from, c.ctx.today, "from");
  if (!from.ok) return from.response;
  const to = resolveReadDate(q.to, c.ctx.today, "to");
  if (!to.ok) return to.response;
  if (from.date > to.date || daysBetween(from.date, to.date) + 1 > MAX_DAYS) {
    return apiError(400, "VALIDATION_FAILED", "Invalid range", { from: `Range must be 1 to ${MAX_DAYS} days` });
  }

  const [entries, profile, stats] = await Promise.all([
    deps.workouts.listEntriesInRange(caller.userId, from.date, to.date),
    deps.profiles.get(caller.userId),
    deps.squad.getStats(caller.userId),
  ]);
  const byDate = new Map<string, { minutes: number; calories: number }[]>();
  for (const e of entries) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  const body: SummaryRangeResponse = {
    days: dateRange(from.date, to.date).map((date) => ({ date, ...summarize(byDate.get(date) ?? []) })),
    // Feature 010: the weekly streak replaces the daily one on the Workouts screens (FR-032).
    weeklyStreak: profile ? weeklyStreakOf(profile, stats, c.ctx.today) : null,
  };
  return ok(body);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
