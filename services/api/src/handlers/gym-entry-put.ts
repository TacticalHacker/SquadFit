import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { GymEntryPutSchema } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { loadDayContext, resolveWriteDate } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { saveGymEntry } from "../lib/gym-save";
import { loadGymSaveResult } from "../lib/gym-view-loader";
import { apiError, ok, parseBody } from "../lib/http";

/**
 * PUT /workouts/gym/entries/{date}/{exerciseId} : save (create or replace) one exercise on one day.
 * Totals are always recomputed from the sets or minutes (FR-014) in `saveGymEntry`. Never logs the body.
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const d = resolveWriteDate(event.pathParameters?.date, c.ctx.today);
  if (!d.ok) return d.response;
  const exerciseId = event.pathParameters?.exerciseId ?? "";
  const body = parseBody(event.body, GymEntryPutSchema);
  if (!body.ok) return body.response;

  const saved = await saveGymEntry(caller.userId, d.date, exerciseId, body.data, deps);
  if (!saved.ok) return apiError(saved.status, saved.code, saved.message, saved.fields);
  return ok(await loadGymSaveResult(caller.userId, c.ctx, d.date, exerciseId, deps));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
