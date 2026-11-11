import { buildDayView, type DayView } from "@calci/shared";
import type { DayContext } from "./day-context";
import type { Deps } from "./deps";

/** One day's view for a user: standard + custom workouts and that day's entries. */
export async function loadDayView(userId: string, ctx: DayContext, date: string, deps: Deps): Promise<DayView> {
  const [customWorkouts, entries] = await Promise.all([
    deps.workouts.listCustomWorkouts(userId),
    deps.workouts.listEntriesForDay(userId, date),
  ]);
  return buildDayView({ date, today: ctx.today, timezone: ctx.timezone, customWorkouts, entries });
}
