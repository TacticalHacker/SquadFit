import { isEditableDay } from "./day";
import { MEALS, scaleCalories, scaleMacros, type Macros, type Meal } from "./nutrition";

export interface FoodEntry {
  entryId: string;
  source: "typed" | "standard" | "own";
  foodId?: string;
  name: string;
  serving?: string;
  servings: number;
  calories: number;
  macros: Macros | null;
  /** Per-serving snapshot the entry was logged with (FR-008). For typed entries it equals the totals. */
  rate: { calories: number; macros: Macros | null };
  meal: Meal;
}

export interface MealGroup {
  meal: Meal;
  subtotal: number;
  entries: FoodEntry[];
}

export interface FoodLedger {
  eaten: number;
  burned: number;
  net: number;
  target: number;
  /** target − net; negative means over the target. */
  remaining: number;
  macros: { protein: number; carbs: number; fat: number; entriesWithoutMacros: number };
}

export interface FoodDayView {
  date: string;
  today: string;
  timezone: string;
  editable: boolean;
  meals: MealGroup[];
  ledger: FoodLedger;
}

export type FoodPatch = {
  name?: string;
  calories?: number;
  macros?: Macros | null;
  meal?: Meal;
  servings?: number;
};

export type FoodChange =
  | { type: "add"; entry: FoodEntry }
  | { type: "update"; entryId: string; patch: FoodPatch }
  | { type: "remove"; entryId: string };

/** Entry values for `servings` of a food with a per-serving rate. */
export function entryFromFood(food: { calories: number; macros: Macros | null }, servings: number) {
  return {
    servings,
    rate: { calories: food.calories, macros: food.macros },
    calories: scaleCalories(food.calories, servings),
    macros: scaleMacros(food.macros, servings),
  };
}

function assemble(
  head: Pick<FoodDayView, "date" | "today" | "timezone" | "editable">,
  target: number,
  burned: number,
  entries: readonly FoodEntry[],
): FoodDayView {
  const meals: MealGroup[] = MEALS.map((meal) => {
    const list = entries.filter((e) => e.meal === meal);
    return { meal, subtotal: list.reduce((n, e) => n + e.calories, 0), entries: list };
  });
  const eaten = meals.reduce((n, m) => n + m.subtotal, 0);
  let p = 0;
  let c = 0;
  let f = 0;
  let without = 0;
  for (const e of entries) {
    if (!e.macros) {
      without++;
      continue;
    }
    p += Math.round(e.macros.protein * 10);
    c += Math.round(e.macros.carbs * 10);
    f += Math.round(e.macros.fat * 10);
  }
  const net = eaten - burned;
  return {
    ...head,
    meals,
    ledger: {
      eaten,
      burned,
      net,
      target,
      remaining: target - net,
      macros: { protein: p / 10, carbs: c / 10, fat: f / 10, entriesWithoutMacros: without },
    },
  };
}

export function buildFoodDay(input: {
  date: string;
  today: string;
  timezone: string;
  target: number;
  burnedCalories: number;
  entries: readonly FoodEntry[];
}): FoodDayView {
  return assemble(
    { date: input.date, today: input.today, timezone: input.timezone, editable: isEditableDay(input.date, input.today) },
    input.target,
    input.burnedCalories,
    input.entries,
  );
}

/** Pure change used by the optimistic client; list entries recompute from their own rate (clarification Q2). */
export function applyFoodChange(view: FoodDayView, change: FoodChange): FoodDayView {
  const current = view.meals.flatMap((m) => m.entries);
  let next: FoodEntry[];
  if (change.type === "add") {
    next = [...current, change.entry];
  } else if (change.type === "remove") {
    next = current.filter((e) => e.entryId !== change.entryId);
  } else {
    next = current.map((e) => {
      if (e.entryId !== change.entryId) return e;
      const p = change.patch;
      if (e.source === "typed") {
        const calories = p.calories ?? e.calories;
        const macros = p.macros === undefined ? e.macros : p.macros;
        return {
          ...e,
          name: p.name ?? e.name,
          meal: p.meal ?? e.meal,
          calories,
          macros,
          rate: { calories, macros },
        };
      }
      const servings = p.servings ?? e.servings;
      return {
        ...e,
        meal: p.meal ?? e.meal,
        servings,
        calories: scaleCalories(e.rate.calories, servings),
        macros: scaleMacros(e.rate.macros, servings),
      };
    });
  }
  const { date, today, timezone, editable } = view;
  return assemble({ date, today, timezone, editable }, view.ledger.target, view.ledger.burned, next);
}

/** Meal to preselect for today, from the user's local hour (clarification Q4). Display only. */
export function defaultMealForHour(hour: number): Meal {
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snacks";
  return "dinner";
}

export function localHour(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  return Number(parts.find((p) => p.type === "hour")?.value ?? 0);
}
