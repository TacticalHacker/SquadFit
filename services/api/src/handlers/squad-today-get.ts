import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { TodaySchema, addDays, localDate } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { resolveReadDate } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { sharedLevel } from "../lib/member-access";
import { dayCard, loadHighFives, stepsFor } from "../lib/member-view";
import { squadMember, visibleTo } from "../lib/squad-view";

const MAX_BACK_DAYS = 30;

/**
 * GET /squad/today?date= : every visible member's workout for the day as cards, most recently updated first
 * (feature 011). Cards here carry daily totals at most, never meals or photos.
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const me = await deps.profiles.get(caller.userId);
  if (!me) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");
  const today = localDate(deps.now(), me.timezone);
  const day = resolveReadDate(event.queryStringParameters?.date, today);
  if (!day.ok) return day.response;
  if (day.date < addDays(today, -MAX_BACK_DAYS)) return apiError(400, "VALIDATION_FAILED", "Date is too far back", { date: "Choose a day in the last 30 days" });

  const members = (await deps.profiles.listCommunity()).filter((p) => visibleTo(p, caller.userId));
  const built = await Promise.all(
    members.map(async (owner) => {
      const [workouts, stats, hi5, steps] = await Promise.all([
        deps.workouts.listEntriesForDay(owner.userId, day.date),
        deps.squad.getStats(owner.userId),
        loadHighFives(owner.userId, caller.userId, deps),
        stepsFor(owner, caller.userId, day.date, day.date, deps),
      ]);
      const shared = owner.userId === caller.userId ? "totals" : sharedLevel(owner);
      const level = shared === "meals" ? "totals" : shared;
      const card = await dayCard({ owner, viewerId: caller.userId, level, date: day.date, workouts, stats, hi5, withSets: false, steps, deps });
      return { owner, card, steps: steps.get(day.date) };
    }),
  );
  // Feature 012: members who synced steps but did not train ("Rest day · 11,240 steps"), most steps first.
  const restDays = await Promise.all(
    built
      .filter((r) => r.card === null && r.steps !== undefined)
      .sort((a, b) => b.steps!.steps - a.steps!.steps)
      .map(async (r) => ({ member: await squadMember(r.owner, caller.userId, deps.avatars), steps: r.steps! })),
  );
  const rows = built.flatMap((r) => (r.card ? [{ owner: r.owner, card: r.card }] : [])).sort((a, b) => b.card.updatedAt.localeCompare(a.card.updatedAt));
  const cards = await Promise.all(
    rows.map(async ({ owner, card: { updatedAt: _u, ...card } }) => ({ ...card, member: await squadMember(owner, caller.userId, deps.avatars) })),
  );
  return ok(TodaySchema.parse({ date: day.date, cards, restDays }));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
