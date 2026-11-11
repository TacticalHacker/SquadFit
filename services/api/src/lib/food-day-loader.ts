import { buildFoodDay, summarize, type FoodDayView } from "@calci/shared";
import type { DayContext } from "./day-context";
import type { Deps } from "./deps";

/** One day's food view: entries, that day's workout calories (burned) and the target (research R5). */
export async function loadFoodDay(userId: string, ctx: DayContext, date: string, deps: Deps): Promise<FoodDayView> {
  const [entries, workoutEntries] = await Promise.all([
    deps.food.listEntriesForDay(userId, date),
    deps.workouts.listEntriesForDay(userId, date),
  ]);
  return buildFoodDay({
    date,
    today: ctx.today,
    timezone: ctx.timezone,
    target: ctx.target,
    burnedCalories: summarize(workoutEntries).totalCalories,
    entries,
  });
}
