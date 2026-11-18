import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { isGymId } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { loadDayContext, resolveWriteDate } from "../lib/day-context";
import { loadDayView } from "../lib/day-view-loader";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { safeRefresh } from "../lib/squad-stats";

/** DELETE /workouts/entries/{date}/{workoutId} : untick. Idempotent. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const d = resolveWriteDate(event.pathParameters?.date, c.ctx.today);
  if (!d.ok) return d.response;
  const workoutId = event.pathParameters?.workoutId ?? "";
  // Gym entries are changed only through /workouts/gym so their minutes always follow their sets (research R2).
  if (isGymId(workoutId)) return apiError(404, "NOT_FOUND", "Workout not found");
  await deps.workouts.deleteEntry(caller.userId, d.date, workoutId);
  await safeRefresh(caller.userId, deps);
  return ok(await loadDayView(caller.userId, c.ctx, d.date, deps));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
