import { buildFoodDay, summarize, type FoodDayView } from "@calci/shared";
import type { DayContext } from "./day-context";
import type { Deps } from "./deps";

/** One day's food view: entries, that day's workout calories (burned) and the target (research R5). */
export async function loadFoodDay(userId: string, ctx: DayContext, date: string, deps: Deps): Promise<FoodDayView> {
  const [entries, workoutEntries] = await Promise.all([
    deps.food.listEntriesForDay(userId, date),
    deps.workouts.listEntriesForDay(userId, date),
  ]);
  // Photo entries get a short-lived link to their picture (feature 005).
  const withUrls = await Promise.all(
    entries.map(async (e) =>
      e.photo && e.photoKey ? { ...e, photo: { ...e.photo, url: await deps.photos.urlFor(e.photoKey) } } : e,
    ),
  );
  return buildFoodDay({
    date,
    today: ctx.today,
    timezone: ctx.timezone,
    target: ctx.target,
    proteinTarget: ctx.proteinTarget,
    burnedCalories: summarize(workoutEntries).totalCalories,
    entries: withUrls,
  });
}
