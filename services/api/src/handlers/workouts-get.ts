import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { getCaller } from "../lib/auth";
import { loadDayContext, resolveReadDate } from "../lib/day-context";
import { loadDayView } from "../lib/day-view-loader";
import { getDeps, type Deps } from "../lib/deps";
import { ok } from "../lib/http";

/** GET /workouts?date= : the day view (checklist, entries, totals). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const d = resolveReadDate(event.queryStringParameters?.date, c.ctx.today);
  if (!d.ok) return d.response;
  return ok(await loadDayView(caller.userId, c.ctx, d.date, deps));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
