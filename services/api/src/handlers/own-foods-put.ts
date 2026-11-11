import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { getCaller } from "../lib/auth";
import { loadDayContext } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { parseOwnFoodInput } from "../lib/own-foods";

/** PUT /food/foods/{foodId} : future picks use the new values; logged entries keep their snapshot. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const foodId = event.pathParameters?.foodId ?? "";
  // Built-in ids and other users' ids never exist under this caller's keys, so both are 404.
  const current = foodId.startsWith("f-") ? await deps.food.getOwnFood(caller.userId, foodId) : null;
  if (!current) return apiError(404, "NOT_FOUND", "Food not found");

  const input = await parseOwnFoodInput(event.body, caller.userId, deps, foodId);
  if (!input.ok) return input.response;
  const fields = {
    name: input.data.name,
    serving: input.data.serving,
    calories: input.data.calories,
    macros: input.data.macros ?? null,
  };
  if (!(await deps.food.updateOwnFood(caller.userId, foodId, fields, deps.now().toISOString()))) {
    return apiError(404, "NOT_FOUND", "Food not found");
  }
  return ok({ food: { foodId, ...fields } });
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
