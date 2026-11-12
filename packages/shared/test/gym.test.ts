import { describe, expect, it } from "vitest";
import {
  GYM_EXERCISES,
  cardioTotals,
  findGymExercise,
  formatLast,
  formatWeight,
  gymTotals,
  isExerciseNameTaken,
  isGymId,
  parseMinutes,
  parseReps,
  parseWeight,
  topSet,
  dayGymVolume,
  findGymExerciseByName,
} from "../src/domain/gym";
import { normalizeWorkoutName } from "../src/domain/workouts";

const sets = (n: number, weightKg: number, reps: number) =>
  Array.from({ length: n }, (_, i) => ({ setNumber: i + 1, weightKg, reps, completed: false }));

describe("GYM_EXERCISES", () => {
  it("has the 28 FR-001 exercises in their groups", () => {
    const byGroup = (g: string) => GYM_EXERCISES.filter((e) => e.group === g).map((e) => e.name);
    expect(GYM_EXERCISES).toHaveLength(28);
    expect(byGroup("chest")).toEqual(["Bench Press", "Incline Dumbbell Press", "Cable Flyes", "Chest Dips", "Machine Chest Press"]);
    expect(byGroup("back")).toEqual(["Deadlift", "Lat Pulldown", "Barbell Row", "Seated Cable Row", "Pull-Ups"]);
    expect(byGroup("legs")).toEqual(["Barbell Squat", "Leg Press", "Romanian Deadlift", "Leg Extension", "Hamstring Curl", "Calf Raises"]);
    expect(byGroup("shoulders")).toEqual(["Overhead Press", "Lateral Raises", "Face Pulls", "Rear Delt Flyes"]);
    expect(byGroup("arms")).toEqual(["Barbell Curl", "Hammer Curl", "Tricep Pushdown", "Skullcrushers"]);
    expect(byGroup("core")).toEqual(["Hanging Leg Raises", "Cable Crunch"]);
    expect(byGroup("cardio")).toEqual(["Incline Treadmill Walk", "Stairmaster"]);
  });

  it("uses unique gx- ids and names that clash with nothing", () => {
    expect(GYM_EXERCISES.every((e) => /^gx-[a-z0-9-]+$/.test(e.id))).toBe(true);
    expect(new Set(GYM_EXERCISES.map((e) => e.id)).size).toBe(28);
    const names = GYM_EXERCISES.map((e) => normalizeWorkoutName(e.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it("only cardio items are cardio, with their rates", () => {
    expect(GYM_EXERCISES.filter((e) => e.kind === "cardio").map((e) => e.id)).toEqual(["gx-incline-treadmill-walk", "gx-stairmaster"]);
    expect(findGymExercise("gx-incline-treadmill-walk")).toMatchObject({ rateMinutes: 20, rateCalories: 140 });
    expect(findGymExercise("gx-stairmaster")).toMatchObject({ rateMinutes: 20, rateCalories: 180 });
  });

  it("isGymId recognises gx- and gc- only", () => {
    expect(isGymId("gx-bench-press")).toBe(true);
    expect(isGymId("gc-123")).toBe(true);
    expect(isGymId("std-running")).toBe(false);
    expect(isGymId("c-123")).toBe(false);
  });
});

describe("gymTotals (FR-013 worked examples)", () => {
  it.each([
    [sets(3, 80, 8), { volumeKg: 1920, minutes: 8, calories: 45 }],
    [sets(5, 60, 5), { volumeKg: 1500, minutes: 13, calories: 75 }],
    [sets(1, 20, 10), { volumeKg: 200, minutes: 3, calories: 15 }],
    [sets(4, 0, 12), { volumeKg: 0, minutes: 10, calories: 60 }],
    [sets(2, 62.5, 7), { volumeKg: 875, minutes: 5, calories: 30 }],
    [sets(3, 60, 10), { volumeKg: 1800, minutes: 8, calories: 45 }],
  ])("%#", (s, expected) => {
    expect(gymTotals(s)).toEqual(expected);
  });

  it("keeps one decimal of volume without float drift", () => {
    expect(gymTotals([{ weightKg: 0.5, reps: 3 }, { weightKg: 22.5, reps: 7 }]).volumeKg).toBe(159);
    expect(gymTotals([{ weightKg: 2.5, reps: 1 }, { weightKg: 0.5, reps: 1 }]).volumeKg).toBe(3);
    expect(gymTotals([{ weightKg: 0.5, reps: 1 }]).volumeKg).toBe(0.5);
  });

  it("cardio uses the 002 rate rule", () => {
    expect(cardioTotals(20, 140, 25)).toEqual({ minutes: 25, calories: 175 });
    expect(cardioTotals(20, 180, 20)).toEqual({ minutes: 20, calories: 180 });
  });
});

describe("topSet and formatLast", () => {
  it("picks heaviest, then most reps, then earliest", () => {
    const s = [
      { setNumber: 1, weightKg: 60, reps: 10 },
      { setNumber: 2, weightKg: 80, reps: 6 },
      { setNumber: 3, weightKg: 80, reps: 8 },
      { setNumber: 4, weightKg: 80, reps: 8 },
    ];
    expect(topSet(s)).toEqual({ weightKg: 80, reps: 8, setNumber: 3 });
    expect(topSet([])).toBeNull();
  });

  it("renders kg and BW", () => {
    expect(formatLast({ weightKg: 80, reps: 8 })).toBe("Last: 80kg × 8");
    expect(formatLast({ weightKg: 62.5, reps: 5 })).toBe("Last: 62.5kg × 5");
    expect(formatLast({ weightKg: 0, reps: 12 })).toBe("Last: BW × 12");
    expect(formatWeight(0)).toBe("BW");
  });
});

describe("parsers", () => {
  it("parseWeight accepts 0.5 steps 0–500, comma decimals", () => {
    for (const [raw, v] of [["62.5", 62.5], ["62,5", 62.5], ["0", 0], ["500", 500], [" 80 ", 80], [".5", 0.5]] as const) {
      expect(parseWeight(raw)).toEqual({ ok: true, value: v });
    }
    for (const raw of ["62.3", "-1", "500.5", "abc", "", "1e2"]) {
      expect(parseWeight(raw).ok).toBe(false);
    }
  });

  it("parseReps accepts whole 1–100", () => {
    expect(parseReps("8")).toEqual({ ok: true, value: 8 });
    expect(parseReps("100")).toEqual({ ok: true, value: 100 });
    for (const raw of ["0", "1.5", "101", "-2", "x", ""]) expect(parseReps(raw).ok).toBe(false);
  });

  it("parseMinutes accepts whole 1–600", () => {
    expect(parseMinutes("25")).toEqual({ ok: true, value: 25 });
    for (const raw of ["0", "601", "2.5"]) expect(parseMinutes(raw).ok).toBe(false);
  });
});

describe("own exercise names", () => {
  it("clash with built-ins and own names ignoring case and spaces", () => {
    expect(isExerciseNameTaken("  bench   press ", [])).toBe(true);
    expect(isExerciseNameTaken("Hip Thrust", ["hip thrust"])).toBe(true);
    expect(isExerciseNameTaken("Hip Thrust", ["Cable Kickback"])).toBe(false);
  });
});

describe("dayGymVolume (feature 007)", () => {
  const base = { name: "x", rateMinutes: 1, rateCalories: 1, minutes: 5, calories: 10 };
  it("is 0 for no entries", () => expect(dayGymVolume([])).toBe(0));
  it("sums the volume of gym lifts only", () => {
    expect(
      dayGymVolume([
        { ...base, workoutId: "gx-a", kind: "gym", exerciseKind: "strength", volumeKg: 1440 },
        { ...base, workoutId: "gx-b", kind: "gym", exerciseKind: "strength", volumeKg: 562.5 },
        { ...base, workoutId: "gx-run", kind: "gym", exerciseKind: "cardio" },
        { ...base, workoutId: "c-padel", volumeKg: 999 },
      ]),
    ).toBe(2002.5);
  });
});

describe("findGymExerciseByName (feature 007)", () => {
  const own = [
    { exerciseId: "gc-1", name: "Zercher Squat" },
    { exerciseId: "gc-2", name: "Old Move", removedAt: "t" },
  ];
  it("matches built-ins ignoring case and spacing", () => {
    expect(findGymExerciseByName("  bench   PRESS ", own)).toBe("gx-bench-press");
  });
  it("matches the member's active own exercises", () => {
    expect(findGymExerciseByName("zercher squat", own)).toBe("gc-1");
  });
  it("ignores removed own exercises and unknown names", () => {
    expect(findGymExerciseByName("Old Move", own)).toBeNull();
    expect(findGymExerciseByName("Benchpress", own)).toBeNull();
  });
});
