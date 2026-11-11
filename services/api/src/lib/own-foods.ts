import { OwnFoodInputSchema, isOwnFoodNameTaken, type OwnFoodInput } from "@calci/shared";
import type { Deps } from "./deps";
import { apiError, parseBody, type Parsed } from "./http";

/** Parse the body and check the name is free among the caller's other own foods (FR-021). */
export async function parseOwnFoodInput(
  rawBody: string | undefined,
  userId: string,
  deps: Deps,
  selfId?: string,
): Promise<Parsed<OwnFoodInput>> {
  const parsed = parseBody(rawBody, OwnFoodInputSchema);
  if (!parsed.ok) return parsed;
  const existing = (await deps.food.listOwnFoods(userId)).filter((f) => f.foodId !== selfId).map((f) => f.name);
  if (isOwnFoodNameTaken(parsed.data.name, existing)) {
    return {
      ok: false,
      response: apiError(409, "DUPLICATE_NAME", "You already have a food with that name", {
        name: "You already have a food with that name",
      }),
    };
  }
  return parsed;
}
