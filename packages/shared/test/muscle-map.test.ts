import { describe, expect, it } from "vitest";
import { GYM_EXERCISES, type GymEntryView, type GymSet } from "../src/domain/gym";
import { MUSCLE_MAP, dayMuscleLoad, exercisesForRegion, heatStep, musclesFor } from "../src/domain/muscle-map";

const sets = (n: number, completed = true, reps = 8): GymSet[] =>
  Array.from({ length: n }, (_, i) => ({ setNumber: i + 1, reps, weightKg: 40, completed }));

type E = Pick<GymEntryView, "exerciseId" | "muscleGroup" | "exerciseKind" | "sets">;
const strength = (exerciseId: string, muscleGroup: GymEntryView["muscleGroup"], s: GymSet[]): E => ({
  exerciseId,
  muscleGroup,
  exerciseKind: "strength",
  sets: s,
});

describe("MUSCLE_MAP", () => {
  it("maps every built-in strength exercise and no cardio", () => {
    for (const ex of GYM_EXERCISES) {
      const row = MUSCLE_MAP[ex.id];
      if (ex.kind === "cardio") {
        expect(row, ex.id).toBeUndefined();
        continue;
      }
      expect(row?.primary.length, ex.id).toBeGreaterThan(0);
      expect(row!.secondary.filter((r) => row!.primary.includes(r)), ex.id).toEqual([]);
    }
  });

  it("falls back to the muscle group for exercises not in the table", () => {
    expect(musclesFor("gc-x", "arms")).toEqual({ primary: ["biceps", "triceps"], secondary: [] });
  });
});

describe("dayMuscleLoad", () => {
  it("weights primary sets 1 and secondary 0.5, ticked or not (spec worked example)", () => {
    const load = dayMuscleLoad([
      strength("gx-bench-press", "chest", [...sets(2), ...sets(2, false), ...sets(1, true, 0)]),
      strength("gx-tricep-pushdown", "arms", sets(2)),
      { exerciseId: "gx-stairmaster", muscleGroup: "cardio", exerciseKind: "cardio", sets: null },
    ]);
    expect(load.chest).toEqual({ direct: 4, indirect: 0, score: 4, step: 2 });
    expect(load["front-delts"]).toEqual({ direct: 0, indirect: 4, score: 2, step: 1 });
    expect(load.triceps).toEqual({ direct: 2, indirect: 4, score: 4, step: 2 });
    expect(load.calves.score).toBe(0);
  });

  it("steps at 3 and 6", () => {
    expect([0, 2.5, 3, 5.5, 6].map(heatStep)).toEqual([0, 1, 2, 2, 3]);
  });
});

describe("exercisesForRegion", () => {
  it("lists exercises for the region, ones done today first", () => {
    const ex = (exerciseId: string, group: GymEntryView["muscleGroup"], done: boolean, kind: "strength" | "cardio" = "strength") => ({
      exerciseId,
      group,
      kind,
      entry: done ? { sets: sets(1) } : null,
    });
    const out = exercisesForRegion(
      [ex("gx-lat-pulldown", "back", false), ex("gx-bench-press", "chest", true), ex("gx-pull-ups", "back", true), ex("gx-stairmaster", "cardio", true, "cardio")],
      "lats",
    );
    expect(out.map((e) => e.exerciseId)).toEqual(["gx-pull-ups", "gx-lat-pulldown"]);
  });
});
