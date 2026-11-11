import { caloriesFor, summarize, type Summary } from "./calories";
import { isEditableDay } from "./day";
import { STANDARD_WORKOUTS } from "./workouts";

export interface StoredCustomWorkout {
  workoutId: string;
  name: string;
  defaultMinutes: number;
  defaultCalories: number;
}

/** A stored entry with its snapshot of the workout rate (FR-010). */
export interface StoredEntry {
  workoutId: string;
  name: string;
  rateMinutes: number;
  rateCalories: number;
  minutes: number;
  calories: number;
}

/** A logged entry as shown on a row, with the rate snapshot it was logged with (FR-010). */
export interface DayEntry {
  minutes: number;
  calories: number;
  rateMinutes: number;
  rateCalories: number;
}

export interface DayRow {
  workoutId: string;
  name: string;
  isStandard: boolean;
  removed: boolean;
  defaultMinutes: number;
  defaultCalories: number;
  entry: DayEntry | null;
}

export interface DayView {
  date: string;
  today: string;
  timezone: string;
  editable: boolean;
  rows: DayRow[];
  summary: Summary;
}

export type DayChange =
  | { type: "tick"; workoutId: string }
  | { type: "untick"; workoutId: string }
  | { type: "setMinutes"; workoutId: string; minutes: number };

function withSummary(view: Omit<DayView, "summary">): DayView {
  const entries = view.rows.flatMap((r) => (r.entry ? [r.entry] : []));
  return { ...view, summary: summarize(entries) };
}

export function buildDayView(input: {
  date: string;
  today: string;
  timezone: string;
  customWorkouts: readonly StoredCustomWorkout[];
  entries: readonly StoredEntry[];
}): DayView {
  const byId = new Map(input.entries.map((e) => [e.workoutId, e]));
  const toEntry = (id: string) => {
    const e = byId.get(id);
    return e
      ? { minutes: e.minutes, calories: e.calories, rateMinutes: e.rateMinutes, rateCalories: e.rateCalories }
      : null;
  };
  const rows: DayRow[] = STANDARD_WORKOUTS.map((w) => ({
    workoutId: w.id,
    name: w.name,
    isStandard: true,
    removed: false,
    defaultMinutes: w.defaultMinutes,
    defaultCalories: w.defaultCalories,
    entry: toEntry(w.id),
  }));
  const customSorted = [...input.customWorkouts].sort((a, b) => a.name.localeCompare(b.name, "en"));
  for (const c of customSorted) {
    rows.push({
      workoutId: c.workoutId,
      name: c.name,
      isStandard: false,
      removed: false,
      defaultMinutes: c.defaultMinutes,
      defaultCalories: c.defaultCalories,
      entry: toEntry(c.workoutId),
    });
  }
  const shown = new Set(rows.map((r) => r.workoutId));
  for (const e of input.entries) {
    if (shown.has(e.workoutId)) continue;
    rows.push({
      workoutId: e.workoutId,
      name: e.name,
      isStandard: false,
      removed: true,
      defaultMinutes: e.rateMinutes,
      defaultCalories: e.rateCalories,
      entry: { minutes: e.minutes, calories: e.calories, rateMinutes: e.rateMinutes, rateCalories: e.rateCalories },
    });
  }
  return withSummary({
    date: input.date,
    today: input.today,
    timezone: input.timezone,
    editable: isEditableDay(input.date, input.today),
    rows,
  });
}

/** Pure change used by the optimistic client; calories on a minutes change come from the entry's own rate. */
export function applyChange(view: DayView, change: DayChange): DayView {
  const rows = view.rows.map((row): DayRow => {
    if (row.workoutId !== change.workoutId) return row;
    if (change.type === "untick") return { ...row, entry: null };
    if (change.type === "tick") {
      if (row.entry || row.removed) return row;
      return {
        ...row,
        entry: {
          minutes: row.defaultMinutes,
          calories: row.defaultCalories,
          rateMinutes: row.defaultMinutes,
          rateCalories: row.defaultCalories,
        },
      };
    }
    const rm = row.entry?.rateMinutes ?? row.defaultMinutes;
    const rc = row.entry?.rateCalories ?? row.defaultCalories;
    return {
      ...row,
      entry: { minutes: change.minutes, calories: caloriesFor(rm, rc, change.minutes), rateMinutes: rm, rateCalories: rc },
    };
  });
  return withSummary({ ...view, rows });
}
