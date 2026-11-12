import { describe, expect, it } from "vitest";
import { GymDraftSchema, GymEntryPutSchema, GymExerciseInputSchema } from "../src/contracts/gym";
import { DayViewSchema } from "../src/contracts/workouts";

const set = (n: number, extra = {}) => ({ setNumber: n, reps: 8, weightKg: 80, completed: false, ...extra });

describe("GymEntryPutSchema", () => {
  it("accepts strength sets numbered 1..n and cardio minutes", () => {
    expect(GymEntryPutSchema.safeParse({ sets: [set(1), set(2)] }).success).toBe(true);
    expect(GymEntryPutSchema.safeParse({ minutes: 25 }).success).toBe(true);
  });

  it("rejects client totals, bad numbering, bad values, too many sets", () => {
    for (const body of [
      { sets: [set(1)], totalVolumeKg: 640 },
      { sets: [set(1)], calories: 15 },
      { minutes: 20, calories: 140 },
      { sets: [set(2)] },
      { sets: [set(1, { weightKg: 62.3 })] },
      { sets: [set(1, { reps: 0 })] },
      { sets: [] },
      { sets: Array.from({ length: 21 }, (_, i) => set(i + 1)) },
      { minutes: 0 },
      {},
    ]) {
      expect(GymEntryPutSchema.safeParse(body).success).toBe(false);
    }
  });
});

describe("GymExerciseInputSchema", () => {
  it("trims names and refuses Cardio", () => {
    expect(GymExerciseInputSchema.parse({ name: "  Hip   Thrust ", group: "legs" })).toEqual({ name: "Hip Thrust", group: "legs" });
    expect(GymExerciseInputSchema.safeParse({ name: "Rower", group: "cardio" }).success).toBe(false);
    expect(GymExerciseInputSchema.safeParse({ name: "x".repeat(41), group: "legs" }).success).toBe(false);
  });
});

describe("compat", () => {
  it("DayViewSchema defaults gym fields for older responses", () => {
    const v = DayViewSchema.parse({ date: "2026-11-11", today: "2026-11-11", timezone: "UTC", editable: true, rows: [], summary: { totalMinutes: 0, totalCalories: 0 } });
    expect(v.gym).toEqual([]);
    expect(v.gymMinutes).toBe(0);
  });

  it("GymDraftSchema rejects garbage", () => {
    expect(GymDraftSchema.safeParse({ v: 2 }).success).toBe(false);
  });
});
