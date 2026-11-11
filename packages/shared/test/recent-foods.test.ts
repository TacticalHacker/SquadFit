import { describe, expect, it } from "vitest";
import { recentFoods } from "../src/domain/recent-foods";

const e = (date: string, entryId: string, name: string, calories: number, macros: { protein: number; carbs: number; fat: number } | null = null) => ({
  date, entryId, name, calories, macros,
});

describe("recentFoods", () => {
  it("is empty without entries", () => expect(recentFoods([], 20)).toEqual([]));

  it("keeps the latest entry per normalized name, most recent first", () => {
    const out = recentFoods(
      [
        e("2026-11-09", "1762600000000-aaaaaa", "Oats", 300),
        e("2026-11-10", "1762700000000-bbbbbb", "  oats ", 320, { protein: 1, carbs: 2, fat: 3 }),
        e("2026-11-10", "1762700500000-cccccc", "Banana", 100),
        e("2026-11-08", "1762500000000-dddddd", "Rice", 200),
      ],
      20,
    );
    expect(out).toEqual([
      { name: "Banana", calories: 100, macros: null },
      { name: "oats", calories: 320, macros: { protein: 1, carbs: 2, fat: 3 } },
      { name: "Rice", calories: 200, macros: null },
    ]);
  });

  it("orders by date first, then by entry id", () => {
    const out = recentFoods([e("2026-11-10", "9999999999999-aaaaaa", "A", 1), e("2026-11-11", "1000000000000-aaaaaa", "B", 2)], 20);
    expect(out.map((f) => f.name)).toEqual(["B", "A"]);
  });

  it("caps at the limit", () => {
    const many = Array.from({ length: 30 }, (_, i) => e("2026-11-10", `${1762700000000 + i}-aaaaaa`, `Food ${i}`, 10));
    expect(recentFoods(many, 20)).toHaveLength(20);
    expect(recentFoods(many, 20)[0]!.name).toBe("Food 29");
  });
});

describe("recentFoods and photo entries", () => {
  it("ignores photo entries", () => {
    const out = recentFoods([
      { date: "2026-11-11", entryId: "2", name: "Photo meal", calories: 500, macros: null, source: "photo" },
      { date: "2026-11-10", entryId: "1", name: "Rice", calories: 300, macros: null, source: "typed" },
    ]);
    expect(out.map((f) => f.name)).toEqual(["Rice"]);
  });
});
