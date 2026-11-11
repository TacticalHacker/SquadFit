import { z } from "zod";

/** Entries can be added/changed/removed for today and the two days before it (FR-017). */
export const EDIT_WINDOW_DAYS = 2;

function isRealDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  return d.toISOString().slice(0, 10) === s;
}

export const DateSchema = z.string().refine(isRealDate, "Date must be a real calendar date as YYYY-MM-DD");

/** The calendar date at `instant` in `timeZone`. Never UTC unless the zone is UTC (constitution V). */
export function localDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    instant,
  );
}

const toUtc = (date: string) => Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));

export function addDays(date: string, n: number): string {
  return new Date(toUtc(date) + n * 86_400_000).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function isEditableDay(date: string, today: string): boolean {
  return date <= today && date >= addDays(today, -EDIT_WINDOW_DAYS);
}
