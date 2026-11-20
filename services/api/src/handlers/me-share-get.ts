import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { ShareSummarySchema } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { ok } from "../lib/http";
import { figuresFor, loadOwnWorkoutDay, postState } from "../lib/share-summary";

/**
 * GET /me/share/{date} : the caller's own share-card figures for one day (feature 016). Own data only, so it works
 * while hidden from the leaderboard. Never calories, body weight or targets.
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const day = await loadOwnWorkoutDay(caller, event.pathParameters?.date, deps);
  if (!day.ok) return day.response;
  const { profile, date, entries } = day;
  const [stats, activity, item] = await Promise.all([
    deps.squad.getStats(caller.userId),
    deps.activity.listRange(caller.userId, date, date),
    deps.squad.getFeed(caller.userId, `day#${date}`),
  ]);
  const figures = figuresFor(profile, date, entries, stats, activity[0]?.steps ?? null);
  return ok(ShareSummarySchema.parse({ ...figures, post: postState(profile, item) }));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
