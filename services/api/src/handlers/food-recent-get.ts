import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { addDays, recentFoods, type RecentFoodsResponse } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { loadDayContext } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { ok } from "../lib/http";

const RECENT_DAYS = 90;
const RECENT_LIMIT = 20;

/** GET /food/recent : up to 20 distinct foods from the last 90 days, most recent first (FR-022). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const { today } = c.ctx;
  const entries = await deps.food.listEntriesInRange(caller.userId, addDays(today, -(RECENT_DAYS - 1)), today);
  const body: RecentFoodsResponse = { foods: recentFoods(entries, RECENT_LIMIT) };
  return ok(body);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
