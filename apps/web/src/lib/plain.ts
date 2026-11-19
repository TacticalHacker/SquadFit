import { STEPS_MIN_DAYS, type Club, type SquadBoardView, type SquadFeedItem } from "@calci/shared";

/**
 * Feature 013: every squad-area phrase in one place, written for someone who has never been to a gym. Always with
 * units; never "e1RM". Tweak wording here, not in components.
 */

const nf = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const plural = (n: number, one: string, many = `${one}s`) => `${nf.format(n)} ${n === 1 ? one : many}`;

export const num = (n: number) => nf.format(n);
export const kg = (n: number) => `${nf.format(n)} kg`;
export const signedKg = (n: number) => `${n >= 0 ? "+" : "−"}${kg(Math.abs(n))}`;
export const minutes = (n: number) => `${Math.round(n)} min`;
export const stepsADay = (n: number) => `${nf.format(Math.round(n))} steps a day`;
export const workouts = (n: number) => plural(n, "workout");
export const liftsImproved = (n: number) => `${plural(n, "lift")} improved`;

/** Profile: "8% more than last week", "8% less than last week so far", "Same as last week"; null without last week. */
export function weekCompare(thisWeek: number, lastWeek: number): string | null {
  if (lastWeek <= 0) return null;
  const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  if (pct === 0) return "Same as last week";
  return pct > 0 ? `${pct}% more than last week` : `${-pct}% less than last week so far`;
}

/** Empty at 0 (FR-027): a zero streak is never shown. */
export const weeksInARow = (n: number) => (n > 0 ? `${plural(n, "week")} in a row` : "");
export const bestWeeks = (n: number) => (n > 0 ? `Best: ${plural(n, "week")}` : "");
export const workoutsThisWeek = (days: number, target: number) => `${days} of ${target} workouts this week`;

export const estMax = (n: number) => `Estimated max: about ${kg(n)}`;
export const aboutKg = (n: number) => `about ${kg(n)}`;

export const monthName = (ym: string) =>
  new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`));
export const shortDate = (d: string) =>
  new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

// ---------------------------------------------------------------- explanations behind (i)

export const INFO = {
  estMax: "The most you could likely lift once, worked out from your sets.",
  totalLifted: "Total weight lifted = every rep's weight added together.",
  burnedAdjusted: "Estimated. Smartwatches often overcount gym calories, so we adjust it down.",
  burned: "Estimated from your workouts.",
} as const;

// ---------------------------------------------------------------- clubs

export const CLUB_LABEL: Record<Club, string> = {
  club225: "225 kg Club",
  club300: "300 kg Club",
  club400: "400 kg Club",
  club450: "450 kg Club (1000 lb)",
  club500: "500 kg Club",
};
export const CLUB_SHORT: Record<Club, string> = { club225: "225", club300: "300", club400: "400", club450: "450", club500: "500" };
export const CLUB_INFO = "Bench press, squat and deadlift estimated maxes added together (est.).";

// ---------------------------------------------------------------- boards

type BoardId = SquadBoardView["id"];
type RowOf<Id extends BoardId> = Extract<SquadBoardView, { id: Id }>["rows"][number];

export const BOARD_GROUPS = [
  { id: "grind", title: "Effort", boards: ["workouts", "streak", "improved", "steps"] },
  { id: "strength", title: "Strength", boards: ["prJump", "strength"] },
  { id: "nutrition", title: "Nutrition", boards: ["protein"] },
] as const satisfies readonly { id: string; title: string; boards: readonly BoardId[] }[];

/** Big numbers stay short so names never get squeezed; detail goes in the one muted line under the name. */
export const BOARD_COPY: {
  [Id in BoardId]: {
    title: string;
    info: string;
    /** No rows at all. */
    empty: string;
    /** Rows exist but nobody qualifies to be ranked yet (e.g. everyone still needs more synced days). */
    emptyUnranked?: string;
    value: (r: RowOf<Id>) => string;
    sub: (r: RowOf<Id>) => string;
  };
} = {
  workouts: {
    title: "Most workouts",
    info: "Days you worked out this month. Two workouts on the same day count as one.",
    empty: "No workouts yet this month.",
    value: (r) => workouts(r.days),
    sub: () => "",
  },
  streak: {
    title: "Active streak",
    info: "Weeks in a row you hit your workout goal. Rest days don't break it.",
    empty: "No streaks yet.",
    value: (r) => streakValue(r.weeks),
    sub: (r) => `${r.weekDays} of ${r.target} this week`,
  },
  improved: {
    title: "Lifts improved",
    info: "Times you beat your last session: one more rep or a bit more weight.",
    empty: "No lifts improved yet this month.",
    value: (r) => plural(r.count, "lift"),
    sub: () => "improved",
  },
  steps: {
    title: "Steps",
    info: `Average steps a day this month, on days your phone synced. You need ${STEPS_MIN_DAYS} synced days to be ranked. Only members who share their steps.`,
    empty: "No steps synced yet this month.",
    emptyUnranked: `Nobody has synced ${STEPS_MIN_DAYS} days yet this month.`,
    value: (r) => nf.format(Math.round(r.avgSteps)),
    sub: (r) => `a day · from ${plural(r.syncedDays, "day")}`,
  },
  prJump: {
    title: "Biggest PR jump",
    info: "How much your estimated max on a main lift went up this month, compared with your best before this month.",
    empty: "No new personal bests on the main lifts yet this month.",
    value: (r) => signedKg(r.kg),
    sub: (r) => `${r.liftName} · +${r.pct}%`,
  },
  strength: {
    title: "Current strength",
    info: "Your estimated max on bench press, squat and deadlift, added together. Uses your best ever, so it doesn't reset.",
    empty: "Nobody has logged all three lifts yet.",
    emptyUnranked: "Nobody has logged all three lifts yet.",
    value: (r) => (r.big3 === null ? "–" : kg(r.big3)),
    sub: (r) => (r.big3 === null ? joinHint(r.missing.filter((m) => m !== "Overhead Press")) : "est. bench + squat + deadlift"),
  },
  protein: {
    title: "Protein days",
    info: "Days this month you hit your own protein goal, out of the days you logged food. Only members who share their nutrition.",
    empty: "No protein goals hit yet this month.",
    value: (r) => `${r.hitDays} of ${r.loggedDays}`,
    sub: () => "days at protein goal",
  },
};

/** Big number for a streak: "Week 1" until a week is completed (ranked by this week's progress), then "N weeks". */
export const streakValue = (weeks: number) => (weeks === 0 ? "Week 1" : plural(weeks, "week"));

const LIFT_WORD: Record<string, string> = { "Bench Press": "bench press", "Barbell Squat": "squat", Deadlift: "deadlift", "Overhead Press": "overhead press" };
const andList = (xs: readonly string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
/** "Log a squat and deadlift to join" (Current strength, FR-013). */
export const joinHint = (missing: readonly string[]) => `Log a ${andList(missing.map((m) => LIFT_WORD[m] ?? m.toLowerCase()))} to join`;

/** The viewer's line when they are not ranked on a board: one sentence saying what to do about it. */
export function unrankedYou(board: SquadBoardView, row: SquadBoardView["rows"][number], hidden: boolean): string {
  if (board.id === "strength" && (row as RowOf<"strength">).big3 === null) return `${joinHint((row as RowOf<"strength">).missing.filter((m) => m !== "Overhead Press"))}.`;
  if (board.id === "steps") {
    const synced = (row as RowOf<"steps">).syncedDays;
    if (synced < STEPS_MIN_DAYS) return `You've synced ${plural(synced, "day")}. Sync ${STEPS_MIN_DAYS - synced} more to join.`;
  }
  return hidden ? "You're not ranked while you're hidden." : "You're not ranked yet.";
}

/** The "kg | %" view of Biggest PR jump and the "Big 4" view of Current strength. */
export const prJumpPct = (r: RowOf<"prJump">) => ({ value: `+${r.pct}%`, sub: `${r.pctLiftName} · ${signedKg(r.pctKg)}` });
export const strengthBig4 = (r: RowOf<"strength">) => ({
  value: r.big4 === null ? "–" : kg(r.big4),
  sub: r.big4 === null ? joinHint(r.missing) : "est. bench + squat + deadlift + overhead press",
});

// ---------------------------------------------------------------- hall of fame

export const RECORD_LABEL = {
  liftBench: "Bench press: heaviest estimated max",
  liftSquat: "Squat: heaviest estimated max",
  liftDeadlift: "Deadlift: heaviest estimated max",
  liftOhp: "Overhead press: heaviest estimated max",
  big3: "Best Big 3 total (est.)",
  longestStreak: "Longest streak",
  monthWorkouts: "Most workouts in a month",
  monthPrJump: "Biggest PR jump in a month",
  monthImproved: "Most lifts improved in a month",
  monthSteps: "Highest monthly step average",
} as const;

/** Short names for the "Up for grabs" line. */
export const RECORD_SHORT: Record<keyof typeof RECORD_LABEL, string> = {
  liftBench: "bench press",
  liftSquat: "squat",
  liftDeadlift: "deadlift",
  liftOhp: "overhead press",
  big3: "Big 3 total",
  longestStreak: "longest streak",
  monthWorkouts: "most workouts in a month",
  monthPrJump: "biggest PR jump",
  monthImproved: "most lifts improved in a month",
  monthSteps: "best step month",
};
export const upForGrabs = (ids: readonly (keyof typeof RECORD_LABEL)[]) => {
  const list = andList(ids.map((id) => RECORD_SHORT[id]));
  return `Up for grabs: ${list.charAt(0).toUpperCase()}${list.slice(1)}`;
};

export function recordValue(id: keyof typeof RECORD_LABEL, value: number, liftName: string | null): string {
  if (id === "longestStreak") return weeksInARow(value);
  if (id === "monthWorkouts") return workouts(value);
  if (id === "monthSteps") return stepsADay(value);
  if (id === "monthPrJump") return `${signedKg(value)}${liftName ? ` · ${liftName}` : ""}`;
  if (id === "monthImproved") return liftsImproved(value);
  return aboutKg(value);
}

// ---------------------------------------------------------------- feed

/** The sentence after the member's name (the name itself is rendered as a link). */
export function feedLine(i: SquadFeedItem): string {
  if (i.kind === "pr" && i.pr) {
    const gain = i.pr.gainKg ? ` (${signedKg(i.pr.gainKg)})` : "";
    return ` hit a new PR (personal best) on ${i.pr.exerciseName}: ${kg(i.pr.weightKg)} × ${plural(i.pr.reps, "rep")}${gain}`;
  }
  if (i.kind === "badge" && i.club) return ` joined the ${CLUB_LABEL[i.club]} 👑`;
  if (i.kind === "streak_week") return i.week && i.week > 1 ? ` hit the workout goal ${i.week} weeks in a row` : " hit the workout goal this week";
  if (i.kind === "protein_streak") return " hit the protein goal 7 days in a row";
  if (i.kind === "step_streak") return " hit the step goal 7 days in a row";
  return " logged their first workout";
}

// ---------------------------------------------------------------- workouts and sets

const DUMBBELL_IDS = new Set(["gx-hammer-curl", "gx-lateral-raises"]);
/** Dumbbell lifts are logged per dumbbell (research R10). */
export const isDumbbell = (id: string, name: string) => DUMBBELL_IDS.has(id) || /dumbbell/i.test(name);
const w = (n: number, perDumbbell: boolean) => `${kg(n)}${perDumbbell ? " per dumbbell" : ""}`;

/** "3 sets of 10 reps at 15 kg" or "3 sets · 25 kg → 30 kg → 35 kg · 10 reps each". Completed sets only. */
export function setSummary(sets: readonly { weightKg: number; reps: number; completed: boolean }[], perDumbbell: boolean): string {
  const done = sets.filter((s) => s.completed);
  if (done.length === 0) return "No sets finished";
  const n = plural(done.length, "set");
  const sameW = done.every((s) => s.weightKg === done[0]!.weightKg);
  const sameR = done.every((s) => s.reps === done[0]!.reps);
  if (sameW && sameR) return `${n} of ${plural(done[0]!.reps, "rep")} at ${w(done[0]!.weightKg, perDumbbell)}`;
  const reps = sameR ? `${plural(done[0]!.reps, "rep")} each` : `${done.map((s) => s.reps).join(", ")} reps`;
  if (sameW) return `${n} at ${w(done[0]!.weightKg, perDumbbell)} · ${reps}`;
  return `${n} · ${done.map((s) => kg(s.weightKg)).join(" → ")}${perDumbbell ? " per dumbbell" : ""} · ${reps}`;
}

export const bestSet = (weightKg: number, reps: number, perDumbbell = false) => `Best: ${w(weightKg, perDumbbell)} × ${plural(reps, "rep")}`;
export const heaviestLift = (name: string | null, weightKg: number, reps: number) => `Heaviest lift: ${name ? `${name} ` : ""}${kg(weightKg)} × ${plural(reps, "rep")}`;
export const cardioLine = (name: string, mins: number) => `${name} · ${minutes(mins)}`;
export function sessionLine(mins: number, exercises: number, liftedKg: number): string {
  return [minutes(mins), plural(exercises, "exercise"), ...(liftedKg > 0 ? [`lifted ${kg(liftedKg)} in total`] : [])].join(" · ");
}

// ---------------------------------------------------------------- nutrition

export const burned = (n: number) => `Burned about ${nf.format(Math.round(n))} calories`;
export const ate = (n: number, target: number | null) => (target ? `Ate ${nf.format(n)} of ${nf.format(target)} calories` : `Ate ${nf.format(n)} calories`);
export const protein = (g: number, target: number | null) => (target ? `Protein: ${nf.format(g)} g of ${nf.format(target)} g goal` : `Protein: ${nf.format(g)} g`);
export const carbsFat = (carbs: number, fat: number) => `Carbs: ${nf.format(carbs)} g · Fat: ${nf.format(fat)} g`;
