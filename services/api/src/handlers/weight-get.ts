import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { getCaller } from "../lib/auth";
import { loadDayContext } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { ok } from "../lib/http";
import { loadWeightView } from "../lib/weight-write";
import { parseWeightRange } from "../lib/weight-range";

/** GET /me/weight?range=W|M|6M|Y : the caller's own chart view (feature 014). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const range = parseWeightRange(event);
  if (!range.ok) return range.response;
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  return ok(await loadWeightView(caller.userId, c.ctx.today, range.range, deps));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
