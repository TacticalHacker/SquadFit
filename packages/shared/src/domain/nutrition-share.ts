import type { FoodDayView, FoodEntry } from "./food-day";
import type { Macros, Meal } from "./nutrition";
import { addDays } from "./day";
import { rankRows } from "./squad";

/** Feature 011: what another member may see of someone's food, per sharing level (constitution VI 2.4.0). */

export const NUTRITION_LEVELS = ["off", "totals", "meals"] as const;
export type NutritionLevel = (typeof NUTRITION_LEVELS)[number];
export const PROTEIN_STREAK_DAYS = 7;

export interface NutritionTotals {
  caloriesIn: number;
  calorieTarget: number | null;
  protein: number;
  carbs: number;
  fat: number;
  proteinTarget: number | null;
  burned: number;
  /** True when any workout that day carries an AI adjustment, so the figure is shown as "~ … adj.". */
  burnedAdjusted: boolean;
  pending: number;
}

export interface SharedMeal {
  meal: Meal;
  subtotalCalories: number;
  macros: Macros | null;
  items: { name: string; servings: number; calories: number; macros: Macros | null; caption?: string; photoUrl?: string }[];
}
export interface NutritionMeals extends NutritionTotals {
  meals: SharedMeal[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function mealMacros(entries: readonly FoodEntry[]): Macros | null {
  const withMacros = entries.filter((e) => e.macros);
  if (withMacros.length === 0 || withMacros.length !== entries.length) return null;
  const sum = (k: keyof Macros) => round1(withMacros.reduce((t, e) => t + Math.round(e.macros![k] * 10), 0) / 10);
  return { protein: sum("protein"), carbs: sum("carbs"), fat: sum("fat") };
}

/**
 * The single place that decides which nutrition fields leave the server. `off` returns nothing at all (the key is
 * absent, never zeros); `totals` never carries meals, items, captions or photos.
 */
export function nutritionFor(level: "off", view: FoodDayView, burnedAdjusted: boolean): undefined;
export function nutritionFor(level: "totals", view: FoodDayView, burnedAdjusted: boolean): NutritionTotals;
export function nutritionFor(level: "meals", view: FoodDayView, burnedAdjusted: boolean): NutritionMeals;
export function nutritionFor(level: NutritionLevel, view: FoodDayView, burnedAdjusted: boolean): NutritionTotals | NutritionMeals | undefined;
export function nutritionFor(level: NutritionLevel, view: FoodDayView, burnedAdjusted: boolean): NutritionTotals | NutritionMeals | undefined {
  if (level === "off") return undefined;
  const l = view.ledger;
  const totals: NutritionTotals = {
    caloriesIn: l.eaten,
    calorieTarget: l.target,
    protein: l.macros.protein,
    carbs: l.macros.carbs,
    fat: l.macros.fat,
    proteinTarget: l.proteinTarget,
    burned: l.burned,
    burnedAdjusted,
    pending: l.pending,
  };
  if (level === "totals") return totals;
  return {
    ...totals,
    meals: view.meals
      .filter((m) => m.entries.length > 0)
      .map((m) => ({
        meal: m.meal,
        subtotalCalories: m.subtotal,
        macros: mealMacros(m.entries),
        items: m.entries.map((e) => ({
          name: e.name,
          servings: e.servings,
          calories: e.calories,
          macros: e.macros,
          ...(e.photo ? { caption: e.photo.caption, ...(e.photo.url ? { photoUrl: e.photo.url } : {}) } : {}),
        })),
      })),
  };
}

// ---------------------------------------------------------------- protein target days

export interface ProteinDay {
  /** Entries that count (photo entries still pending count in nothing). */
  logged: number;
  protein: number;
}

/** Protein per local date from raw food entries; entries without macros add 0. */
export function proteinByDay(entries: readonly (FoodEntry & { date: string })[]): Map<string, ProteinDay> {
  const tenths = new Map<string, { logged: number; p: number }>();
  for (const e of entries) {
    if (e.photo?.status === "pending") continue;
    const d = tenths.get(e.date) ?? { logged: 0, p: 0 };
    d.logged += 1;
    d.p += e.macros ? Math.round(e.macros.protein * 10) : 0;
    tenths.set(e.date, d);
  }
  return new Map([...tenths].map(([date, d]) => [date, { logged: d.logged, protein: d.p / 10 }]));
}

/** A hit needs at least one counted entry and protein at or above the member's own target. */
export const isProteinHit = (day: ProteinDay | undefined, target: number) => day !== undefined && day.logged >= 1 && day.protein >= target;

export function hitDays(byDay: ReadonlyMap<string, ProteinDay>, dates: readonly string[], target: number): { hit: number; logged: number } {
  let hit = 0;
  let logged = 0;
  for (const d of dates) {
    const day = byDay.get(d);
    if (day && day.logged >= 1) logged++;
    if (isProteinHit(day, target)) hit++;
  }
  return { hit, logged };
}

/** True when the 7 days ending at `endDate` were all protein-target hits (research R9). */
export function isProteinRun(byDay: ReadonlyMap<string, ProteinDay>, endDate: string, target: number): boolean {
  for (let i = 0; i < PROTEIN_STREAK_DAYS; i++) if (!isProteinHit(byDay.get(addDays(endDate, -i)), target)) return false;
  return true;
}

export interface NutritionRankRow {
  userId: string;
  name: string;
  hit: number;
  logged: number;
}

/**
 * The Nutrition board ranks on hit days only (competition ranking, ties share a rank). Calories in or burned are
 * deliberately not inputs, so they cannot influence the order.
 */
export function rankNutrition<T extends NutritionRankRow>(rows: readonly T[]): (T & { rank: number })[] {
  return rankRows(rows, (r) => [r.hit], (r) => r.name);
}
