import { localDate } from "@calci/shared";

/** True once the user's local date is no longer the day the screen was loaded for (FR-018). */
export function hasDayChanged(now: Date, timeZone: string, today: string): boolean {
  return localDate(now, timeZone) !== today;
}
