import { randomBytes } from "node:crypto";
import {
  completeMacros,
  entryFromFood,
  findStandardFood,
  scaleCalories,
  scaleMacros,
  type EntryCreate,
  type EntryPatch,
} from "@calci/shared";
import type { Deps } from "./deps";
import { newEntryId, type EntryUpdate, type FoodEntryItem } from "./food-repo";
import type { WriteFailure } from "./gym-save";
import { safeRefreshProtein } from "./protein-events";

const LIST_MESSAGE = "Calories and macros follow the servings for foods from a list";
const TOO_MANY = "That amount comes to more than 5,000 calories. Use fewer servings.";

/**
 * Add a typed entry or one from the built-in or own foods. Shared by `POST /food/entries/{date}` and the MCP
 * `upsert_food_log` tool (feature 007, research R1). The caller has already checked that `date` is writable.
 */
export async function createFoodEntry(
  userId: string,
  date: string,
  input: EntryCreate,
  deps: Deps,
): Promise<{ ok: true; entryId: string; entry: Omit<FoodEntryItem, "entryId"> } | WriteFailure> {
  const nowIso = deps.now().toISOString();
  const base = { date, meal: input.meal, createdAt: nowIso, updatedAt: nowIso };
  let draft: Omit<FoodEntryItem, "entryId">;

  if (input.kind === "typed") {
    const macros = completeMacros(input.macros);
    draft = { ...base, source: "typed", name: input.name, servings: 1, calories: input.calories, macros, rate: { calories: input.calories, macros } };
  } else {
    const food = input.kind === "standard" ? findStandardFood(input.foodId) : await deps.food.getOwnFood(userId, input.foodId);
    if (!food) return { ok: false, status: 404, code: "NOT_FOUND", message: "Food not found" };
    const e = entryFromFood({ calories: food.calories, macros: food.macros ?? null }, input.servings);
    if (e.calories < 1 || e.calories > 5000) {
      return { ok: false, status: 400, code: "VALIDATION_FAILED", message: "Too many calories", fields: { servings: TOO_MANY } };
    }
    draft = { ...base, source: input.kind, foodId: input.foodId, name: food.name, serving: food.serving, ...e };
  }

  // The random suffix makes a clash with another entry in the same millisecond vanishingly rare; retry once anyway.
  for (let attempt = 0; attempt < 2; attempt++) {
    const entryId = newEntryId(deps.now().getTime(), randomBytes(3).toString("hex"));
    if (await deps.food.putEntry(userId, { ...draft, entryId })) {
      await safeRefreshProtein(userId, deps);
      return { ok: true, entryId, entry: draft };
    }
  }
  return { ok: false, status: 409, code: "VALIDATION_FAILED", message: "Could not save; try again" };
}

/**
 * Edit a typed or list entry (not a photo entry): typed entries take name/calories/macros/meal, list entries
 * servings/meal with calories following servings × the entry's own rate. Shared by `PUT /food/entries` and the
 * MCP tool. `existing` was read by the caller.
 */
export async function patchFoodEntry(
  userId: string,
  existing: FoodEntryItem,
  patch: EntryPatch,
  deps: Deps,
): Promise<{ ok: true } | WriteFailure> {
  if (existing.source === "photo") {
    return { ok: false, status: 400, code: "VALIDATION_FAILED", message: "Photo meals are filled with submit_food_estimate" };
  }
  if (patch.caption !== undefined) {
    return { ok: false, status: 400, code: "VALIDATION_FAILED", message: "Only photo entries have a caption", fields: { caption: "Only photo entries have a caption" } };
  }
  const fields: EntryUpdate = {};
  if (patch.meal !== undefined) fields.meal = patch.meal;

  if (existing.source === "typed") {
    if (patch.servings !== undefined) {
      return { ok: false, status: 400, code: "VALIDATION_FAILED", message: "Servings can't be changed here", fields: { servings: "Servings can't be changed for typed entries" } };
    }
    const calories = patch.calories ?? existing.calories;
    const macros = patch.macros === undefined ? existing.macros : completeMacros(patch.macros);
    if (patch.name !== undefined) fields.name = patch.name;
    fields.calories = calories;
    fields.macros = macros;
    fields.rate = { calories, macros };
  } else {
    const bad = (["name", "calories", "macros"] as const).find((k) => patch[k] !== undefined);
    if (bad) return { ok: false, status: 400, code: "VALIDATION_FAILED", message: LIST_MESSAGE, fields: { [bad]: LIST_MESSAGE } };
    if (patch.servings !== undefined) {
      const calories = scaleCalories(existing.rate.calories, patch.servings);
      if (calories < 1 || calories > 5000) {
        return { ok: false, status: 400, code: "VALIDATION_FAILED", message: "Too many calories", fields: { servings: TOO_MANY } };
      }
      fields.servings = patch.servings;
      fields.calories = calories;
      fields.macros = scaleMacros(existing.rate.macros, patch.servings);
    }
  }

  const updated = await deps.food.updateEntry(userId, existing.date, existing.entryId, fields, deps.now().toISOString());
  if (!updated) return { ok: false, status: 404, code: "NOT_FOUND", message: "Entry not found" };
  await safeRefreshProtein(userId, deps);
  return { ok: true };
}
