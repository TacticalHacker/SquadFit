import { addDays, dateRange, localDate } from "./day";
import { GYM_EXERCISES } from "./gym";
import { BIG3_LIFT_IDS, CLUBS, rankRows, streakFigures, type ClubId, type SquadStats, type WeekRecord } from "./squad";

/**
 * Feature 013 (squad v2): the board registry and Hall of Fame. Pure; see specs/013-squad-v2/research.md R1–R8.
 * Adding a board = one BOARD_DEFS entry + one rank function below + one schema variant + one phrase in the web app.
 */

export const SQUAD_DEFAULT_TIMEZONE = "Asia/Kolkata";
/** A member needs this many synced days this month to be ranked on Steps (one lucky day is not an average). */
export const STEPS_MIN_DAYS = 3;
export const PR_JUMP_LIFTS = ["gx-bench-press", "gx-barbell-squat", "gx-deadlift", "gx-overhead-press", "gx-barbell-row", "gx-pull-ups"] as const;
const OHP = "gx-overhead-press";

export const BOARD_DEFS = [
  { id: "workouts", group: "grind", monthly: true },
  { id: "streak", group: "grind", monthly: false },
  { id: "improved", group: "grind", monthly: true },
  { id: "steps", group: "grind", monthly: true },
  { id: "prJump", group: "strength", monthly: true },
  { id: "strength", group: "strength", monthly: false },
  { id: "protein", group: "nutrition", monthly: true },
] as const;
export type BoardId = (typeof BOARD_DEFS)[number]["id"];

// ---------------------------------------------------------------- months

export const monthOfDate = (date: string) => date.slice(0, 7);
/** The current "YYYY-MM" in the squad's timezone: everyone resets at the same instant (FR-006). */
export const squadMonth = (now: Date, timezone: string) => localDate(now, timezone).slice(0, 7);

/** The member's local dates of `month` up to their today (empty if they are still in an earlier month). */
export function monthDates(month: string, today: string): string[] {
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const to = today < last ? today : last;
  return to < first ? [] : dateRange(first, to);
}

// ---------------------------------------------------------------- inputs and rows

export interface SquadBoardMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  /** The member's own local date. */
  today: string;
  weeklyTarget: number;
  visible: boolean;
  stats: SquadStats | null;
}

interface PublicMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isYou: boolean;
}

type Row<T> = { member: PublicMember; rank: number | null; club: ClubId | null } & T;

export type SquadBoard =
  | { id: "workouts"; rows: Row<{ days: number }>[] }
  | { id: "streak"; rows: Row<{ weeks: number; best: number; weekDays: number; target: number }>[] }
  | { id: "improved"; rows: Row<{ count: number }>[] }
  | { id: "steps"; rows: Row<{ avgSteps: number; syncedDays: number }>[] }
  | { id: "prJump"; rows: Row<{ kg: number; liftName: string; pct: number; pctRank: number | null; pctLiftName: string; pctKg: number }>[] }
  | { id: "strength"; rows: Row<{ big3: number | null; big4: number | null; big4Rank: number | null; missing: string[] }>[] }
  | { id: "protein"; rows: Row<{ hitDays: number; loggedDays: number }>[] };

export interface BoardsInput {
  members: readonly SquadBoardMember[];
  viewerId: string;
  month: string;
  /** Already gated (feature 012): only members whose steps the viewer may see, with ≥ 1 synced day this month. */
  steps: ReadonlyMap<string, { avgSteps: number; syncedDays: number }>;
  /** Already gated (feature 011 + 013): sharing, visible, confirmed target. `loggedDays` = days with food logged this month. */
  protein: ReadonlyMap<string, { hitDays: number; loggedDays: number }>;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const liftName = (id: string) => GYM_EXERCISES.find((e) => e.id === id)?.name ?? id;

/** The highest club badge a member holds, or null. */
export function clubOf(stats: SquadStats | null): ClubId | null {
  let best: ClubId | null = null;
  for (const c of CLUBS) if (stats?.badges?.[c.id]) best = c.id;
  return best;
}

/** All held clubs, lowest first, with the date each was earned. */
export const clubsOf = (stats: SquadStats | null): { club: ClubId; date: string }[] =>
  CLUBS.filter((c) => stats?.badges?.[c.id]).map((c) => ({ club: c.id, date: stats!.badges[c.id]! }));

/** Largest positive gains of `month` over all earlier months, by kg and by percent (research R3). */
export function prJumpOf(stats: SquadStats | null, month: string) {
  let byKg: { kg: number; pct: number; lift: string } | null = null;
  let byPct: { kg: number; pct: number; lift: string } | null = null;
  for (const id of PR_JUMP_LIFTS) {
    const j = liftJump(stats?.lifts[id]?.monthBests, month);
    if (!j) continue;
    const row = { ...j, lift: liftName(id) };
    if (!byKg || row.kg > byKg.kg) byKg = row;
    if (!byPct || row.pct > byPct.pct) byPct = row;
  }
  return byKg && byPct ? { byKg, byPct } : null;
}

function liftJump(monthBests: Record<string, { e1rm: number }> | undefined, month: string): { kg: number; pct: number } | null {
  const now = monthBests?.[month];
  if (!now) return null;
  let before: number | null = null;
  for (const [ym, v] of Object.entries(monthBests!)) if (ym < month && (before === null || v.e1rm > before)) before = v.e1rm;
  if (before === null) return null; // first logged this month: a baseline, not a jump
  const kg = round1(now.e1rm - before);
  return kg > 0 ? { kg, pct: Math.round((kg / before) * 100) } : null;
}

/** Best-ever estimated Big 3 (and Big 4 with overhead press) plus the names of lifts never logged. */
export function strengthOf(stats: SquadStats | null) {
  const best = (id: string) => stats?.lifts[id]?.bestE1rm?.e1rm;
  const ids = [...BIG3_LIFT_IDS, OHP];
  const missing = ids.filter((id) => best(id) === undefined).map(liftName);
  const big3 = BIG3_LIFT_IDS.every((id) => best(id) !== undefined) ? round1(BIG3_LIFT_IDS.reduce((t, id) => t + best(id)!, 0)) : null;
  const big4 = big3 !== null && best(OHP) !== undefined ? round1(big3 + best(OHP)!) : null;
  return { big3, big4, missing };
}

// ---------------------------------------------------------------- boards

/** Every board for `viewerId`. Hidden members are dropped before ranking; a hidden viewer gets their own unranked row. */
export function buildSquadBoards(input: BoardsInput): SquadBoard[] {
  const { members, viewerId, month } = input;
  const viewer = members.find((m) => m.userId === viewerId);
  const viewerHidden = viewer !== undefined && !viewer.visible;
  const ranked = members.filter((m) => m.visible);
  const pub = (m: SquadBoardMember): PublicMember => ({ userId: m.userId, displayName: m.displayName, avatarUrl: m.avatarUrl, isYou: m.userId === viewerId });
  const name = (r: { member: PublicMember }) => r.member.displayName;

  /** Rank `make`'s rows for visible members, then add the hidden viewer's row unranked. */
  function board<T extends object>(make: (m: SquadBoardMember) => T | null, keys: (r: T) => number[]): Row<T>[] {
    const rows = ranked.flatMap((m) => {
      const r = make(m);
      return r ? [{ member: pub(m), club: clubOf(m.stats), ...r }] : [];
    });
    const out: Row<T>[] = rankRows(rows, keys, name);
    const own = viewerHidden ? make(viewer!) : null;
    return own ? [...out, { member: pub(viewer!), club: clubOf(viewer!.stats), rank: null, ...own }] : out;
  }

  const monthRec = (m: SquadBoardMember) => m.stats?.months?.[month];

  const workouts = board((m) => (monthRec(m)?.workoutDays ? { days: monthRec(m)!.workoutDays } : null), (r) => [r.days]);

  const streak = board(
    (m) => {
      if (!m.stats?.firstWorkoutDate) return null;
      const f = streakFigures(m.stats.weeks, m.today, m.weeklyTarget);
      return { weeks: f.current, best: f.best, weekDays: f.weekDays, target: f.target };
    },
    // With no current streak, a past best doesn't count: this week's progress decides.
    (r) => [r.weeks, r.weeks > 0 ? r.best : 0, r.weekDays],
  );

  const improved = board((m) => (monthRec(m)?.liftsImproved ? { count: monthRec(m)!.liftsImproved } : null), (r) => [r.count]);

  const qualified = (m: SquadBoardMember) => (input.steps.get(m.userId)?.syncedDays ?? 0) >= STEPS_MIN_DAYS;
  const stepsRanked = board((m) => (qualified(m) ? input.steps.get(m.userId)! : null), (r) => [r.avgSteps]);
  // "Needs more days": synced this month but fewer than STEPS_MIN_DAYS, listed unranked after everyone ranked.
  const needsMore = (viewerHidden ? [...ranked, viewer!] : ranked)
    .filter((m) => input.steps.has(m.userId) && !qualified(m))
    .map((m) => ({ member: pub(m), club: clubOf(m.stats), rank: null, ...input.steps.get(m.userId)! }));
  const steps = [...stepsRanked, ...needsMore];

  const prRows = board(
    (m) => {
      const j = prJumpOf(m.stats, month);
      return j ? { kg: j.byKg.kg, liftName: j.byKg.lift, pct: j.byKg.pct, pctRank: null as number | null, pctLiftName: j.byPct.lift, pctKg: j.byPct.kg, pctBest: j.byPct.pct } : null;
    },
    (r) => [r.kg],
  );
  const pctRanks = new Map(rankRows(prRows.filter((r) => r.rank !== null), (r) => [r.pctBest], name).map((r) => [r.member.userId, r.rank]));
  const prJump = prRows.map(({ pctBest, ...r }) => ({ ...r, pct: pctBest, pctRank: r.rank === null ? null : (pctRanks.get(r.member.userId) ?? null) }));

  // Current strength: members missing a Big 3 lift are listed last, unranked (FR-013).
  const strengthRows = board(
    (m) => {
      const s = strengthOf(m.stats);
      return s.big3 === null && s.missing.length === 4 ? null : { ...s, big4Rank: null as number | null };
    },
    (r) => [r.big3 ?? -1],
  ).map((r) => (r.big3 === null ? { ...r, rank: null } : r));
  const big4Ranks = new Map(rankRows(strengthRows.filter((r) => r.big4 !== null && r.rank !== null), (r) => [r.big4!], name).map((r) => [r.member.userId, r.rank]));
  const strength = strengthRows.map((r) => ({ ...r, big4Rank: big4Ranks.get(r.member.userId) ?? null }));

  // Members who have not hit their goal yet this month are not ranked (the card shows an empty state instead).
  const protein = board((m) => ((input.protein.get(m.userId)?.hitDays ?? 0) > 0 ? input.protein.get(m.userId)! : null), (r) => [r.hitDays]);

  return [
    { id: "workouts", rows: workouts },
    { id: "streak", rows: streak },
    { id: "improved", rows: improved },
    { id: "steps", rows: steps },
    { id: "prJump", rows: prJump },
    { id: "strength", rows: strength },
    { id: "protein", rows: protein },
  ];
}

// ---------------------------------------------------------------- hall of fame

export const RECORD_IDS = ["liftBench", "liftSquat", "liftDeadlift", "liftOhp", "big3", "longestStreak", "monthWorkouts", "monthPrJump", "monthImproved", "monthSteps"] as const;
export type RecordId = (typeof RECORD_IDS)[number];
const RECORD_LIFTS: Partial<Record<RecordId, string>> = { liftBench: "gx-bench-press", liftSquat: "gx-barbell-squat", liftDeadlift: "gx-deadlift", liftOhp: OHP };

export interface HallRecord {
  id: RecordId;
  holderId: string | null;
  value: number;
  liftName: string | null;
  date: string | null;
  month: string | null;
}

/** Longest run of hit weeks and the last day of that run (capped at today); earliest run wins a tie. */
function longestRun(weeks: Record<string, WeekRecord>, today: string, weeklyTarget: number): { weeks: number; date: string } | null {
  const best = streakFigures(weeks, today, weeklyTarget).best;
  if (best === 0) return null;
  const current = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
  const hit = (ws: string) => weeks[ws] !== undefined && weeks[ws]!.days >= (ws === current ? weeklyTarget : weeks[ws]!.target);
  let run = 0;
  let last: string | null = null;
  for (const ws of Object.keys(weeks).sort()) {
    if (!hit(ws)) continue;
    run = last !== null && addDays(last, 7) === ws ? run + 1 : 1;
    last = ws;
    if (run === best) {
      const end = addDays(ws, 6);
      return { weeks: best, date: end < today ? end : today };
    }
  }
  return null;
}

/**
 * All-time records among members visible to everyone (hidden members never hold one, FR-016). A tie goes to whoever
 * reached it first. `stepMonths` is already gated: monthly step averages of members whose steps are shared.
 */
export function buildHallOfFame(input: {
  members: readonly SquadBoardMember[];
  viewerId: string;
  stepMonths: ReadonlyMap<string, Record<string, number>>;
}): HallRecord[] {
  const members = input.members.filter((m) => m.visible);
  type Cand = { holderId: string; value: number; when: string; liftName?: string };
  const pick = (cands: Cand[]) => cands.reduce<Cand | null>((a, c) => (!a || c.value > a.value || (c.value === a.value && c.when < a.when) ? c : a), null);
  const perMonth = (get: (m: SquadBoardMember) => Record<string, number>) =>
    pick(members.flatMap((m) => Object.entries(get(m)).filter(([, v]) => v > 0).map(([ym, v]) => ({ holderId: m.userId, value: v, when: ym }))));

  const found: Record<RecordId, { c: Cand | null; kind: "date" | "month" }> = {} as never;
  for (const [id, liftId] of Object.entries(RECORD_LIFTS) as [RecordId, string][]) {
    const c = pick(members.flatMap((m) => {
      const b = m.stats?.lifts[liftId]?.bestE1rm;
      return b ? [{ holderId: m.userId, value: b.e1rm, when: b.date }] : [];
    }));
    found[id] = { c, kind: "date" };
  }
  found.big3 = {
    kind: "date",
    c: pick(members.flatMap((m) => {
      const total = strengthOf(m.stats).big3;
      if (total === null) return [];
      const when = BIG3_LIFT_IDS.map((id) => m.stats!.lifts[id]!.bestE1rm!.date).sort().at(-1)!;
      return [{ holderId: m.userId, value: total, when }];
    })),
  };
  found.longestStreak = {
    kind: "date",
    c: pick(members.flatMap((m) => {
      const r = m.stats ? longestRun(m.stats.weeks, m.today, m.weeklyTarget) : null;
      return r ? [{ holderId: m.userId, value: r.weeks, when: r.date }] : [];
    })),
  };
  found.monthWorkouts = { kind: "month", c: perMonth((m) => Object.fromEntries(Object.entries(m.stats?.months ?? {}).map(([ym, v]) => [ym, v.workoutDays]))) };
  // Stats built before liftsImproved existed read as 0 until the next rebuild (or backfill).
  found.monthImproved = { kind: "month", c: perMonth((m) => Object.fromEntries(Object.entries(m.stats?.months ?? {}).map(([ym, v]) => [ym, v.liftsImproved ?? 0]))) };
  found.monthSteps = { kind: "month", c: perMonth((m) => input.stepMonths.get(m.userId) ?? {}) };
  found.monthPrJump = {
    kind: "month",
    c: pick(members.flatMap((m) =>
      PR_JUMP_LIFTS.flatMap((id) => {
        const mb = m.stats?.lifts[id]?.monthBests ?? {};
        return Object.keys(mb).flatMap((ym) => {
          const j = liftJump(mb, ym);
          return j ? [{ holderId: m.userId, value: j.kg, when: ym, liftName: liftName(id) }] : [];
        });
      }),
    )),
  };

  return RECORD_IDS.map((id) => {
    const { c, kind } = found[id];
    return {
      id,
      holderId: c?.holderId ?? null,
      value: c?.value ?? 0,
      liftName: c?.liftName ?? null,
      date: c && kind === "date" ? c.when : null,
      month: c && kind === "month" ? c.when : null,
    };
  });
}

/** Monthly averages over synced days, for the Hall of Fame steps record. */
export function stepMonthAverages(days: readonly { date: string; steps: number }[]): Record<string, number> {
  const sums = new Map<string, { t: number; n: number }>();
  for (const d of days) {
    const s = sums.get(monthOfDate(d.date)) ?? { t: 0, n: 0 };
    s.t += d.steps;
    s.n += 1;
    sums.set(monthOfDate(d.date), s);
  }
  return Object.fromEntries([...sums].map(([ym, s]) => [ym, Math.round(s.t / s.n)]));
}
