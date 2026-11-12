import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { getCaller } from "../lib/auth";
import { loadDayContext } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { parseExerciseInput, toExerciseResponse } from "../lib/own-exercises";

/** PUT /workouts/gym/exercises/{exerciseId} : rename or regroup an own exercise. Past entries keep their snapshot. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const exerciseId = event.pathParameters?.exerciseId ?? "";
  const current = exerciseId.startsWith("gc-") ? await deps.gym.getOwnExercise(caller.userId, exerciseId) : null;
  if (!current || current.removedAt) return apiError(404, "NOT_FOUND", "Exercise not found");
  const input = await parseExerciseInput(event.body, caller.userId, deps, exerciseId);
  if (!input.ok) return input.response;
  const updated = await deps.gym.updateOwnExercise(caller.userId, exerciseId, input.data, deps.now().toISOString());
  if (!updated) return apiError(404, "NOT_FOUND", "Exercise not found");
  return ok(toExerciseResponse({ exerciseId, ...input.data }));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
