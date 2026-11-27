import { EMPTY_BESTS, GymExerciseInputSchema, isExerciseNameTaken, type GymExerciseInput, type GymExerciseResponse } from "@calci/shared";
import type { Deps } from "./deps";
import { getLibrary } from "./gym-library";
import type { OwnExerciseItem } from "./gym-repo";
import { apiError, parseBody, type Parsed } from "./http";

const DUPLICATE = "You already have an exercise with that name";

/** Parse the body and check the name is free among the library (built-ins + catalog) and the caller's other active exercises (FR-005). */
export async function parseExerciseInput(rawBody: string | undefined, userId: string, deps: Deps, selfId?: string): Promise<Parsed<GymExerciseInput>> {
  const parsed = parseBody(rawBody, GymExerciseInputSchema);
  if (!parsed.ok) return parsed;
  const others = (await deps.gym.listOwnExercises(userId)).filter((e) => e.exerciseId !== selfId).map((e) => e.name);
  if (isExerciseNameTaken(parsed.data.name, others, await getLibrary(deps))) {
    return { ok: false, response: apiError(409, "DUPLICATE_NAME", DUPLICATE, { name: DUPLICATE }) };
  }
  return parsed;
}

export function toExerciseResponse(e: Pick<OwnExerciseItem, "exerciseId" | "name" | "group">): GymExerciseResponse {
  return {
    exercise: {
      exerciseId: e.exerciseId,
      name: e.name,
      group: e.group,
      kind: "strength",
      isBuiltIn: false,
      treadmill: false,
      rateMinutes: null,
      rateCalories: null,
      // A new own exercise has no history yet: baseline (feature 019).
      bests: EMPTY_BESTS,
      entry: null,
      last: null,
    },
  };
}
