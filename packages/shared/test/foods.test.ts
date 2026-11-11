import { describe, expect, it } from "vitest";
import {
  FoodNameSchema,
  OwnFoodInputSchema,
  STANDARD_FOODS,
  findStandardFood,
  isOwnFoodNameTaken,
  normalizeFoodName,
} from "../src/domain/foods";

describe("STANDARD_FOODS", () => {
  it("has 40 unique, well-formed items", () => {
    expect(STANDARD_FOODS).toHaveLength(40);
    expect(new Set(STANDARD_FOODS.map((f) => f.id)).size).toBe(40);
    expect(new Set(STANDARD_FOODS.map((f) => f.name.toLowerCase())).size).toBe(40);
    for (const f of STANDARD_FOODS) {
      expect(f.id).toMatch(/^sf-[a-z0-9-]+$/);
      expect(f.name.length).toBeGreaterThanOrEqual(1);
      expect(f.name.length).toBeLessThanOrEqual(60);
      expect(f.serving.length).toBeGreaterThanOrEqual(1);
      expect(f.serving.length).toBeLessThanOrEqual(40);
      expect(Number.isInteger(f.calories) && f.calories >= 1 && f.calories <= 5000).toBe(true);
      for (const g of [f.macros.protein, f.macros.carbs, f.macros.fat]) {
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(500);
        expect(Math.round(g * 10) / 10).toBe(g);
      }
    }
  });

  it("matches research R1 for key rows", () => {
    expect(findStandardFood("sf-oats")).toMatchObject({ name: "Oats with milk", serving: "1 bowl", calories: 250, macros: { protein: 10, carbs: 38, fat: 6 } });
    expect(findStandardFood("sf-dal")).toMatchObject({ calories: 180 });
    expect(findStandardFood("sf-biryani")).toMatchObject({ calories: 450, macros: { protein: 25, carbs: 55, fat: 14 } });
    expect(findStandardFood("sf-nope")).toBeUndefined();
  });

  it("calories are within 10% of what the macros imply", () => {
    for (const f of STANDARD_FOODS) {
      const implied = 4 * f.macros.protein + 4 * f.macros.carbs + 9 * f.macros.fat;
      expect(Math.abs(f.calories - implied), f.name).toBeLessThanOrEqual(f.calories * 0.1);
    }
  });
});

describe("names", () => {
  it("normalizes", () => expect(normalizeFoodName(" Mom's  Paratha ")).toBe("mom's paratha"));
  it("FoodNameSchema trims, collapses and bounds", () => {
    expect(FoodNameSchema.parse("  Mom's   Paratha ")).toBe("Mom's Paratha");
    expect(FoodNameSchema.safeParse("   ").success).toBe(false);
    expect(FoodNameSchema.safeParse("x".repeat(61)).success).toBe(false);
    expect(FoodNameSchema.safeParse("x".repeat(60)).success).toBe(true);
  });
  it("isOwnFoodNameTaken only checks the user's own foods", () => {
    expect(isOwnFoodNameTaken(" MOM'S paratha ", ["mom's  paratha"])).toBe(true);
    expect(isOwnFoodNameTaken("dal", [])).toBe(false);
    expect(isOwnFoodNameTaken("Idli", ["Dal"])).toBe(false);
  });
});

describe("OwnFoodInputSchema", () => {
  const ok = { name: " Paratha ", serving: "1 piece", calories: 180 };
  it("accepts input with and without macros", () => {
    expect(OwnFoodInputSchema.parse(ok)).toEqual({ name: "Paratha", serving: "1 piece", calories: 180 });
    expect(OwnFoodInputSchema.parse({ ...ok, macros: { protein: 4, carbs: 25, fat: 7 } }).macros).toEqual({ protein: 4, carbs: 25, fat: 7 });
  });
  it("reports per-field errors", () => {
    const r = OwnFoodInputSchema.safeParse({ name: "", serving: "", calories: 0 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(["name", "serving", "calories"]));
  });
  it("rejects a serving over 40 chars and partial macros", () => {
    expect(OwnFoodInputSchema.safeParse({ ...ok, serving: "x".repeat(41) }).success).toBe(false);
    expect(OwnFoodInputSchema.safeParse({ ...ok, macros: { protein: 1 } }).success).toBe(false);
  });
});
