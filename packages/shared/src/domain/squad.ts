import { addDays } from "./day";
import { GYM_EXERCISES } from "./gym";
import { isWeekEnded, weekStart } from "./week";

/** Feature 010 (squad leaderboard). Pure rules; see specs/010-squad-leaderboard/data-model.md. */

export const SQUAD_ID = "global";
export const DEFAULT_WEEKLY_TARGET = 3;
export const SQUAD_MIN_TARGET = 1;
export const SQUAD_MAX_TARGET = 7;
/** A set is flagged when it beats the previous best by more than 50% AND more than 20 kg (clarification 2026-11-18). */
export const JUMP_RATIO = 1.5;
export const JUMP_MIN_KG = 20;
const DAY_BEST_DAYS = 31;
const VOLUME_DAYS = 14;

export const DEFAULT_LIFT_IDS = ["gx-bench-press", "gx-barbell-squat", "gx-deadlift", "gx-overhead-press"] as const;

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
}
export interface LiftStats {
  name: string;
  builtIn: boolean;
  best: LiftSet | null;
  bestE1rm: (LiftSet & { e1rm: number }) | null;
  prDays: PrDay[];
  dayBests: Record<string, { weightKg: number; reps: number; e1rm: number }>;
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
  dayVolumeKg: Record<string, number>;
  lifts: Record<string, LiftStats>;
  flags: { date: string; exerciseId: string }[];
}

export type SquadEventKind = "pr" | "streak_week" | "first_workout";
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

/** Epley estimate, only for 1-10 reps (higher reps make it unreliable). */
export function e1rm(weightKg: number, reps: number): number | null {
  return reps >= 1 && reps <= 10 ? round1(weightKg * (1 + reps / 30)) : null;
}

const isWorkingSet = (s: { reps: number; weightKg: number; completed: boolean }) => s.completed && s.reps >= 1 && s.weightKg > 0;

const isGymStrength = (e: SquadEntry) => e.kind === "gym" && e.exerciseKind !== "cardio";

/** FR-007: a workout day has gym strength with a completed set, gym cardio, or any activity entry. */
function isWorkoutEntry(e: SquadEntry): boolean {
  if (e.kind !== "gym") return true;
  if (e.exerciseKind === "cardio") return true;
  return (e.sets ?? []).some((s) => s.completed);
}

const suspicious = (value: number | null, prev: number | null) =>
  value !== null && prev !== null && prev > 0 && value > prev * JUMP_RATIO && value - prev > JUMP_MIN_KG;

interface SetView {
  weightKg: number;
  reps: number;
  e1rm: number | null;
}

/** Walk one exercise's days in date order, producing PRs, bests and flags. */
function walkLift(entries: readonly SquadEntry[], trustedBefore: string | undefined, today: string) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let best = null as LiftSet | null;
  let bestE = null as (LiftSet & { e1rm: number }) | null;
  const prDays: PrDay[] = [];
  const dayBests: LiftStats["dayBests"] = {};
  const flagged: string[] = [];
  const windowStart = addDays(today, -(DAY_BEST_DAYS - 1));

  for (const entry of sorted) {
    const working: SetView[] = (entry.sets ?? []).filter(isWorkingSet).map((s) => ({ weightKg: s.weightKg, reps: s.reps, e1rm: e1rm(s.weightKg, s.reps) }));
    if (working.length === 0) continue;

    const trusted =
      Boolean(entry.jumpConfirmedAt) || (trustedBefore !== undefined && entry.updatedAt !== undefined && entry.updatedAt < trustedBefore);
    const prevW: number | null = best?.weightKg ?? null;
    const prevE: number | null = bestE?.e1rm ?? null;
    const eligible: SetView[] = trusted ? working : working.filter((s) => !(suspicious(s.weightKg, prevW) || suspicious(s.e1rm, prevE)));
    if (eligible.length < working.length) flagged.push(entry.date);
    if (eligible.length === 0) continue;

    const heaviest: SetView = eligible.reduce((a: SetView, b: SetView) => (b.weightKg > a.weightKg || (b.weightKg === a.weightKg && b.reps > a.reps) ? b : a));
    const withE: SetView[] = eligible.filter((s) => s.e1rm !== null);
    const topE: SetView | null = withE.length ? withE.reduce((a: SetView, b: SetView) => (b.e1rm! > a.e1rm! ? b : a)) : null;

    if (best !== null) {
      const weightPr = heaviest.weightKg > best.weightKg;
      const estimatePr = topE !== null && prevE !== null && topE.e1rm! > prevE;
      if (weightPr || estimatePr) {
        const shown = estimatePr ? topE! : heaviest;
        prDays.push({ date: entry.date, weightKg: shown.weightKg, reps: shown.reps, e1rm: shown.e1rm });
      }
    }
    if (best === null || heaviest.weightKg > best.weightKg) best = { ...heaviest, date: entry.date };
    if (topE && (bestE === null || topE.e1rm! > bestE.e1rm)) bestE = { weightKg: topE.weightKg, reps: topE.reps, e1rm: topE.e1rm!, date: entry.date };
    if (topE && entry.date >= windowStart) dayBests[entry.date] = { weightKg: topE.weightKg, reps: topE.reps, e1rm: topE.e1rm! };
  }
  return { best, bestE, prDays, dayBests, flagged };
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
): { stats: SquadStats; events: SquadEvent[] } {
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

  // Volume (working sets, recent days only).
  const volumeFrom = addDays(today, -(VOLUME_DAYS - 1));
  const tenths: Record<string, number> = {};
  for (const e of entries) {
    if (!isGymStrength(e) || e.date < volumeFrom) continue;
    for (const s of (e.sets ?? []).filter(isWorkingSet)) tenths[e.date] = (tenths[e.date] ?? 0) + s.reps * Math.round(s.weightKg * 10);
  }
  const dayVolumeKg = Object.fromEntries(Object.entries(tenths).map(([d, t]) => [d, t / 10]));

  // Lifts.
  const byExercise = new Map<string, SquadEntry[]>();
  for (const e of entries) if (isGymStrength(e)) byExercise.set(e.workoutId, [...(byExercise.get(e.workoutId) ?? []), e]);
  const lifts: Record<string, LiftStats> = {};
  const flags: SquadStats["flags"] = [];
  const events: SquadEvent[] = [];
  for (const [exerciseId, list] of byExercise) {
    const walked = walkLift(list, trustedBefore, today);
    if (!walked.best && walked.flagged.length === 0) continue;
    const latest = [...list].sort((a, b) => b.date.localeCompare(a.date))[0]!;
    lifts[exerciseId] = {
      name: latest.name,
      builtIn: exerciseId.startsWith("gx-"),
      best: walked.best,
      bestE1rm: walked.bestE,
      prDays: walked.prDays,
      dayBests: walked.dayBests,
    };
    for (const date of walked.flagged) flags.push({ date, exerciseId });
    for (const pr of walked.prDays) {
      events.push({
        id: `pr#${exerciseId}#${pr.date}`,
        kind: "pr",
        date: pr.date,
        payload: { exerciseName: latest.name, weightKg: pr.weightKg, reps: pr.reps, e1rm: pr.e1rm },
      });
    }
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
    dayVolumeKg,
    lifts,
    flags,
  };
  return { stats, events: events.filter((e) => !seeded.has(e.id)) };
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

/** FR-018: whole-number share of the last 4 ended weeks (since joining) that hit; null if there is none. */
export function consistency(weeks: Record<string, WeekRecord>, today: string, joinedDate: string): number | null {
  const currentWeek = weekStart(today);
  const joinedWeek = weekStart(joinedDate);
  let counted = 0;
  let hits = 0;
  for (let i = 1; i <= 4; i++) {
    const ws = addDays(currentWeek, -7 * i);
    if (ws < joinedWeek) break;
    counted++;
    const rec = weeks[ws];
    if (rec && rec.days >= rec.target) hits++;
  }
  return counted === 0 ? null : Math.round((hits / counted) * 100);
}

/** Sum of the volume recorded for the member's current week (FR-019). */
export function weekVolumeKg(stats: SquadStats | null, today: string): number {
  if (!stats) return 0;
  const from = weekStart(today);
  let tenths = 0;
  for (const [d, v] of Object.entries(stats.dayVolumeKg)) if (d >= from && d <= today) tenths += Math.round(v * 10);
  return tenths / 10;
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

// ---------------------------------------------------------------- boards

export type Period = "week" | "30d" | "all";

export interface BoardMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  today: string;
  /** The member's join date as a local calendar date. */
  joinedDate: string;
  weeklyTarget: number;
  visible: boolean;
  shareBodyWeight: boolean;
  /** Only a saved weight; never the 75 kg default. */
  bodyWeightKg: number | null;
  stats: SquadStats | null;
}

interface PublicMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isYou: boolean;
}
type Ranked<T> = { member: PublicMember; rank: number | null } & T;

export interface Boards {
  period: Period;
  viewerHidden: boolean;
  streaks: Ranked<{ current: number; best: number; week: { days: number; target: number } }>[];
  prs: Ranked<{ count: number; lifts: { exerciseName: string; date: string; weightKg: number; reps: number; e1rm: number | null }[] }>[];
  consistency: Ranked<{ percent: number | null; weekDays: number; target: number; weekVolumeKg: number }>[];
  lift: {
    exerciseId: string;
    exerciseName: string;
    options: { exerciseId: string; name: string }[];
    rows: Ranked<{ relativeRank: number | null; e1rm: number; weightKg: number; reps: number; relative: number | null }>[];
  };
}

const publicMember = (m: BoardMember, viewerId: string): PublicMember => ({
  userId: m.userId,
  displayName: m.displayName,
  avatarUrl: m.avatarUrl,
  isYou: m.userId === viewerId,
});

const periodStart = (period: Period, today: string) => (period === "week" ? weekStart(today) : period === "30d" ? addDays(today, -29) : "0000-00-00");

const builtInStrength = GYM_EXERCISES.filter((e) => e.kind === "strength");
const exerciseName = (id: string) => builtInStrength.find((e) => e.id === id)?.name ?? id;

/** Build all four boards for `viewerId`. Hidden members are removed before ranking (FR-003, FR-024). */
export function buildBoards(input: { members: readonly BoardMember[]; viewerId: string; period: Period; exercise: string }): Boards {
  const { members, viewerId, period } = input;
  const viewer = members.find((m) => m.userId === viewerId);
  const viewerHidden = viewer !== undefined && !viewer.visible;
  const ranked = members.filter((m) => m.visible);
  /** Ranked rows, plus the hidden viewer's own row unranked at the end. */
  const withViewer = <R extends { member: PublicMember }>(rows: (R & { rank: number | null })[], own: R | null): (R & { rank: number | null })[] =>
    viewerHidden && own ? [...rows, { ...own, rank: null }] : rows;

  const streakRow = (m: BoardMember) => {
    const f = streakFigures(m.stats?.weeks ?? {}, m.today, m.weeklyTarget);
    return { member: publicMember(m, viewerId), current: f.current, best: f.best, week: { days: f.weekDays, target: f.target } };
  };
  const streaks = withViewer(rankRows(ranked.map(streakRow), (r) => [r.current, r.best, r.week.days], (r) => r.member.displayName), viewer && viewerHidden ? streakRow(viewer) : null);

  const prRow = (m: BoardMember) => {
    const from = periodStart(period, m.today);
    const lifts = Object.values(m.stats?.lifts ?? {}).flatMap((l) =>
      l.prDays.filter((p) => p.date >= from && p.date <= m.today).map((p) => ({ exerciseName: l.name, date: p.date, weightKg: p.weightKg, reps: p.reps, e1rm: p.e1rm })),
    );
    lifts.sort((a, b) => b.date.localeCompare(a.date));
    return { member: publicMember(m, viewerId), count: lifts.length, lifts };
  };
  const prs = withViewer(
    rankRows(ranked.map(prRow).filter((r) => r.count > 0), (r) => [r.count], (r) => r.member.displayName),
    viewer && viewerHidden && prRow(viewer).count > 0 ? prRow(viewer) : null,
  );

  const consistencyRow = (m: BoardMember) => {
    const percent = consistency(m.stats?.weeks ?? {}, m.today, m.joinedDate);
    const f = streakFigures(m.stats?.weeks ?? {}, m.today, m.weeklyTarget);
    return { member: publicMember(m, viewerId), percent, weekDays: f.weekDays, target: f.target, weekVolumeKg: weekVolumeKg(m.stats, m.today) };
  };
  const consistencyBoard = withViewer(
    rankRows(ranked.map(consistencyRow), (r) => [r.percent ?? -1, r.weekDays], (r) => r.member.displayName),
    viewer && viewerHidden ? consistencyRow(viewer) : null,
  );

  // Lift board: defaults plus built-in lifts at least 2 visible members have logged. Own exercises are never offered.
  const loggedBy = (id: string) => ranked.filter((m) => m.stats?.lifts[id]?.best).length;
  const optionIds = builtInStrength.map((e) => e.id).filter((id) => (DEFAULT_LIFT_IDS as readonly string[]).includes(id) || loggedBy(id) >= 2);
  const options = optionIds.map((id) => ({ exerciseId: id, name: exerciseName(id) }));
  const exerciseId = optionIds.includes(input.exercise) ? input.exercise : DEFAULT_LIFT_IDS[0];

  const liftRow = (m: BoardMember) => {
    const l = m.stats?.lifts[exerciseId];
    if (!l) return null;
    let top: { e1rm: number; weightKg: number; reps: number } | null = null;
    if (period === "all") top = l.bestE1rm;
    else {
      const from = periodStart(period, m.today);
      for (const [d, v] of Object.entries(l.dayBests)) if (d >= from && d <= m.today && (!top || v.e1rm > top.e1rm)) top = v;
    }
    if (!top) return null;
    const relative = m.shareBodyWeight && m.bodyWeightKg ? Math.round((top.e1rm / m.bodyWeightKg) * 100) / 100 : null;
    return { member: publicMember(m, viewerId), e1rm: top.e1rm, weightKg: top.weightKg, reps: top.reps, relative };
  };
  const liftRows = ranked.map(liftRow).filter((r): r is NonNullable<typeof r> => r !== null);
  const rankedLift = rankRows(liftRows, (r) => [r.e1rm], (r) => r.member.displayName);
  const relRanks = new Map(rankRows(liftRows.filter((r) => r.relative !== null), (r) => [r.relative!], (r) => r.member.displayName).map((r) => [r.member.userId, r.rank]));
  const rows = withViewer(
    rankedLift.map((r) => ({ ...r, relativeRank: relRanks.get(r.member.userId) ?? null })),
    viewer && viewerHidden ? (() => { const r = liftRow(viewer); return r ? { ...r, relativeRank: null as number | null } : null; })() : null,
  );

  return { period, viewerHidden, streaks, prs, consistency: consistencyBoard, lift: { exerciseId, exerciseName: exerciseName(exerciseId), options, rows } };
}
