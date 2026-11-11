import { addDays, DateSchema, daysBetween } from "./day";

export const NOTE_WINDOW_DAYS = 30;
export const HISTORY_MAX_DAYS = 31;
export const NOTE_SUMMARY_MAX = 4000;
export const NOTE_MAX_RECOMMENDATIONS = 10;
export const NOTE_RECOMMENDATION_MAX = 280;

const BAD_DATE = "Use a real date as YYYY-MM-DD";

/** Error message, or null when `date` may hold a coach note (today or up to 30 days before). */
export function validateNoteDate(date: string, today: string): string | null {
  if (!DateSchema.safeParse(date).success) return BAD_DATE;
  if (date > today) return "Date cannot be in the future";
  if (date < addDays(today, -NOTE_WINDOW_DAYS)) return `Date cannot be more than ${NOTE_WINDOW_DAYS} days ago`;
  return null;
}

/** Error message, or null when the window is valid: start ≤ end ≤ today, at most 31 days inclusive. */
export function validateHistoryWindow(start: string, end: string, today: string): string | null {
  if (!DateSchema.safeParse(start).success || !DateSchema.safeParse(end).success) return BAD_DATE;
  if (end > today) return "endDate cannot be in the future";
  if (start > end) return "endDate cannot be before startDate";
  if (daysBetween(start, end) + 1 > HISTORY_MAX_DAYS) return `The window can span at most ${HISTORY_MAX_DAYS} days`;
  return null;
}
