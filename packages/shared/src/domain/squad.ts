import { addDays } from "./day";
import { GYM_LAST_KEEP } from "./gym";
import { addToBests, comparePr, classifySet, e1rm, EMPTY_BESTS, isSuspicious, type PrBase, type PrBests, type PrHit, type PrType } from "./pr";
import { isWeekEnded, weekStart } from "./week";

/** Feature 010 (squad leaderboard). Pure rules; see specs/010-squad-leaderboard/data-model.md. */

export const SQUAD_ID = "global";
export const DEFAULT_WEEKLY_TARGET = 3;
export const SQUAD_MIN_TARGET = 1;
export const SQUAD_MAX_TARGET = 7;
// The jump thresholds (JUMP_RATIO, JUMP_MIN_KG) and e1rm moved to ./pr (feature 019).
const DAY_BEST_DAYS = 31;

export const DEFAULT_LIFT_IDS = ["gx-bench-press", "gx-barbell-squat", "gx-deadlift", "gx-overhead-press"] as const;
/** Feature 013: the lifts of the estimated Big 3 total (club badges, Current strength). */
export const BIG3_LIFT_IDS = ["gx-bench-press", "gx-barbell-squat", "gx-deadlift"] as const;
export const CLUBS = [
  { id: "club225", kg: 225 },
  { id: "club300", kg: 300 },
  { id: "club400", kg: 400 },
  { id: "club450", kg: 450 },
  { id: "club500", kg: 500 },
] as const;
export type ClubId = (typeof CLUBS)[number]["id"];

// ---------------------------------------------------------------- types

/** The slice of a stored entry the squad rules read. `date` is the member's local calendar date. */
export interface SquadEntry {
  date: string;
  workoutId: string;
  name: string;
  kind?: "gym";
  exerciseKind?: "strength" | "cardio";
  sets?: readonly { reps: number; weightKg: number; completed: boolean }[];
  jumpConfirmedAt?: string;
  updatedAt?: string;
}

export interface LiftSet {
  weightKg: number;
  reps: number;
  e1rm: number | null;
  date: string;
}
export interface PrDay {
  date: string;
  weightKg: number;
  reps: number;
  e1rm: number | null;
  /** Feature 013: gain over the previous best (estimate for an estimate PR, else weight). Absent on old stats and Rep PRs. */
  gainKg?: number;
  /** Feature 019: the top record's type and rep gain, and every PR set of the day (top first). Absent on old stats. */
  type?: PrType;
  gainReps?: number | null;
  records?: PrRecord[];
}
/** Feature 019: one PR set (the spec's "personal record"). */
export interface PrRecord {
  type: PrType;
  value: number;
  previous: number;
  weightKg: number;
  reps: number;
  setIndex: number;
  achievedAt: string;
}
export interface LiftStats {
  name: string;
  builtIn: boolean;
  best: LiftSet | null;
  bestE1rm: (LiftSet & { e1rm: number }) | null;
  prDays: PrDay[];
  dayBests: Record<string, { weightKg: number; reps: number; e1rm: number }>;
  /** Feature 013: best eligible estimate per "YYYY-MM" (month of the entry's local date). */
  monthBests: Record<string, { e1rm: number; date: string }>;
  /** Feature 016: dates whose top set beat the previous session ("Lifts improved" for one day). Absent on old stats. */
  improvedDays?: string[];
  /** Feature 019: bests before each of the latest entry dates (the drawer's live PR check). Absent on old stats. */
  prBase?: PrBase;
}
export interface MonthRecord {
  workoutDays: number;
  /** Strength sessions that beat the previous session of the same exercise (feature 013, "Lifts improved"). */
  liftsImproved: number;
}
export interface WeekRecord {
  days: number;
  target: number;
}
export interface SquadStats {
  squadId: string;
  version: number;
  builtAt: string;
  trustedBefore?: string;
  seededEventIds: string[];
  firstWorkoutDate: string | null;
  weeks: Record<string, WeekRecord>;
  /** Feature 013: per "YYYY-MM", all history. */
  months: Record<string, MonthRecord>;
  lifts: Record<string, LiftStats>;
  flags: { date: string; exerciseId: string }[];
  /** Feature 013: club id → the first date the best-so-far estimated Big 3 met it. */
  badges: Partial<Record<ClubId, string>>;
  /** Feature 019: set once stats carry `prBase` and Rep PRs. */
  prRules?: 1;
}

export type SquadEventKind = "pr" | "streak_week" | "first_workout" | "workout_day" | "protein_streak" | "step_streak" | "badge";
export interface SquadEvent {
  id: string;
  kind: SquadEventKind;
  date: string;
  payload: Record<string, unknown>;
}

export interface BuildOptions {
  weeklyTarget: number;
  today: string;
  nowIso: string;
  trustedBefore?: string;
}

// ---------------------------------------------------------------- lift math

const round1 = (n: number) => Math.round(n * 10) / 10;


export const isWorkingSet = (s: { reps: number; weightKg: number; completed: boolean }) => s.completed && s.reps >= 1 && s.weightKg > 0;

const isGymStrength = (e: SquadEntry) => e.kind === "gym" && e.exerciseKind !== "cardio";

/** FR-007: a workout day has gym strength with a completed set, gym cardio, or any activity entry. */
export function isWorkoutEntry(e: SquadEntry): boolean {
  if (e.kind !== "gym") return true;
  if (e.exerciseKind === "cardio") return true;
  return (e.sets ?? []).some((s) => s.completed);
}

const suspicious = isSuspicious;

interface SetView {
  weightKg: number;
  reps: number;
  e1rm: number | null;
  setIndex: number;
}

/** More weight at the same or more reps, or more reps at the same weight (top set against top set). */
const beats = (now: SetView, prev: SetView) => (now.weightKg > prev.weightKg && now.reps >= prev.reps) || (now.weightKg === prev.weightKg && now.reps > prev.reps);

/** Walk one exercise's days in date order, producing PRs, bests and flags. */
function walkLift(entries: readonly SquadEntry[], trustedBefore: string | undefined, today: string) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let best = null as LiftSet | null;
  let bestE = null as (LiftSet & { e1rm: number }) | null;
  const prDays: PrDay[] = [];
  const dayBests: LiftStats["dayBests"] = {};
  const monthBests: LiftStats["monthBests"] = {};
  /** Each date the best estimate rose (badges). */
  const bestSteps: { date: string; e1rm: number }[] = [];
  /** Dates whose top set beat the previous session's top set ("Lifts improved"). */
  const improved: string[] = [];
  let prevTop: SetView | null = null;
  const flagged: string[] = [];
  /** Feature 021: set indexes held per date (the raid skips exactly these). */
  const held: Record<string, number[]> = {};
  const windowStart = addDays(today, -(DAY_BEST_DAYS - 1));
  /** Feature 019: the one PR definition's running bests, and a snapshot before each entry date. */
  let bests: PrBests = EMPTY_BESTS;
  const snapshots: [string, PrBests][] = [];

  for (const entry of sorted) {
    snapshots.push([entry.date, bests]);
    const working: SetView[] = (entry.sets ?? []).flatMap((s, setIndex) =>
      isWorkingSet(s) ? [{ weightKg: s.weightKg, reps: s.reps, e1rm: e1rm(s.weightKg, s.reps), setIndex }] : [],
    );
    if (working.length === 0) continue;

    const trusted =
      Boolean(entry.jumpConfirmedAt) || (trustedBefore !== undefined && entry.updatedAt !== undefined && entry.updatedAt < trustedBefore);
    const prevW: number | null = best?.weightKg ?? null;
    const prevE: number | null = bestE?.e1rm ?? null;
    const eligible: SetView[] = trusted ? working : working.filter((s) => !(suspicious(s.weightKg, prevW) || suspicious(s.e1rm, prevE)));
    if (eligible.length < working.length) {
      flagged.push(entry.date);
      held[entry.date] = working.filter((s) => !eligible.includes(s)).map((s) => s.setIndex);
    }
    if (eligible.length === 0) continue;

    const heaviest: SetView = eligible.reduce((a: SetView, b: SetView) => (b.weightKg > a.weightKg || (b.weightKg === a.weightKg && b.reps > a.reps) ? b : a));
    if (prevTop !== null && beats(heaviest, prevTop)) improved.push(entry.date);
    prevTop = heaviest;
    const withE: SetView[] = eligible.filter((s) => s.e1rm !== null);
    const topE: SetView | null = withE.length ? withE.reduce((a: SetView, b: SetView) => (b.e1rm! > a.e1rm! ? b : a)) : null;

    const hits = eligible.flatMap((s) => {
      const h = classifySet(bests, s, s.setIndex);
      return h ? [h] : [];
    });
    if (hits.length) prDays.push(prDayOf(entry, hits.sort(comparePr)));
    bests = addToBests(bests, eligible, entry.date);
    if (best === null || heaviest.weightKg > best.weightKg) best = { ...heaviest, date: entry.date };
    if (topE && (bestE === null || topE.e1rm! > bestE.e1rm)) {
      bestE = { weightKg: topE.weightKg, reps: topE.reps, e1rm: topE.e1rm!, date: entry.date };
      bestSteps.push({ date: entry.date, e1rm: topE.e1rm! });
    }
    if (topE && entry.date >= windowStart) dayBests[entry.date] = { weightKg: topE.weightKg, reps: topE.reps, e1rm: topE.e1rm! };
    const ym = entry.date.slice(0, 7);
    if (topE && (!monthBests[ym] || topE.e1rm! > monthBests[ym]!.e1rm)) monthBests[ym] = { e1rm: topE.e1rm!, date: entry.date };
  }
  const kept = snapshots.slice(-GYM_LAST_KEEP);
  const prBase: PrBase = { all: bests, before: Object.fromEntries(kept), complete: kept.length === snapshots.length };
  return { best, bestE, prDays, dayBests, monthBests, bestSteps, improved, flagged, held, prBase };
}

function prDayOf(entry: SquadEntry, hits: readonly PrHit[]): PrDay {
  const top = hits[0]!;
  return {
    date: entry.date,
    weightKg: top.weightKg,
    reps: top.reps,
    e1rm: e1rm(top.weightKg, top.reps),
    ...(top.type === "reps" ? {} : { gainKg: top.gain }),
    type: top.type,
    gainReps: top.type === "reps" ? top.gain : null,
    records: hits.map((h) => ({
      type: h.type,
      value: h.value,
      previous: h.previous,
      weightKg: h.weightKg,
      reps: h.reps,
      setIndex: h.setIndex,
      achievedAt: entry.updatedAt ?? entry.date,
    })),
  };
}

/** Feature 013: the first date the running best estimates of all three Big 3 lifts summed to each club's threshold. */
function clubDates(steps: readonly (readonly { date: string; e1rm: number }[])[]): { badges: Partial<Record<ClubId, string>>; totals: Partial<Record<ClubId, number>> } {
  const timeline = steps.flatMap((list, lift) => list.map((s) => ({ ...s, lift }))).sort((a, b) => a.date.localeCompare(b.date));
  const current: (number | undefined)[] = steps.map(() => undefined);
  const badges: Partial<Record<ClubId, string>> = {};
  const totals: Partial<Record<ClubId, number>> = {};
  for (let i = 0; i < timeline.length; i++) {
    const s = timeline[i]!;
    current[s.lift] = s.e1rm;
    // Settle every change on one date before comparing.
    if (timeline[i + 1]?.date === s.date) continue;
    if (current.some((v) => v === undefined)) continue;
    const total = round1(current.reduce((t, v) => t! + v!, 0)!);
    for (const c of CLUBS) if (total >= c.kg && !badges[c.id]) {
      badges[c.id] = s.date;
      totals[c.id] = total;
    }
  }
  return { badges, totals };
}

// ---------------------------------------------------------------- stats rebuild

/**
 * Rebuild one member's stats and feed events from all of their entries (research R1).
 * `events` are every event derivable now, minus those already seeded at launch (FR-031).
 */
export function buildMemberStats(
  entries: readonly SquadEntry[],
  prev: SquadStats | null,
  opts: BuildOptions,
): { stats: SquadStats; events: SquadEvent[]; held: Record<string, number[]> } {
  const { today, weeklyTarget, nowIso } = opts;
  const trustedBefore = opts.trustedBefore ?? prev?.trustedBefore;

  // Workout days and weeks.
  const dayset = new Set(entries.filter(isWorkoutEntry).map((e) => e.date));
  const perWeek = new Map<string, number>();
  for (const d of dayset) perWeek.set(weekStart(d), (perWeek.get(weekStart(d)) ?? 0) + 1);
  const weeks: Record<string, WeekRecord> = {};
  for (const [ws, count] of [...perWeek].sort()) {
    const stored = prev?.weeks[ws];
    weeks[ws] = { days: count, target: stored && isWeekEnded(ws, today) ? stored.target : weeklyTarget };
  }
  const firstWorkoutDate = dayset.size ? [...dayset].sort()[0]! : null;

  // Months (feature 013): workout days per month of the entry date; lifts improved are added below.
  const months: Record<string, MonthRecord> = {};
  const month = (ym: string) => (months[ym] ??= { workoutDays: 0, liftsImproved: 0 });
  for (const d of [...dayset].sort()) month(d.slice(0, 7)).workoutDays++;

  // Lifts.
  const byExercise = new Map<string, SquadEntry[]>();
  for (const e of entries) if (isGymStrength(e)) byExercise.set(e.workoutId, [...(byExercise.get(e.workoutId) ?? []), e]);
  const lifts: Record<string, LiftStats> = {};
  const flags: SquadStats["flags"] = [];
  const events: SquadEvent[] = [];
  const steps = new Map<string, { date: string; e1rm: number }[]>();
  /** Feature 021: `<date>|<exerciseId>` → set indexes held as an unusual jump (same walk as `flags`). */
  const held: Record<string, number[]> = {};
  for (const [exerciseId, list] of byExercise) {
    const walked = walkLift(list, trustedBefore, today);
    for (const [date, idx] of Object.entries(walked.held)) held[`${date}|${exerciseId}`] = idx;
    if (!walked.best && walked.flagged.length === 0) continue;
    const latest = [...list].sort((a, b) => b.date.localeCompare(a.date))[0]!;
    lifts[exerciseId] = {
      name: latest.name,
      builtIn: exerciseId.startsWith("gx-"),
      best: walked.best,
      bestE1rm: walked.bestE,
      prDays: walked.prDays,
      dayBests: walked.dayBests,
      monthBests: walked.monthBests,
      improvedDays: walked.improved,
      prBase: walked.prBase,
    };
    steps.set(exerciseId, walked.bestSteps);
    for (const d of walked.improved) month(d.slice(0, 7)).liftsImproved++;
    for (const date of walked.flagged) flags.push({ date, exerciseId });
    for (const pr of walked.prDays) {
      events.push({
        id: `pr#${exerciseId}#${pr.date}`,
        kind: "pr",
        date: pr.date,
        payload: {
          exerciseName: latest.name,
          weightKg: pr.weightKg,
          reps: pr.reps,
          e1rm: pr.e1rm,
          gainKg: pr.gainKg ?? null,
          type: pr.type ?? null,
          gainReps: pr.gainReps ?? null,
        },
      });
    }
  }

  // Club badges (feature 013): derived like PRs, so a badge that stops being true disappears with its event.
  const clubs = clubDates(BIG3_LIFT_IDS.map((id) => steps.get(id) ?? []));
  for (const c of CLUBS) {
    const date = clubs.badges[c.id];
    if (date) events.push({ id: `badge#${c.id}`, kind: "badge", date, payload: { club: c.id, totalKg: clubs.totals[c.id]! } });
  }

  // Streak-week and first-workout events.
  if (firstWorkoutDate) events.push({ id: "first", kind: "first_workout", date: firstWorkoutDate, payload: {} });
  let run = 0;
  let last: string | null = null;
  for (const ws of Object.keys(weeks).sort()) {
    const rec = weeks[ws]!;
    if (rec.days < rec.target) continue;
    run = last !== null && addDays(last, 7) === ws ? run + 1 : 1;
    last = ws;
    events.push({ id: `wk#${ws}`, kind: "streak_week", date: addDays(ws, 6) < today ? addDays(ws, 6) : today, payload: { week: run } });
  }

  const seeded = new Set(prev?.seededEventIds ?? []);
  const stats: SquadStats = {
    squadId: SQUAD_ID,
    version: prev?.version ?? 0,
    builtAt: nowIso,
    ...(trustedBefore ? { trustedBefore } : {}),
    seededEventIds: prev?.seededEventIds ?? [],
    firstWorkoutDate,
    weeks,
    months,
    lifts,
    flags,
    badges: clubs.badges,
    prRules: 1,
  };
  return { stats, events: events.filter((e) => !seeded.has(e.id)), held };
}

// ---------------------------------------------------------------- read-time figures

export interface StreakFigures {
  current: number;
  best: number;
  weekDays: number;
  target: number;
}

/** FR-009/FR-010. The current week counts only once hit; an unfinished week never breaks the streak. */
export function streakFigures(weeks: Record<string, WeekRecord>, today: string, weeklyTarget: number): StreakFigures {
  const current = weekStart(today);
  const hit = (ws: string) => {
    const rec = weeks[ws];
    return rec !== undefined && rec.days >= (ws === current ? weeklyTarget : rec.target);
  };
  let best = 0;
  let run = 0;
  let last: string | null = null;
  for (const ws of Object.keys(weeks).sort()) {
    if (!hit(ws)) continue;
    run = last !== null && addDays(last, 7) === ws ? run + 1 : 1;
    last = ws;
    best = Math.max(best, run);
  }
  let streak = 0;
  for (let ws = hit(current) ? current : addDays(current, -7); hit(ws); ws = addDays(ws, -7)) streak++;
  return { current: streak, best, weekDays: weeks[current]?.days ?? 0, target: weeklyTarget };
}

/**
 * Feature 013 (profile): total weight lifted (reps × weight of working sets) this week so far and all of last week,
 * Monday–Sunday on the member's local dates.
 */
export function weekVolumes(entries: readonly SquadEntry[], today: string): { thisWeek: number; lastWeek: number } {
  const thisStart = weekStart(today);
  const lastStart = addDays(thisStart, -7);
  let thisT = 0;
  let lastT = 0;
  for (const e of entries) {
    if (!isGymStrength(e) || e.date < lastStart || e.date > today) continue;
    const t = (e.sets ?? []).filter(isWorkingSet).reduce((sum, s) => sum + s.reps * Math.round(s.weightKg * 10), 0);
    if (e.date >= thisStart) thisT += t;
    else lastT += t;
  }
  return { thisWeek: thisT / 10, lastWeek: lastT / 10 };
}

// ---------------------------------------------------------------- ranking

/** Competition ranking (1, 1, 3): higher keys first, equal keys share a rank, then by display name. */
export function rankRows<T>(rows: readonly T[], keys: (row: T) => number[], nameOf: (row: T) => string): (T & { rank: number })[] {
  const cmp = (a: T, b: T) => {
    const ka = keys(a);
    const kb = keys(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i]! - ka[i]!;
    return 0;
  };
  const sorted = [...rows].sort((a, b) => cmp(a, b) || nameOf(a).localeCompare(nameOf(b)));
  let rank = 0;
  return sorted.map((row, i) => {
    if (i === 0 || cmp(sorted[i - 1]!, row) !== 0) rank = i + 1;
    return { ...row, rank };
  });
}
