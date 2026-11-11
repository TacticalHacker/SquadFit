import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { EntryPutSchema, caloriesFor, findStandardWorkout } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { loadDayContext, resolveWriteDate } from "../lib/day-context";
import { loadDayView } from "../lib/day-view-loader";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok, parseBody } from "../lib/http";

/** PUT /workouts/entries/{date}/{workoutId} : tick, or change the minutes of, one workout on one day. Idempotent. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const d = resolveWriteDate(event.pathParameters?.date, c.ctx.today);
  if (!d.ok) return d.response;
  const workoutId = event.pathParameters?.workoutId ?? "";

  let minutes: number | undefined;
  if (event.body) {
    const body = parseBody(event.body, EntryPutSchema);
    if (!body.ok) return body.response;
    minutes = body.data.minutes;
  }

  const nowIso = deps.now().toISOString();
  const userId = caller.userId;
  // An existing entry can always be edited, even if its custom workout was removed since (FR-021).
  const existing = await deps.workouts.getEntry(userId, d.date, workoutId);

  if (existing) {
    if (minutes !== undefined) {
      const calories = caloriesFor(existing.rateMinutes, existing.rateCalories, minutes);
      await deps.workouts.updateEntryMinutes(userId, d.date, workoutId, minutes, calories, nowIso);
    }
  } else {
    const std = findStandardWorkout(workoutId);
    const def = std ?? (await deps.workouts.getCustomWorkout(userId, workoutId));
    if (!def || ("removedAt" in def && def.removedAt)) {
      return apiError(404, "NOT_FOUND", "Workout not found");
    }
    const m = minutes ?? def.defaultMinutes;
    const calories = caloriesFor(def.defaultMinutes, def.defaultCalories, m);
    const created = await deps.workouts.putEntryIfAbsent(userId, {
      date: d.date,
      workoutId,
      name: def.name,
      rateMinutes: def.defaultMinutes,
      rateCalories: def.defaultCalories,
      minutes: m,
      calories,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    // Lost a race with another device: apply the requested minutes to the entry that won.
    if (!created && minutes !== undefined) {
      await deps.workouts.updateEntryMinutes(userId, d.date, workoutId, m, calories, nowIso);
    }
  }
  return ok(await loadDayView(userId, c.ctx, d.date, deps));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
