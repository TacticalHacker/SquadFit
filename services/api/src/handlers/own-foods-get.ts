import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { getCaller } from "../lib/auth";
import { loadDayContext } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { ok } from "../lib/http";

/** GET /food/foods : the caller's own foods, A to Z. Built-in foods live in the client. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const foods = (await deps.food.listOwnFoods(caller.userId))
    .map(({ foodId, name, serving, calories, macros }) => ({ foodId, name, serving, calories, macros }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  return ok({ foods });
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
