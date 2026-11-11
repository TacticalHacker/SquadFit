import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { getCaller } from "../lib/auth";
import { loadDayContext } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";

/** DELETE /workouts/custom/{workoutId} : soft remove; past entries remain. Idempotent. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const workoutId = event.pathParameters?.workoutId ?? "";
  const done = workoutId.startsWith("c-")
    ? await deps.workouts.markCustomRemoved(caller.userId, workoutId, deps.now().toISOString())
    : false;
  if (!done) return apiError(404, "NOT_FOUND", "Workout not found");
  return ok({ ok: true });
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
