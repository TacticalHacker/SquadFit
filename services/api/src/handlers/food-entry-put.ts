import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { EntryPatchSchema, canTransition, completeMacros, photoEntryName, type PhotoStatus } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { loadDayContext, resolveWriteDate, type DayContext } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { loadFoodDay } from "../lib/food-day-loader";
import { patchFoodEntry } from "../lib/food-write";
import { ENTRY_ID_PATTERN, type EntryUpdate, type FoodEntryItem } from "../lib/food-repo";
import { apiError, ok, parseBody } from "../lib/http";

/** PUT /food/entries/{date}/{entryId} : typed entries edit name/calories/macros/meal; list entries servings/meal (via `patchFoodEntry`). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const d = resolveWriteDate(event.pathParameters?.date, c.ctx.today);
  if (!d.ok) return d.response;
  const entryId = event.pathParameters?.entryId ?? "";
  const body = parseBody(event.body ?? "{}", EntryPatchSchema);
  if (!body.ok) return body.response;
  const patch = body.data;

  const existing = ENTRY_ID_PATTERN.test(entryId) ? await deps.food.getEntry(caller.userId, d.date, entryId) : null;
  if (!existing) return apiError(404, "NOT_FOUND", "Entry not found");

  if (existing.source === "photo" && existing.photo) {
    const fields: EntryUpdate = {};
    if (patch.meal !== undefined) fields.meal = patch.meal;
    return handlePhotoEdit(existing, patch, fields, { caller, c, d, entryId }, deps);
  }
  const saved = await patchFoodEntry(caller.userId, existing, patch, deps);
  if (!saved.ok) return apiError(saved.status, saved.code, saved.message, saved.fields);
  return ok(await loadFoodDay(caller.userId, c.ctx, d.date, deps));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());

const CONFLICT = "This meal was already analysed; refresh";

/** Photo entries (feature 005): pending edits caption/meal or is filled by hand; analysed entries take corrections. */
async function handlePhotoEdit(
  existing: FoodEntryItem,
  patch: ReturnType<typeof EntryPatchSchema.parse>,
  fields: EntryUpdate,
  ctx: { caller: { userId: string }; c: { ctx: DayContext }; d: { date: string }; entryId: string },
  deps: Deps,
) {
  const photo = existing.photo!;
  const bad = (["servings", "name"] as const).find((k) => patch[k] !== undefined);
  if (bad) return apiError(400, "VALIDATION_FAILED", "Not editable for photo meals", { [bad]: "Not editable for photo meals" });

  const pending = photo.status === "pending";
  const valuesChanged = patch.calories !== undefined || patch.macros !== undefined;
  if (pending && patch.macros !== undefined && patch.calories === undefined) {
    return apiError(400, "VALIDATION_FAILED", "Calories are required", { calories: "Enter calories to fill this meal in" });
  }
  if (pending && patch.caption !== undefined) {
    fields.caption = patch.caption;
    fields.name = photoEntryName(patch.caption);
  }
  if (valuesChanged) {
    const calories = patch.calories ?? existing.calories;
    const macros = patch.macros === undefined ? existing.macros : completeMacros(patch.macros);
    const next: PhotoStatus = pending ? "manual" : "edited";
    if (!canTransition(photo.status, next, "user")) return apiError(409, "VALIDATION_FAILED", CONFLICT, { _: CONFLICT });
    fields.calories = calories;
    fields.macros = macros;
    fields.rate = { calories, macros };
    fields.photoStatus = next;
  }

  // Atomic on the current status, so an AI estimate that lands at the same moment cannot be overwritten (FR-012).
  const allowed: PhotoStatus[] = pending ? ["pending"] : ["ai", "manual", "edited"];
  const updated = await deps.food.updateEntryIf(ctx.caller.userId, ctx.d.date, ctx.entryId, fields, deps.now().toISOString(), allowed);
  if (!updated) return apiError(409, "VALIDATION_FAILED", CONFLICT, { _: CONFLICT });
  return ok(await loadFoodDay(ctx.caller.userId, ctx.c.ctx, ctx.d.date, deps));
}
