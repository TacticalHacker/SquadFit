import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { GYM_MAX_OWN } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { loadDayContext } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, json } from "../lib/http";
import { parseExerciseInput, toExerciseResponse } from "../lib/own-exercises";

/** POST /workouts/gym/exercises : add one of the caller's own exercises (FR-005). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const input = await parseExerciseInput(event.body, caller.userId, deps);
  if (!input.ok) return input.response;
  if ((await deps.gym.listOwnExercises(caller.userId)).length >= GYM_MAX_OWN) {
    return apiError(409, "LIMIT_REACHED", `You can have at most ${GYM_MAX_OWN} of your own exercises`);
  }
  const nowIso = deps.now().toISOString();
  const item = { exerciseId: `gc-${randomUUID()}`, ...input.data, createdAt: nowIso, updatedAt: nowIso };
  await deps.gym.putOwnExercise(caller.userId, item);
  return json(201, toExerciseResponse(item));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
