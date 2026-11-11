import { CustomWorkoutInputSchema, isNameTaken, type CustomWorkoutInput } from "@calci/shared";
import type { Deps } from "./deps";
import { apiError, parseBody, type Parsed } from "./http";

/** Parse the body and check the name is free among standard + the caller's other active workouts (FR-020). */
export async function parseCustomInput(
  rawBody: string | undefined,
  userId: string,
  deps: Deps,
  selfId?: string,
): Promise<Parsed<CustomWorkoutInput>> {
  const parsed = parseBody(rawBody, CustomWorkoutInputSchema);
  if (!parsed.ok) return parsed;
  const existing = (await deps.workouts.listCustomWorkouts(userId))
    .filter((w) => w.workoutId !== selfId)
    .map((w) => w.name);
  if (isNameTaken(parsed.data.name, existing)) {
    return {
      ok: false,
      response: apiError(409, "DUPLICATE_NAME", "You already have a workout with that name", {
        name: "You already have a workout with that name",
      }),
    };
  }
  return parsed;
}
