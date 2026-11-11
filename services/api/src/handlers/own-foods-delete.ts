import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { getCaller } from "../lib/auth";
import { loadDayContext } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";

/** DELETE /food/foods/{foodId} : entries already logged are unaffected (FR-008). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const foodId = event.pathParameters?.foodId ?? "";
  const existed = foodId.startsWith("f-") ? await deps.food.deleteOwnFood(caller.userId, foodId) : false;
  if (!existed) return apiError(404, "NOT_FOUND", "Food not found");
  return ok({ ok: true });
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
