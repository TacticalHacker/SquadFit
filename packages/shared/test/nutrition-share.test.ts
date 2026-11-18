import { describe, expect, it } from "vitest";
import { buildFoodDay, type FoodEntry } from "../src/domain/food-day";
import { NutritionMealsSchema, NutritionTotalsSchema } from "../src/contracts/squad-profile";
import { hitDays, nutritionFor, proteinByDay, isProteinRun, rankNutrition } from "../src/domain/nutrition-share";

const food = (date: string, protein: number | null, extra: Partial<FoodEntry> = {}): FoodEntry & { date: string } => ({
  date,
  entryId: `${date}-${protein}-${Math.random()}`,
  source: "typed",
  name: "Chicken",
  servings: 1,
  calories: 300,
  macros: protein === null ? null : { protein, carbs: 10, fat: 5 },
  rate: { calories: 300, macros: null },
  meal: "lunch",
  ...extra,
});
const view = (entries: FoodEntry[]) => buildFoodDay({ date: "2026-11-16", today: "2026-11-16", timezone: "UTC", target: 2200, proteinTarget: 160, burnedCalories: 420, entries });

describe("nutritionFor", () => {
  const v = view([food("2026-11-16", 40, { photo: { status: "ai", caption: "lunch", url: "https://x/y.jpg" } })]);
  it("returns nothing at off, totals-only at totals, everything at meals", () => {
    expect(nutritionFor("off", v, false)).toBeUndefined();
    const totals = nutritionFor("totals", v, true);
    expect(NutritionTotalsSchema.parse(totals)).toMatchObject({ caloriesIn: 300, protein: 40, proteinTarget: 160, burned: 420, burnedAdjusted: true });
    expect(Object.keys(totals)).not.toContain("meals");
    expect(JSON.stringify(totals)).not.toContain("y.jpg");
    expect(() => NutritionTotalsSchema.parse({ ...totals, meals: [] })).toThrow();
    const meals = NutritionMealsSchema.parse(nutritionFor("meals", v, false));
    expect(meals.meals[0]!.items[0]).toMatchObject({ name: "Chicken", photoUrl: "https://x/y.jpg", caption: "lunch" });
  });
});

describe("protein target days", () => {
  it("counts a hit only with a counted entry at or above the target; pending photos count in nothing", () => {
    const byDay = proteinByDay([
      food("2026-11-10", 160),
      food("2026-11-11", 159),
      food("2026-11-12", null),
      food("2026-11-13", 200, { source: "photo", photo: { status: "pending", caption: "" } }),
    ]);
    expect(hitDays(byDay, ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"], 160)).toEqual({ hit: 1, logged: 3 });
  });

  it("recognises 7 consecutive hit days and breaks on a miss", () => {
    const entries = Array.from({ length: 7 }, (_, i) => food(`2026-11-0${i + 1}`, 170));
    expect(isProteinRun(proteinByDay(entries), "2026-11-07", 160)).toBe(true);
    expect(isProteinRun(proteinByDay([...entries.slice(0, 3), ...entries.slice(4)]), "2026-11-07", 160)).toBe(false);
  });
});

describe("rankNutrition", () => {
  it("ranks on hit days only, ties share a rank, and ignores everything else", () => {
    const ranked = rankNutrition([
      { userId: "a", name: "Ana", hit: 6, logged: 7 },
      { userId: "b", name: "Bo", hit: 6, logged: 6 },
      { userId: "c", name: "Cy", hit: 4, logged: 7 },
    ]);
    expect(ranked.map((r) => [r.userId, r.rank])).toEqual([["a", 1], ["b", 1], ["c", 3]]);
  });
});
