import { describe, expect, it } from "vitest";
import { MinutesSchema, caloriesFor, summarize } from "../src/domain/calories";

describe("caloriesFor", () => {
  it.each([
    [30, 300, 45, 450],
    [30, 300, 30, 300],
    [45, 220, 1, 5],
    [15, 45, 7, 21],
    [4, 10, 1, 3],
  ])("rate %i min / %i kcal at %i min = %i", (rm, rc, m, expected) => {
    expect(caloriesFor(rm, rc, m)).toBe(expected);
  });
});

describe("summarize", () => {
  it("sums rounded entry values", () => {
    expect(summarize([{ minutes: 30, calories: 300 }, { minutes: 7, calories: 21 }])).toEqual({
      totalMinutes: 37,
      totalCalories: 321,
    });
  });
  it("is zero when empty", () => {
    expect(summarize([])).toEqual({ totalMinutes: 0, totalCalories: 0 });
  });
});

describe("MinutesSchema", () => {
  it.each([1, 30, 600])("accepts %i", (v) => expect(MinutesSchema.safeParse(v).success).toBe(true));
  it.each([0, 601, 12.5, NaN, -5, "30"])("rejects %s with the range message", (v) => {
    const r = MinutesSchema.safeParse(v);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("Minutes must be a whole number from 1 to 600");
  });
});
