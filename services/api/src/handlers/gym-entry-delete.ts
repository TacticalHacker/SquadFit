import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { isGymId } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { loadDayContext, resolveWriteDate } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { loadGymSaveResult } from "../lib/gym-view-loader";
import { apiError, ok } from "../lib/http";
import { safeRefresh } from "../lib/squad-stats";

/** DELETE /workouts/gym/entries/{date}/{exerciseId} : remove that day's gym entry. Idempotent (FR-019). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const d = resolveWriteDate(event.pathParameters?.date, c.ctx.today);
  if (!d.ok) return d.response;
  const exerciseId = event.pathParameters?.exerciseId ?? "";
  // Only gym ids: plain workout entries are removed through feature 002's route.
  if (!isGymId(exerciseId)) return apiError(404, "NOT_FOUND", "Exercise not found");
  await deps.gym.deleteGymEntry(caller.userId, d.date, exerciseId);
  await safeRefresh(caller.userId, deps);
  return ok(await loadGymSaveResult(caller.userId, c.ctx, d.date, exerciseId, deps));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
