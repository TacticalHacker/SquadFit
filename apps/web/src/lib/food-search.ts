import { normalizeFoodName, type Macros, type OwnFood, type RecentFood, type StandardFood } from "@calci/shared";

export type FoodResult = {
  key: string;
  label: "Built-in" | "Mine" | "Recent";
  kind: "standard" | "own" | "recent";
  foodId?: string;
  name: string;
  serving?: string;
  calories: number;
  macros: Macros | null;
};

/** Search across built-in, own and recent foods (FR-020). Same-named foods in different lists all show. */
export function searchFoods(
  query: string,
  lists: { builtIn: readonly StandardFood[]; own: readonly Omit<OwnFood, never>[]; recent: readonly RecentFood[] },
): FoodResult[] {
  const q = normalizeFoodName(query);
  const recent: FoodResult[] = lists.recent.map((f, i) => ({
    key: `r-${i}`, label: "Recent", kind: "recent", name: f.name, calories: f.calories, macros: f.macros,
  }));
  const own: FoodResult[] = lists.own.map((f) => ({
    key: f.foodId, label: "Mine", kind: "own", foodId: f.foodId, name: f.name, serving: f.serving, calories: f.calories, macros: f.macros,
  }));
  const builtIn: FoodResult[] = lists.builtIn.map((f) => ({
    key: f.id, label: "Built-in", kind: "standard", foodId: f.id, name: f.name, serving: f.serving, calories: f.calories, macros: f.macros,
  }));

  if (q === "") return [...recent, ...own, ...builtIn];

  const rank = (r: FoodResult) => {
    const n = normalizeFoodName(r.name);
    return n.startsWith(q) ? 0 : n.includes(q) ? 1 : 2;
  };
  const matched = [...own, ...builtIn, ...recent].filter((r) => rank(r) < 2);
  // Stable: starts-with before contains; list order (Mine, Built-in, Recent) is kept within each rank.
  return matched.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).map((x) => x.r);
}
