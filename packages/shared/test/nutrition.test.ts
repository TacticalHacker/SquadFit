import { describe, expect, it } from "vitest";
import {
  CaloriesSchema,
  MAX_MACRO_GRAMS,
  MEALS,
  MacrosSchema,
  ServingsSchema,
  completeMacros,
  scaleCalories,
  scaleGrams,
} from "../src/domain/nutrition";

describe("scaleCalories", () => {
  it.each([
    [250, 1.5, 375],
    [95, 0.5, 48],
    [1, 0.5, 1],
    [5000, 20, 100000],
  ])("%i kcal × %f = %i", (rate, servings, expected) => expect(scaleCalories(rate, servings)).toBe(expected));
});

describe("scaleGrams", () => {
  it.each([
    [1.3, 1.5, 2],
    [3.5, 1.5, 5.3],
    [0.5, 0.5, 0.3],
    [0, 7, 0],
    [24, 1.5, 36],
  ])("%f g × %f = %f", (g, s, expected) => expect(scaleGrams(g, s)).toBe(expected));

  it("never leaves floating-point noise", () => {
    for (const g of [0.1, 0.3, 1.1, 2.2, 3.3, 7.7, 12.9]) {
      for (const s of [0.5, 1, 1.5, 2, 2.5, 3, 7.5, 20]) {
        const v = scaleGrams(g, s);
        expect(Math.round(v * 10) / 10).toBe(v);
        expect(String(v).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("ServingsSchema", () => {
  it.each([0.5, 1, 1.5, 20])("accepts %f", (v) => expect(ServingsSchema.safeParse(v).success).toBe(true));
  it.each([0, 0.25, 0.7, 20.5, 21, NaN, -1, "1"])("rejects %s with the message", (v) => {
    const r = ServingsSchema.safeParse(v);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("Servings must be from 0.5 to 20 in steps of 0.5");
  });
});

describe("CaloriesSchema", () => {
  it.each([1, 650, 5000])("accepts %i", (v) => expect(CaloriesSchema.safeParse(v).success).toBe(true));
  it.each([0, 5001, 99.5, NaN, -3, undefined])("rejects %s", (v) => {
    const r = CaloriesSchema.safeParse(v);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("Calories must be a whole number from 1 to 5,000");
  });
});

describe("MacrosSchema", () => {
  it("accepts 0-500 with one decimal", () => {
    expect(MAX_MACRO_GRAMS).toBe(500);
    expect(MacrosSchema.safeParse({ protein: 0, carbs: 12.5, fat: 500 }).success).toBe(true);
  });
  it.each([-1, 500.1, 12.34])("rejects %f", (v) => {
    expect(MacrosSchema.safeParse({ protein: v, carbs: 1, fat: 1 }).success).toBe(false);
  });
});

describe("completeMacros", () => {
  it("is null when nothing is given", () => {
    expect(completeMacros({})).toBeNull();
    expect(completeMacros({ protein: undefined, carbs: undefined, fat: undefined })).toBeNull();
    expect(completeMacros(undefined)).toBeNull();
  });
  it("fills the blanks with 0 when any is given", () => {
    expect(completeMacros({ protein: 5 })).toEqual({ protein: 5, carbs: 0, fat: 0 });
    expect(completeMacros({ carbs: 1.5, fat: 2 })).toEqual({ protein: 0, carbs: 1.5, fat: 2 });
  });
});

describe("MEALS", () => {
  it("lists the meals in display order", () => expect(MEALS).toEqual(["breakfast", "lunch", "dinner", "snacks", "preworkout"]));
});
