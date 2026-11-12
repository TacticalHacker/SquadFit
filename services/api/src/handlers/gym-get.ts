import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { getCaller } from "../lib/auth";
import { loadDayContext, resolveReadDate } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { loadGymView } from "../lib/gym-view-loader";
import { ok } from "../lib/http";

/** GET /workouts/gym?date= : the Gym tab (exercises, that day's gym entries, last time per exercise, day totals). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const d = resolveReadDate(event.queryStringParameters?.date, c.ctx.today);
  if (!d.ok) return d.response;
  return ok(await loadGymView(caller.userId, c.ctx, d.date, deps));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
