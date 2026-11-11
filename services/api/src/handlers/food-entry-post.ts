import { randomBytes } from "node:crypto";
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { EntryCreateSchema, completeMacros, entryFromFood, findStandardFood } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { loadDayContext, resolveWriteDate } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { loadFoodDay } from "../lib/food-day-loader";
import { newEntryId, type FoodEntryItem } from "../lib/food-repo";
import { apiError, ok, parseBody } from "../lib/http";

/** POST /food/entries/{date} : add a typed entry or one from the built-in or own foods. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const d = resolveWriteDate(event.pathParameters?.date, c.ctx.today);
  if (!d.ok) return d.response;
  const body = parseBody(event.body, EntryCreateSchema);
  if (!body.ok) return body.response;

  const input = body.data;
  const nowIso = deps.now().toISOString();
  const base = { date: d.date, meal: input.meal, createdAt: nowIso, updatedAt: nowIso };
  let draft: Omit<FoodEntryItem, "entryId">;

  if (input.kind === "typed") {
    const macros = completeMacros(input.macros);
    draft = {
      ...base,
      source: "typed",
      name: input.name,
      servings: 1,
      calories: input.calories,
      macros,
      rate: { calories: input.calories, macros },
    };
  } else {
    const food =
      input.kind === "standard"
        ? findStandardFood(input.foodId)
        : await deps.food.getOwnFood(caller.userId, input.foodId);
    if (!food) return apiError(404, "NOT_FOUND", "Food not found");
    const e = entryFromFood({ calories: food.calories, macros: food.macros ?? null }, input.servings);
    if (e.calories < 1 || e.calories > 5000) {
      return apiError(400, "VALIDATION_FAILED", "Too many calories", {
        servings: "That amount comes to more than 5,000 calories. Use fewer servings.",
      });
    }
    draft = {
      ...base,
      source: input.kind,
      foodId: input.foodId,
      name: food.name,
      serving: food.serving,
      ...e,
    };
  }

  // The random suffix makes a clash with another entry in the same millisecond vanishingly rare; retry once anyway.
  for (let attempt = 0; attempt < 2; attempt++) {
    const entryId = newEntryId(deps.now().getTime(), randomBytes(3).toString("hex"));
    if (await deps.food.putEntry(caller.userId, { ...draft, entryId })) break;
  }
  return ok(await loadFoodDay(caller.userId, c.ctx, d.date, deps));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
