import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { EntryCreateSchema } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { loadDayContext, resolveWriteDate } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { loadFoodDay } from "../lib/food-day-loader";
import { createFoodEntry } from "../lib/food-write";
import { apiError, ok, parseBody } from "../lib/http";

/** POST /food/entries/{date} : add a typed entry or one from the built-in or own foods. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const d = resolveWriteDate(event.pathParameters?.date, c.ctx.today);
  if (!d.ok) return d.response;
  const body = parseBody(event.body, EntryCreateSchema);
  if (!body.ok) return body.response;

  const created = await createFoodEntry(caller.userId, d.date, body.data, deps);
  if (!created.ok) return apiError(created.status, created.code, created.message, created.fields);
  return ok(await loadFoodDay(caller.userId, c.ctx, d.date, deps));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
