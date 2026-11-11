import { describe, expect, it } from "vitest";
import {
  applyFoodChange,
  buildFoodDay,
  defaultMealForHour,
  entryFromFood,
  localHour,
  type FoodEntry,
} from "../src/domain/food-day";

const base = { date: "2026-11-11", today: "2026-11-11", timezone: "Asia/Kolkata", target: 2200, burnedCalories: 0 };

const typed = (entryId: string, meal: FoodEntry["meal"], name: string, calories: number, macros: FoodEntry["macros"] = null): FoodEntry => ({
  entryId, source: "typed", name, servings: 1, calories, macros, rate: { calories, macros }, meal,
});
const oats = (entryId: string, servings: number, meal: FoodEntry["meal"] = "breakfast"): FoodEntry => ({
  entryId, source: "standard", foodId: "sf-oats", name: "Oats with milk", serving: "1 bowl", meal,
  ...entryFromFood({ calories: 250, macros: { protein: 10, carbs: 38, fat: 6 } }, servings),
});

describe("entryFromFood", () => {
  it("scales calories and macros and keeps the rate", () => {
    expect(entryFromFood({ calories: 250, macros: { protein: 10, carbs: 38, fat: 6 } }, 1.5)).toEqual({
      servings: 1.5,
      rate: { calories: 250, macros: { protein: 10, carbs: 38, fat: 6 } },
      calories: 375,
      macros: { protein: 15, carbs: 57, fat: 9 },
    });
  });
  it("has no macros when the food has none", () => {
    expect(entryFromFood({ calories: 180, macros: null }, 2)).toEqual({
      servings: 2, rate: { calories: 180, macros: null }, calories: 360, macros: null,
    });
  });
});

describe("buildFoodDay", () => {
  it("always has four meals in order and an empty ledger", () => {
    const v = buildFoodDay({ ...base, entries: [] });
    expect(v.meals.map((m) => m.meal)).toEqual(["breakfast", "lunch", "dinner", "snacks"]);
    expect(v.ledger).toEqual({
      eaten: 0, burned: 0, net: 0, target: 2200, proteinTarget: null, pending: 0, remaining: 2200,
      macros: { protein: 0, carbs: 0, fat: 0, entriesWithoutMacros: 0 },
    });
    expect(v.editable).toBe(true);
  });

  it("computes meal subtotals, eaten, net and remaining", () => {
    const v = buildFoodDay({
      ...base,
      burnedCalories: 400,
      entries: [typed("1", "lunch", "Rice", 1000), typed("2", "snacks", "Banana", 100), oats("3", 1.5), typed("4", "lunch", "Dal", 700)],
    });
    expect(v.meals.map((m) => m.subtotal)).toEqual([375, 1700, 0, 100]);
    expect(v.meals[1]!.entries.map((e) => e.entryId)).toEqual(["1", "4"]); // order added
    expect(v.ledger).toMatchObject({ eaten: 2175, burned: 400, net: 1775, remaining: 425 });
  });

  it("remaining goes negative when over the target", () => {
    const v = buildFoodDay({ ...base, target: 1000, burnedCalories: 100, entries: [typed("1", "dinner", "Feast", 1500)] });
    expect(v.ledger.remaining).toBe(-400);
  });

  it("sums macros only for entries that have them, in whole tenths", () => {
    const v = buildFoodDay({
      ...base,
      entries: [
        typed("1", "snacks", "A", 100, { protein: 0.1, carbs: 0.2, fat: 0.3 }),
        typed("2", "snacks", "B", 100, { protein: 0.2, carbs: 0.1, fat: 0.3 }),
        typed("3", "snacks", "C", 100),
      ],
    });
    expect(v.ledger.macros).toEqual({ protein: 0.3, carbs: 0.3, fat: 0.6, entriesWithoutMacros: 1 });
  });

  it("sets editable from the window", () => {
    expect(buildFoodDay({ ...base, date: "2026-11-09", entries: [] }).editable).toBe(true);
    expect(buildFoodDay({ ...base, date: "2026-11-08", entries: [] }).editable).toBe(false);
  });
});

describe("applyFoodChange", () => {
  const empty = buildFoodDay({ ...base, burnedCalories: 200, entries: [] });

  it("add updates the meal, subtotal and ledger", () => {
    const v = applyFoodChange(empty, { type: "add", entry: oats("t1", 1) });
    expect(v.meals[0]!.entries).toHaveLength(1);
    expect(v.meals[0]!.subtotal).toBe(250);
    expect(v.ledger).toMatchObject({ eaten: 250, burned: 200, net: 50, remaining: 2150 });
    expect(v.ledger.macros).toEqual({ protein: 10, carbs: 38, fat: 6, entriesWithoutMacros: 0 });
  });

  it("update on a list entry recomputes from the entry's own rate", () => {
    const start = buildFoodDay({ ...base, entries: [oats("1", 1)] });
    const v = applyFoodChange(start, { type: "update", entryId: "1", patch: { servings: 2 } });
    expect(v.meals[0]!.entries[0]).toMatchObject({ servings: 2, calories: 500, macros: { protein: 20, carbs: 76, fat: 12 } });
  });

  it("update on a list entry ignores name/calories/macros (not editable)", () => {
    const start = buildFoodDay({ ...base, entries: [oats("1", 1)] });
    const v = applyFoodChange(start, { type: "update", entryId: "1", patch: { name: "x", calories: 1, macros: null } });
    expect(v).toEqual(start);
  });

  it("update on a typed entry changes name, calories, macros and meal; macros can be cleared", () => {
    const start = buildFoodDay({ ...base, entries: [typed("1", "snacks", "Banana", 100, { protein: 1, carbs: 24, fat: 0 })] });
    const v = applyFoodChange(start, { type: "update", entryId: "1", patch: { name: "Big banana", calories: 120, meal: "lunch", macros: null } });
    expect(v.meals[3]!.entries).toHaveLength(0);
    expect(v.meals[1]!.entries[0]).toMatchObject({ name: "Big banana", calories: 120, macros: null });
    expect(v.ledger.macros.entriesWithoutMacros).toBe(1);
  });

  it("remove drops the entry", () => {
    const start = buildFoodDay({ ...base, entries: [oats("1", 1)] });
    expect(applyFoodChange(start, { type: "remove", entryId: "1" })).toEqual(buildFoodDay({ ...base, entries: [] }));
  });

  it("matches a rebuild from the entries the server would store", () => {
    let v = empty;
    v = applyFoodChange(v, { type: "add", entry: oats("a", 1.5) });
    v = applyFoodChange(v, { type: "add", entry: typed("b", "snacks", "Banana", 100) });
    v = applyFoodChange(v, { type: "update", entryId: "a", patch: { servings: 2, meal: "lunch" } });
    v = applyFoodChange(v, { type: "remove", entryId: "b" });
    const rebuilt = buildFoodDay({ ...base, burnedCalories: 200, entries: [oats("a", 2, "lunch")] });
    expect(v).toEqual(rebuilt);
  });
});

describe("defaultMealForHour / localHour", () => {
  it.each([
    [0, "breakfast"], [10, "breakfast"], [11, "lunch"], [14, "lunch"],
    [15, "snacks"], [17, "snacks"], [18, "dinner"], [23, "dinner"],
  ] as const)("hour %i → %s", (h, meal) => expect(defaultMealForHour(h)).toBe(meal));

  it("gives the hour in the zone", () => {
    const t = new Date("2026-11-11T20:00:00Z");
    expect(localHour(t, "Asia/Kolkata")).toBe(1);
    expect(localHour(t, "America/Los_Angeles")).toBe(12);
    expect(localHour(new Date("2026-11-11T18:30:00Z"), "UTC")).toBe(18);
    expect(localHour(new Date("2026-11-11T00:10:00Z"), "UTC")).toBe(0);
  });
});

describe("proteinTarget on the ledger", () => {
  it("defaults to null and carries the given value through changes", () => {
    expect(buildFoodDay({ ...base, entries: [] }).ledger.proteinTarget).toBeNull();
    const v = buildFoodDay({ ...base, proteinTarget: 130, entries: [] });
    expect(v.ledger.proteinTarget).toBe(130);
    const next = applyFoodChange(v, { type: "add", entry: typed("a", "lunch", "Rice", 300) });
    expect(next.ledger.proteinTarget).toBe(130);
  });
});

describe("pending photo entries", () => {
  const photo = (entryId: string, status: "pending" | "ai" | "manual" | "edited", calories = 0, macros: FoodEntry["macros"] = null): FoodEntry => ({
    entryId, source: "photo", name: "Photo meal", servings: 1, calories, macros, rate: { calories, macros }, meal: "lunch",
    photo: { status, caption: "dal" },
  });

  it("appear in their meal but add nothing to any total and are counted as pending", () => {
    const v = buildFoodDay({ ...base, entries: [typed("a", "lunch", "Rice", 300, { protein: 5, carbs: 60, fat: 1 }), photo("p", "pending")] });
    expect(v.meals[1]!.entries).toHaveLength(2);
    expect(v.meals[1]!.subtotal).toBe(300);
    expect(v.ledger).toMatchObject({ eaten: 300, net: 300, remaining: 1900, pending: 1 });
    expect(v.ledger.macros).toEqual({ protein: 5, carbs: 60, fat: 1, entriesWithoutMacros: 0 });
  });

  it("count normally once analysed", () => {
    for (const status of ["ai", "manual", "edited"] as const) {
      const v = buildFoodDay({ ...base, entries: [photo("p", status, 520, { protein: 18, carbs: 82, fat: 12 })] });
      expect(v.ledger).toMatchObject({ eaten: 520, pending: 0 });
      expect(v.ledger.macros.protein).toBe(18);
    }
  });

  it("applyFoodChange edits a pending caption and fills it by hand (manual), keeping the pending count right", () => {
    const v0 = buildFoodDay({ ...base, entries: [photo("p", "pending")] });
    const v1 = applyFoodChange(v0, { type: "update", entryId: "p", patch: { caption: "dal and rice", meal: "dinner" } });
    const e1 = v1.meals[2]!.entries[0]!;
    expect(e1.photo).toMatchObject({ status: "pending", caption: "dal and rice" });
    expect(v1.ledger.pending).toBe(1);
    const v2 = applyFoodChange(v1, { type: "update", entryId: "p", patch: { calories: 400 } });
    expect(v2.meals[2]!.entries[0]!.photo?.status).toBe("manual");
    expect(v2.ledger).toMatchObject({ eaten: 400, pending: 0 });
  });

  it("applyFoodChange marks a corrected AI estimate as edited", () => {
    const v0 = buildFoodDay({ ...base, entries: [photo("p", "ai", 500, { protein: 10, carbs: 50, fat: 10 })] });
    const v1 = applyFoodChange(v0, { type: "update", entryId: "p", patch: { calories: 450 } });
    expect(v1.meals[1]!.entries[0]).toMatchObject({ calories: 450, photo: { status: "edited" } });
  });
});
