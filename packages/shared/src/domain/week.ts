import { addDays } from "./day";

/**
 * Weeks run Monday to Sunday. Entry dates are already the member's local calendar dates (constitution V),
 * so week math is plain date math with no clock or timezone in it (feature 010, research R3).
 */
export function weekStart(date: string): string {
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)));
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  return addDays(date, -sinceMonday);
}

/** True once the Sunday of the week starting `start` is in the past. */
export function isWeekEnded(start: string, today: string): boolean {
  return addDays(start, 6) < today;
}
