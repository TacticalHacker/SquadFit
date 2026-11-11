import { describe, expect, it } from "vitest";
import {
  CustomWorkoutInputSchema,
  STANDARD_WORKOUTS,
  WorkoutNameSchema,
  isNameTaken,
  normalizeWorkoutName,
} from "../src/domain/workouts";

describe("STANDARD_WORKOUTS", () => {
  it("has 12 unique, well-formed items", () => {
    expect(STANDARD_WORKOUTS).toHaveLength(12);
    expect(new Set(STANDARD_WORKOUTS.map((w) => w.id)).size).toBe(12);
    expect(new Set(STANDARD_WORKOUTS.map((w) => w.name.toLowerCase())).size).toBe(12);
    for (const w of STANDARD_WORKOUTS) {
      expect(w.id).toMatch(/^std-[a-z0-9-]+$/);
      expect(Number.isInteger(w.defaultMinutes) && w.defaultMinutes >= 1 && w.defaultMinutes <= 600).toBe(true);
      expect(Number.isInteger(w.defaultCalories) && w.defaultCalories >= 1 && w.defaultCalories <= 5000).toBe(true);
    }
  });
  it("matches research R1 for key rows", () => {
    const by = Object.fromEntries(STANDARD_WORKOUTS.map((w) => [w.id, w]));
    expect(by["std-running"]).toMatchObject({ name: "Running", defaultMinutes: 30, defaultCalories: 300 });
    expect(by["std-yoga"]).toMatchObject({ defaultMinutes: 30, defaultCalories: 90 });
    expect(by["std-team-sport"]).toMatchObject({ defaultMinutes: 60, defaultCalories: 400 });
    expect(STANDARD_WORKOUTS[0]?.id).toBe("std-walking");
  });
});

describe("names", () => {
  it("normalizes", () => expect(normalizeWorkoutName(" Bad   Minton ")).toBe("bad minton"));
  it("WorkoutNameSchema trims, collapses and bounds", () => {
    expect(WorkoutNameSchema.parse("  Bad   Minton ")).toBe("Bad Minton");
    expect(WorkoutNameSchema.safeParse("   ").success).toBe(false);
    expect(WorkoutNameSchema.safeParse("x".repeat(41)).success).toBe(false);
    expect(WorkoutNameSchema.safeParse("x".repeat(40)).success).toBe(true);
  });
  it("isNameTaken checks standard names and own names ignoring case/space", () => {
    expect(isNameTaken("running", [])).toBe(true);
    expect(isNameTaken("  Badminton ", ["badminton"])).toBe(true);
    expect(isNameTaken("Squash", ["badminton"])).toBe(false);
  });
});

describe("CustomWorkoutInputSchema", () => {
  it("accepts valid input", () => {
    expect(CustomWorkoutInputSchema.parse({ name: " Badminton ", defaultMinutes: 60, defaultCalories: 400 })).toEqual({
      name: "Badminton",
      defaultMinutes: 60,
      defaultCalories: 400,
    });
  });
  it("reports per-field errors", () => {
    const r = CustomWorkoutInputSchema.safeParse({ name: "", defaultMinutes: 0, defaultCalories: 5001 });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path[0]);
      expect(paths).toEqual(expect.arrayContaining(["name", "defaultMinutes", "defaultCalories"]));
    }
  });
});
