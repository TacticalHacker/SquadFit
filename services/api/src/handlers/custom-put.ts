import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import type { CustomWorkoutResponse } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { parseCustomInput } from "../lib/custom-workouts";
import { loadDayContext } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";

/** PUT /workouts/custom/{workoutId} : changes apply to future ticks only (FR-010, FR-021). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const workoutId = event.pathParameters?.workoutId ?? "";
  // Standard ids and other users' ids never exist under this caller's keys, so both are 404.
  const current = workoutId.startsWith("c-") ? await deps.workouts.getCustomWorkout(caller.userId, workoutId) : null;
  if (!current || current.removedAt) return apiError(404, "NOT_FOUND", "Workout not found");

  const input = await parseCustomInput(event.body, caller.userId, deps, workoutId);
  if (!input.ok) return input.response;
  const updated = await deps.workouts.updateCustomWorkout(caller.userId, workoutId, input.data, deps.now().toISOString());
  if (!updated) return apiError(404, "NOT_FOUND", "Workout not found");
  const body: CustomWorkoutResponse = { workout: { workoutId, ...input.data } };
  return ok(body);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
