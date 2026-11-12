import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import {
  GymEntryPutSchema,
  STRENGTH_RATE,
  cardioTotals,
  findGymExercise,
  gymTotals,
  type ExerciseKind,
  type MuscleGroup,
} from "@calci/shared";
import { getCaller } from "../lib/auth";
import { loadDayContext, resolveWriteDate } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { loadGymSaveResult } from "../lib/gym-view-loader";
import { apiError, ok, parseBody } from "../lib/http";

interface Target {
  name: string;
  group: MuscleGroup;
  kind: ExerciseKind;
  rateMinutes: number;
  rateCalories: number;
}

/**
 * PUT /workouts/gym/entries/{date}/{exerciseId} : save (create or replace) one exercise on one day.
 * Totals are always recomputed here from the sets or minutes (FR-014). Never logs the body.
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const d = resolveWriteDate(event.pathParameters?.date, c.ctx.today);
  if (!d.ok) return d.response;
  const exerciseId = event.pathParameters?.exerciseId ?? "";
  const body = parseBody(event.body, GymEntryPutSchema);
  if (!body.ok) return body.response;

  const userId = caller.userId;
  const existing = await deps.gym.getGymEntry(userId, d.date, exerciseId);
  const existingGym = existing?.kind === "gym" ? existing : null;

  // Current definition: built-in, or the caller's active own exercise.
  let target: Target | null = null;
  const builtIn = findGymExercise(exerciseId);
  if (builtIn) {
    target = {
      name: builtIn.name,
      group: builtIn.group,
      kind: builtIn.kind,
      rateMinutes: builtIn.rateMinutes ?? STRENGTH_RATE.rateMinutes,
      rateCalories: builtIn.rateCalories ?? STRENGTH_RATE.rateCalories,
    };
  } else if (exerciseId.startsWith("gc-")) {
    const own = await deps.gym.getOwnExercise(userId, exerciseId);
    if (own && !own.removedAt) target = { name: own.name, group: own.group, kind: "strength", ...STRENGTH_RATE };
  }
  // A removed own exercise can still be re-saved on a day it was logged, keeping its stored snapshot (FR-018).
  if (!target && existingGym) {
    target = {
      name: existingGym.name,
      group: existingGym.muscleGroup ?? "chest",
      kind: existingGym.exerciseKind ?? "strength",
      rateMinutes: existingGym.rateMinutes,
      rateCalories: existingGym.rateCalories,
    };
  }
  if (!target) return apiError(404, "NOT_FOUND", "Exercise not found");

  const data = body.data;
  if (target.kind === "strength" && !("sets" in data)) {
    return apiError(400, "VALIDATION_FAILED", "This exercise is logged in sets", { sets: "Add at least one set" });
  }
  if (target.kind === "cardio" && !("minutes" in data)) {
    return apiError(400, "VALIDATION_FAILED", "This exercise is logged in minutes", { minutes: "Enter the minutes" });
  }

  const nowIso = deps.now().toISOString();
  const common = {
    date: d.date,
    workoutId: exerciseId,
    name: target.name,
    kind: "gym" as const,
    muscleGroup: target.group,
    exerciseKind: target.kind,
    rateMinutes: target.rateMinutes,
    rateCalories: target.rateCalories,
    createdAt: existingGym?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
  if ("sets" in data) {
    const totals = gymTotals(data.sets);
    await deps.gym.putGymEntry(userId, { ...common, sets: data.sets, volumeKg: totals.volumeKg, minutes: totals.minutes, calories: totals.calories });
  } else {
    const totals = cardioTotals(target.rateMinutes, target.rateCalories, data.minutes);
    await deps.gym.putGymEntry(userId, { ...common, minutes: totals.minutes, calories: totals.calories });
  }
  return ok(await loadGymSaveResult(userId, c.ctx, d.date, exerciseId, deps));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
