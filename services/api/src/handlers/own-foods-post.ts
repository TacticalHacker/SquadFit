import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { getCaller } from "../lib/auth";
import { loadDayContext } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { ok } from "../lib/http";
import { parseOwnFoodInput } from "../lib/own-foods";

/** POST /food/foods : save one of the caller's own foods. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const input = await parseOwnFoodInput(event.body, caller.userId, deps);
  if (!input.ok) return input.response;

  const nowIso = deps.now().toISOString();
  const food = {
    foodId: `f-${randomUUID()}`,
    name: input.data.name,
    serving: input.data.serving,
    calories: input.data.calories,
    macros: input.data.macros ?? null,
  };
  await deps.food.putOwnFood(caller.userId, { ...food, createdAt: nowIso, updatedAt: nowIso });
  return ok({ food });
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
