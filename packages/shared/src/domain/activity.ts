import { addDays, DateSchema } from "./day";
import { rankRows } from "./squad";

/**
 * Feature 012: daily activity (steps) synced from Apple Health. Pure parsing, validation and ranking, shared by the
 * Shortcut endpoint, the MCP tools and the squad views. See specs/012-health-activity-sync/research.md R5–R10.
 */

export const ACTIVITY_SOURCES = ["mcp", "shortcut", "health_auto_export", "manual"] as const;
export type ActivitySource = (typeof ACTIVITY_SOURCES)[number];

export const STEP_GOAL_DEFAULT = 8000;
export const STEP_GOAL_MIN = 1000;
export const STEP_GOAL_MAX = 50_000;
export const STEPS_MAX = 100_000;
export const ACTIVE_KCAL_MAX = 5000;
export const DISTANCE_KM_MAX = 150;
export const ACTIVITY_MAX_DAYS = 31;
/** A day may be saved up to this many days before the member's today. */
export const ACTIVITY_BACK_DAYS = 30;
export const STEP_STREAK_DAYS = 7;
export const STEPS_CHART_DAYS = 30;

/** One saved day. `null` means unknown (not sent), never zero. */
export interface ActivityValues {
  date: string;
  steps: number;
  activeKcal: number | null;
  distanceKm: number | null;
}

export interface ActivityProblem {
  /** The day's date when it is a real date, else a "Day n" label. */
  label: string;
  field: string;
  message: string;
}

/** A finite number from a number or from text like "8,423.0"; null for anything else. */
export function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[,\s_]/g, "");
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Case-insensitive lookup accepting snake_case and camelCase spellings. */
function pick(obj: Record<string, unknown>, ...names: string[]): unknown {
  const wanted = new Set(names.map((n) => n.toLowerCase().replace(/_/g, "")));
  for (const [k, v] of Object.entries(obj)) if (wanted.has(k.toLowerCase().replace(/_/g, ""))) return v;
  return undefined;
}

export type Extracted =
  | { ok: true; source: "shortcut" | "health_auto_export"; days: unknown[] }
  | { ok: false; message: string };

const ENERGY_TO_KCAL: Record<string, number> = { kcal: 1, cal: 1, kj: 1 / 4.184 };
const DISTANCE_TO_KM: Record<string, number> = { km: 1, mi: 1.609344, m: 0.001 };

/**
 * The raw day objects of a sync request body: `{ days: [...] }`, `{ days: {...} }`, a single day object, a bare array,
 * or the Health Auto Export app's `{ data: { metrics: [...] } }` (detected by shape). A client can never claim the
 * `mcp` source; anything but Health Auto Export is a Shortcut.
 */
export function extractActivityDays(body: unknown): Extracted {
  if (isRecord(body) && isRecord(body.data) && Array.isArray(body.data.metrics)) return fromHealthAutoExport(body.data.metrics);
  if (Array.isArray(body)) return { ok: true, source: "shortcut", days: body };
  if (!isRecord(body)) return { ok: false, message: "Send a JSON object with a days list" };
  const days = body.days;
  if (Array.isArray(days)) return { ok: true, source: "shortcut", days };
  if (isRecord(days)) return { ok: true, source: "shortcut", days: [days] };
  if (days === undefined && pick(body, "date") !== undefined) return { ok: true, source: "shortcut", days: [body] };
  return { ok: false, message: "Send a JSON object with a days list" };
}

/**
 * Health Auto Export: sum each metric's samples per local day (the first 10 characters of the sample date, which is
 * the phone's own local date). Days with no step samples are skipped: energy or distance alone is not a day's total.
 */
function fromHealthAutoExport(metrics: unknown[]): Extracted {
  const days = new Map<string, { steps?: number; active_kcal?: number; distance_km?: number }>();
  const add = (date: string, key: "steps" | "active_kcal" | "distance_km", qty: number) => {
    const d = days.get(date) ?? {};
    d[key] = (d[key] ?? 0) + qty;
    days.set(date, d);
  };
  for (const m of metrics) {
    if (!isRecord(m) || !Array.isArray(m.data)) continue;
    const units = typeof m.units === "string" ? m.units.toLowerCase() : "";
    let key: "steps" | "active_kcal" | "distance_km";
    let factor = 1;
    if (m.name === "step_count") key = "steps";
    else if (m.name === "active_energy") {
      key = "active_kcal";
      const f = ENERGY_TO_KCAL[units];
      if (f === undefined) return { ok: false, message: `active_energy units "${String(m.units)}" are not supported; use kcal or kJ` };
      factor = f;
    } else if (m.name === "walking_running_distance") {
      key = "distance_km";
      const f = DISTANCE_TO_KM[units];
      if (f === undefined) return { ok: false, message: `walking_running_distance units "${String(m.units)}" are not supported; use km, mi or m` };
      factor = f;
    } else continue;
    for (const s of m.data) {
      if (!isRecord(s) || typeof s.date !== "string") continue;
      const qty = toNumber(s.qty);
      if (qty === null) continue;
      add(s.date.slice(0, 10), key, qty * factor);
    }
  }
  const out = [...days.entries()].filter(([, d]) => d.steps !== undefined).map(([date, d]) => ({ date, ...d }));
  if (!out.length) return { ok: false, message: "No step_count data found in the Health Auto Export payload" };
  return { ok: true, source: "health_auto_export", days: out };
}

export type ParsedDays = { ok: true; days: ActivityValues[] } | { ok: false; problems: ActivityProblem[] };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "18 Nov" */
export const shortDate = (date: string) => `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;

const fmt = (n: number) => n.toLocaleString("en-US");

function numberField(raw: Record<string, unknown>, names: string[], field: string, max: number, required: boolean, round: (n: number) => number) {
  const value = pick(raw, ...names);
  if (value === undefined || value === null || value === "") {
    return required ? { problem: `${field} is missing` } : { value: null };
  }
  const n = toNumber(value);
  if (n === null) return { problem: `${field} must be a number` };
  const r = round(n);
  if (r < 0 || r > max) return { problem: `${field} must be between 0 and ${fmt(max)}` };
  return { value: r };
}

/**
 * Validate and normalise raw days against the member's local `today` (constitution V): numbers may be text and are
 * rounded (steps and kcal to whole numbers, distance to 2 dp); the date must be real, not after today and not more
 * than 30 days before it. Any problem refuses the whole request. When a date repeats, the last one wins.
 */
export function parseActivityDays(raw: readonly unknown[], today: string): ParsedDays {
  const problems: ActivityProblem[] = [];
  if (raw.length === 0) return { ok: false, problems: [{ label: "Request", field: "days", message: "send at least one day" }] };
  if (raw.length > ACTIVITY_MAX_DAYS) {
    return { ok: false, problems: [{ label: "Request", field: "days", message: `send at most ${ACTIVITY_MAX_DAYS} days at a time` }] };
  }
  const byDate = new Map<string, ActivityValues>();
  raw.forEach((item, i) => {
    const fallback = `Day ${i + 1}`;
    if (!isRecord(item)) {
      problems.push({ label: fallback, field: "day", message: "must be an object with date and steps" });
      return;
    }
    const rawDate = pick(item, "date");
    const date = typeof rawDate === "string" ? rawDate.trim().slice(0, 10) : "";
    const real = DateSchema.safeParse(date).success;
    const label = real ? shortDate(date) : fallback;
    const before = problems.length;
    if (!real) problems.push({ label, field: "date", message: "date must be YYYY-MM-DD" });
    else if (date > today) problems.push({ label, field: "date", message: "date is in the future" });
    else if (date < addDays(today, -ACTIVITY_BACK_DAYS)) problems.push({ label, field: "date", message: `date is more than ${ACTIVITY_BACK_DAYS} days ago` });

    const steps = numberField(item, ["steps", "step_count"], "steps", STEPS_MAX, true, Math.round);
    const kcal = numberField(item, ["active_kcal", "activeKcal", "active_energy"], "active_kcal", ACTIVE_KCAL_MAX, false, Math.round);
    const dist = numberField(item, ["distance_km", "distanceKm", "distance"], "distance_km", DISTANCE_KM_MAX, false, (n) => Math.round(n * 100) / 100);
    for (const [field, r] of [["steps", steps], ["active_kcal", kcal], ["distance_km", dist]] as const) {
      if ("problem" in r && r.problem) problems.push({ label, field, message: r.problem });
    }
    if (problems.length === before && "value" in steps && "value" in kcal && "value" in dist) {
      byDate.set(date, { date, steps: steps.value!, activeKcal: kcal.value ?? null, distanceKm: dist.value ?? null });
    }
  });
  if (problems.length) return { ok: false, problems };
  return { ok: true, days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

/** One readable line for a Shortcut or an agent: "18 Nov: steps must be between 0 and 100,000; …". */
export const formatProblems = (problems: readonly ActivityProblem[]) => problems.map((p) => `${p.label}: ${p.message}`).join("; ");

export const isStepGoalHit = (steps: number, goal: number) => steps >= goal;

/** A member's Steps board figures over `dates` (the elapsed period), or null when no day in it was synced. */
export function stepsBoardRow(byDay: ReadonlyMap<string, number>, dates: readonly string[], goal: number) {
  const synced = dates.flatMap((d) => (byDay.has(d) ? [byDay.get(d)!] : []));
  if (!synced.length) return null;
  return {
    avgSteps: Math.round(synced.reduce((t, s) => t + s, 0) / synced.length),
    hitDays: synced.filter((s) => isStepGoalHit(s, goal)).length,
    periodDays: dates.length,
    syncedDays: synced.length,
  };
}

/** Highest average first; ties share a rank, then by name. Never ranks by calories (constitution VI). */
export function rankSteps<T extends { name: string; avgSteps: number }>(rows: readonly T[]): (T & { rank: number })[] {
  return rankRows(rows, (r) => [r.avgSteps], (r) => r.name);
}

/** The 7 days ending on `endDate` were all synced and at or above the goal. */
export function isStepRun(byDay: ReadonlyMap<string, number>, endDate: string, goal: number): boolean {
  for (let i = 0; i < STEP_STREAK_DAYS; i++) {
    const s = byDay.get(addDays(endDate, -i));
    if (s === undefined || !isStepGoalHit(s, goal)) return false;
  }
  return true;
}
