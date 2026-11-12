import { describe, expect, it } from "vitest";
import {
  CustomWorkoutInputSchema,
  WorkoutNameSchema,
  isNameTaken,
  normalizeWorkoutName,
} from "../src/domain/workouts";

describe("names", () => {
  it("normalizes", () => expect(normalizeWorkoutName(" Bad   Minton ")).toBe("bad minton"));
  it("WorkoutNameSchema trims, collapses and bounds", () => {
    expect(WorkoutNameSchema.parse("  Bad   Minton ")).toBe("Bad Minton");
    expect(WorkoutNameSchema.safeParse("   ").success).toBe(false);
    expect(WorkoutNameSchema.safeParse("x".repeat(41)).success).toBe(false);
    expect(WorkoutNameSchema.safeParse("x".repeat(40)).success).toBe(true);
  });
  it("isNameTaken checks own names only, ignoring case/space (feature 007: no built-ins)", () => {
    expect(isNameTaken("running", [])).toBe(false);
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
