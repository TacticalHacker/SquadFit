import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { getCaller } from "../lib/auth";
import { loadDayContext, resolveWriteDate } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { loadFoodDay } from "../lib/food-day-loader";
import { ENTRY_ID_PATTERN } from "../lib/food-repo";
import { ok } from "../lib/http";

/** DELETE /food/entries/{date}/{entryId} : idempotent. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const d = resolveWriteDate(event.pathParameters?.date, c.ctx.today);
  if (!d.ok) return d.response;
  const entryId = event.pathParameters?.entryId ?? "";
  if (ENTRY_ID_PATTERN.test(entryId)) {
    const existing = await deps.food.getEntry(caller.userId, d.date, entryId);
    await deps.food.deleteEntry(caller.userId, d.date, entryId);
    // Entry first, picture second: a dangling entry with a missing image would be worse than a stray object.
    if (existing?.photoKey) await deps.photos.delete(existing.photoKey).catch(() => undefined);
  }
  return ok(await loadFoodDay(caller.userId, c.ctx, d.date, deps));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
