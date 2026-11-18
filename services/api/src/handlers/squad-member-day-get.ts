import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { DayLogSchema, localDate } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { resolveReadDate } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { resolveMember } from "../lib/member-access";
import { dayCard, loadHighFives } from "../lib/member-view";

/** GET /squad/members/{memberId}/days/{date} : the full set-by-set log of one day (feature 011). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  if (!(await deps.profiles.get(caller.userId))) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");
  const access = await resolveMember(caller.userId, event.pathParameters?.memberId, deps);
  if (!access.ok) return access.response;
  const { profile } = access;

  const today = localDate(deps.now(), profile.timezone);
  const day = resolveReadDate(event.pathParameters?.date ?? "", today);
  if (!day.ok) return day.response;

  const [workouts, stats, hi5] = await Promise.all([
    deps.workouts.listEntriesForDay(profile.userId, day.date),
    deps.squad.getStats(profile.userId),
    loadHighFives(profile.userId, caller.userId, deps),
  ]);
  const card = await dayCard({ owner: profile, viewerId: caller.userId, level: access.level, date: day.date, workouts, stats, hi5, withSets: true, deps });
  if (!card) return ok(DayLogSchema.parse({ date: day.date, rest: true, isToday: day.date === today }));
  const { updatedAt: _u, ...shown } = card;
  return ok(DayLogSchema.parse({ ...shown, rest: false }));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
