import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import type { CustomWorkoutResponse } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { parseCustomInput } from "../lib/custom-workouts";
import { loadDayContext } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { ok } from "../lib/http";

/** POST /workouts/custom : add one of the caller's own workouts. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const input = await parseCustomInput(event.body, caller.userId, deps);
  if (!input.ok) return input.response;

  const nowIso = deps.now().toISOString();
  const workout = { workoutId: `c-${randomUUID()}`, ...input.data };
  await deps.workouts.putCustomWorkout(caller.userId, { ...workout, createdAt: nowIso, updatedAt: nowIso });
  const body: CustomWorkoutResponse = { workout };
  return ok(body);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
