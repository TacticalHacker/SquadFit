import { describe, expect, it } from "vitest";
import { searchFoods } from "./food-search";

const builtIn = [
  { id: "sf-dal", name: "Dal", serving: "1 cup", calories: 180, macros: { protein: 10, carbs: 27, fat: 4 } },
  { id: "sf-idli", name: "Idli", serving: "2 pieces", calories: 120, macros: { protein: 4, carbs: 25, fat: 0.5 } },
  { id: "sf-chicken-curry", name: "Chicken curry", serving: "1 cup", calories: 300, macros: { protein: 28, carbs: 8, fat: 17 } },
];
const own = [{ foodId: "f-1", name: "Dal makhani", serving: "1 bowl", calories: 320, macros: null }];
const recent = [{ name: "Oats", calories: 300, macros: null }];
const lists = { builtIn, own, recent };

describe("searchFoods", () => {
  it("empty query shows recent first, then mine, then built-in", () => {
    const r = searchFoods("", lists);
    expect(r.map((x) => x.label)).toEqual(["Recent", "Mine", "Built-in", "Built-in", "Built-in"]);
  });

  it("matches ignoring capitalisation and surrounding spaces, labelled by list", () => {
    const r = searchFoods("  DAL ", lists);
    expect(r.map((x) => [x.label, x.name])).toEqual([["Mine", "Dal makhani"], ["Built-in", "Dal"]].sort(() => 0));
  });

  it("puts names that start with the query before those that merely contain it", () => {
    const r = searchFoods("c", lists);
    expect(r[0]!.name).toBe("Chicken curry");
  });

  it("keeps a saved food and a built-in with the same name", () => {
    const r = searchFoods("dal", { builtIn, own: [{ ...own[0]!, name: "Dal" }], recent: [] });
    expect(r.filter((x) => x.name === "Dal")).toHaveLength(2);
  });

  it("carries what is needed to add the food", () => {
    const r = searchFoods("idli", lists)[0]!;
    expect(r).toMatchObject({ label: "Built-in", kind: "standard", foodId: "sf-idli", serving: "2 pieces", calories: 120 });
    expect(searchFoods("oats", lists)[0]).toMatchObject({ label: "Recent", kind: "recent", name: "Oats" });
    expect(searchFoods("makhani", lists)[0]).toMatchObject({ label: "Mine", kind: "own", foodId: "f-1" });
  });

  it("returns nothing when nothing matches", () => {
    expect(searchFoods("zzz", lists)).toEqual([]);
  });
});
