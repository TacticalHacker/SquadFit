import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { getCaller } from "../lib/auth";
import { loadDayContext } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";

/** DELETE /workouts/gym/exercises/{exerciseId} : soft remove (past entries stay). Idempotent. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const exerciseId = event.pathParameters?.exerciseId ?? "";
  const removed = exerciseId.startsWith("gc-") && (await deps.gym.markOwnRemoved(caller.userId, exerciseId, deps.now().toISOString()));
  if (!removed) return apiError(404, "NOT_FOUND", "Exercise not found");
  return ok({ ok: true });
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
