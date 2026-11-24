import { addDays } from "./day";
import { weekStart } from "./week";

/** Feature 014: body weight log. Ids sort by save time; keys are `WEIGHT#<date>#<id>` (data-model.md). */
export const WEIGHT_ID_PATTERN = /^\d{8}T\d{9}Z-[0-9a-z]{6}$/;
export const WEIGHT_MAX_PER_DAY = 10;
export const WEIGHT_STEP_KG = 0.1;
export const WEIGHT_TREND_DAYS = 7;

/** `yyyyMMddTHHmmssSSSZ-xxxxxx` from the save instant (UTC) plus a random suffix. */
export function newWeightEntryId(now: Date): string {
  const stamp = now.toISOString().replace(/[-:.]/g, "").slice(0, 18) + "Z";
  const rand = Array.from({ length: 6 }, () => "0123456789abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 36)]).join("");
  return `${stamp}-${rand}`;
}

export type WeightRange = "W" | "M" | "6M" | "Y";
export const WEIGHT_RANGES: readonly WeightRange[] = ["W", "M", "6M", "Y"];

export interface WeightEntryLike {
  id: string;
  date: string;
  recordedAt: string;
  weightKg: number;
}

export interface WeightSlot {
  start: string;
  end: string;
  count: number;
  min: number | null;
  max: number | null;
  average: number | null;
  /** 7-day moving average of day averages (W and M only). */
  trend: number | null;
}

export interface WeightView {
  range: WeightRange;
  start: string;
  end: string;
  summary: { average: number; min: number; max: number } | null;
  slots: WeightSlot[];
  latest: { date: string; weightKg: number; recordedAt: string } | null;
  profileWeightKg: number | null;
  editableDays: { date: string; entries: WeightEntryLike[] }[];
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const monthStart = (date: string, back: number) => {
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1 - back, 1));
  return d.toISOString().slice(0, 10);
};
const monthEnd = (start: string) => addDays(monthStart(start, -1), -1);

/** The window for a range ending today (member's local date) and its slots, oldest first. */
export function rangeWindow(range: WeightRange, today: string): { start: string; end: string; fetchFrom: string; slots: { start: string; end: string }[] } {
  let slots: { start: string; end: string }[];
  if (range === "W" || range === "M") {
    const days = range === "W" ? 7 : 30;
    slots = Array.from({ length: days }, (_, i) => {
      const d = addDays(today, i - days + 1);
      return { start: d, end: d };
    });
  } else if (range === "6M") {
    const last = weekStart(today);
    slots = Array.from({ length: 26 }, (_, i) => {
      const s = addDays(last, (i - 25) * 7);
      return { start: s, end: addDays(s, 6) };
    });
  } else {
    slots = Array.from({ length: 12 }, (_, i) => {
      const s = monthStart(today, 11 - i);
      return { start: s, end: monthEnd(s) };
    });
  }
  slots[slots.length - 1]!.end = today;
  const start = slots[0]!.start;
  const daily = range === "W" || range === "M";
  return { start, end: today, fetchFrom: daily ? addDays(start, -(WEIGHT_TREND_DAYS - 1)) : start, slots };
}

/** Latest by local date, then save time, then id: never insertion order (clarification 2). */
export function latestEntry<T extends WeightEntryLike>(entries: readonly T[]): T | null {
  let best: T | null = null;
  for (const x of entries) {
    if (!best || x.date > best.date || (x.date === best.date && (x.recordedAt > best.recordedAt || (x.recordedAt === best.recordedAt && x.id > best.id)))) best = x;
  }
  return best;
}

/**
 * Builds the whole chart view (research R3). Day average = mean of that day's entries; a slot's average = mean of its
 * day averages; min/max over raw entries. `entries` may include the 6-day lead-in before a W/M window.
 */
export function buildWeightView(input: {
  range: WeightRange;
  today: string;
  entries: readonly WeightEntryLike[];
  latest: WeightEntryLike | null;
  profileWeightKg: number | null;
}): WeightView {
  const win = rangeWindow(input.range, input.today);
  const byDay = new Map<string, number[]>();
  for (const x of input.entries) {
    if (x.date < win.fetchFrom || x.date > input.today) continue;
    byDay.set(x.date, [...(byDay.get(x.date) ?? []), x.weightKg]);
  }
  const dayAvg = new Map([...byDay].map(([d, ws]) => [d, mean(ws)] as const));
  const daily = input.range === "W" || input.range === "M";

  const slots: WeightSlot[] = win.slots.map(({ start, end }) => {
    const raw: number[] = [];
    const avgs: number[] = [];
    for (const [d, ws] of byDay) {
      if (d < start || d > end) continue;
      raw.push(...ws);
      avgs.push(dayAvg.get(d)!);
    }
    let trend: number | null = null;
    if (daily) {
      const look = [...dayAvg].filter(([d]) => d >= addDays(start, -(WEIGHT_TREND_DAYS - 1)) && d <= start).map(([, a]) => a);
      trend = look.length ? round1(mean(look)) : null;
    }
    return raw.length
      ? { start, end, count: raw.length, min: round1(Math.min(...raw)), max: round1(Math.max(...raw)), average: round1(mean(avgs)), trend }
      : { start, end, count: 0, min: null, max: null, average: null, trend };
  });

  const inWin = [...byDay].filter(([d]) => d >= win.start);
  const all = inWin.flatMap(([, ws]) => ws);
  const summary = all.length
    ? { average: round1(mean(inWin.map(([d]) => dayAvg.get(d)!))), min: round1(Math.min(...all)), max: round1(Math.max(...all)) }
    : null;

  const editableDays = [0, 1, 2].map((i) => {
    const date = addDays(input.today, -i);
    const entries = input.entries
      .filter((x) => x.date === date)
      .sort((a, b) => (a.recordedAt === b.recordedAt ? b.id.localeCompare(a.id) : b.recordedAt.localeCompare(a.recordedAt)));
    return { date, entries: entries.map(({ id, date: d, recordedAt, weightKg }) => ({ id, date: d, recordedAt, weightKg })) };
  });

  const l = input.latest;
  return {
    range: input.range,
    start: win.start,
    end: win.end,
    summary,
    slots,
    latest: l ? { date: l.date, weightKg: l.weightKg, recordedAt: l.recordedAt } : null,
    profileWeightKg: input.profileWeightKg,
    editableDays,
  };
}

const AXIS_STEPS = [0.5, 1, 2, 5, 10, 20, 50];

/** Scale [floor(min − 1), ceil(max + 1)] with 3–4 gridlines from the whole-kg bottom (analysis C1). */
export function weightAxis(min: number, max: number): { lo: number; hi: number; step: number; ticks: number[] } {
  const lo = Math.floor(min - 1);
  const top = Math.ceil(max + 1);
  for (const step of AXIS_STEPS) {
    const intervals = Math.ceil((top - lo) / step - 1e-9);
    if (intervals <= 3) {
      const ticks = Array.from({ length: intervals + 1 }, (_, i) => round1(lo + i * step));
      return { lo, hi: ticks[ticks.length - 1]!, step, ticks };
    }
  }
  const step = AXIS_STEPS[AXIS_STEPS.length - 1]!;
  const intervals = Math.ceil((top - lo) / step);
  return { lo, hi: lo + intervals * step, step, ticks: Array.from({ length: intervals + 1 }, (_, i) => lo + i * step) };
}

/** Index of the slot with data nearest to `pos` (slot-index space), or -1 when none has data. */
export function nearestSlot(slots: readonly { count: number }[], pos: number): number {
  let best = -1;
  let dist = Infinity;
  slots.forEach((s, i) => {
    if (s.count > 0 && Math.abs(i - pos) < dist) {
      dist = Math.abs(i - pos);
      best = i;
    }
  });
  return best;
}

/** One ±0.1 kg stepper press, kept within the body weight limits (20–400). */
export function stepWeightKg(value: number, dir: 1 | -1): number {
  return Math.min(400, Math.max(20, round1(value + dir * WEIGHT_STEP_KG)));
}
