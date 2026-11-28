import { STEPS_MIN_DAYS, type Club, type ShareRowDto, type SquadBoardView, type SquadFeedItem } from "@calci/shared";

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
    /** The card fills its top 3 with unranked (greyed) rows when fewer than 3 are ranked. */
    showUnranked?: boolean;
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
    // Shown as progress dots by BoardRow (`weekDots`); this text is their accessible label.
    sub: (r) => weekDotsLabel(r.weekDays, r.target),
  },
  improved: {
    title: "Lifts improved",
    info: "Times you beat your last session: one more rep or a bit more weight.",
    empty: "No lifts improved yet this month.",
    value: (r) => plural(r.count, "lift"),
    sub: () => "",
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
    empty: "Nobody has logged a bench press, squat or deadlift yet.",
    value: (r) => kg(r.big3 ?? r.big3Partial),
    sub: (r) => (r.big3 === null ? `${3 - r.missing.filter((m) => m !== "Overhead Press").length} of 3 lifts` : "est. bench + squat + deadlift"),
    showUnranked: true,
  },
  protein: {
    title: "Protein days",
    info: "Days this month you hit your own protein goal, out of the days you logged food. Only members who share their nutrition.",
    empty: "No protein goals hit yet this month.",
    value: (r) => plural(r.hitDays, "day"),
    sub: (r) => `out of ${plural(r.loggedDays, "day")} logged`,
  },
};

/** "2 of 4 workouts this week": the label of the streak board's progress dots. */
export const weekDotsLabel = (days: number, target: number) => `${days} of ${target} workouts this week`;

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
  if (i.kind === "pr" && i.pr?.type === "reps") {
    const gain = i.pr.gainReps ? ` (+${plural(i.pr.gainReps, "rep")})` : "";
    return ` hit a rep PR on ${i.pr.exerciseName}: ${kg(i.pr.weightKg)} × ${plural(i.pr.reps, "rep")}${gain}`;
  }
  if (i.kind === "pr" && i.pr) {
    const gain = i.pr.gainKg ? ` (${signedKg(i.pr.gainKg)})` : "";
    return ` hit a new PR on ${i.pr.exerciseName}: ${kg(i.pr.weightKg)} × ${plural(i.pr.reps, "rep")}${gain}`;
  }
  if (i.kind === "badge" && i.club) return ` joined the ${CLUB_LABEL[i.club]} 👑`;
  if (i.kind === "streak_week") return i.week && i.week > 1 ? ` hit the workout goal ${i.week} weeks in a row` : " hit the workout goal this week";
  if (i.kind === "protein_streak") return " hit the protein goal 7 days in a row";
  if (i.kind === "step_streak") return " hit the step goal 7 days in a row";
  if (i.kind === "workout_day") return " shared a workout";
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

// ---------------------------------------------------------------- share card (feature 016)

/** "Wed, 18 Nov". */
export function shareDate(d: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).formatToParts(new Date(`${d}T00:00:00Z`));
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")}, ${get("day")} ${get("month")}`;
}
export const exercisesCount = (n: number) => plural(n, "exercise");
export const stepsCount = (n: number) => plural(Math.round(n), "step");
export const moreRows = (n: number) => `+${nf.format(n)} more`;
/** "60 kg × 10", "22.5 kg per dumbbell × 10", "12 reps" (bodyweight), "5 min". */
export function shareRowValue(r: ShareRowDto): string {
  if (r.kind === "minutes") return minutes(r.minutes);
  if (r.top.weightKg === 0) return plural(r.top.reps, "rep");
  return `${w(r.top.weightKg, isDumbbell(r.exerciseId, r.name))} × ${nf.format(r.top.reps)}`;
}
export const shareRow = (r: ShareRowDto) => `${r.name} · ${shareRowValue(r)}`;
/** "82.5 kg × 5 (+2.5 kg)". */
export const sharePrValue = (p: { weightKg: number; reps: number; gainKg: number | null }) =>
  `${kg(p.weightKg)} × ${nf.format(p.reps)}${p.gainKg ? ` (${signedKg(p.gainKg)})` : ""}`;
export const NEW_PB = "New personal best";
/** "3 weeks in a row", else "2 of 4 workouts this week". */
export const shareStreak = (s: { weeks: number; weekDays: number; target: number }) => (s.weeks > 0 ? weeksInARow(s.weeks) : workoutsThisWeek(s.weekDays, s.target));
export const SHARE_SITE = "squadfit.roshansidequest.com";
export const SHARE_HINT = "Save the image, then add it to your Instagram Story.";
export const PHOTO_STAYS = "Your photo stays on your phone.";
export const PHOTO_ERROR = "Couldn't open this photo. Try a JPEG or a screenshot.";
export const HIDDEN_POST = "You're hidden from the squad, so you can't post.";

/* Feature 014: bodyweight card and chart. */
export const WEIGHT_COPY = {
  title: "Bodyweight",
  log: "Log weight",
  save: "Save",
  none: "No weigh-ins yet",
  emptyRange: "No weigh-ins in this period",
  average: "AVERAGE",
  range: "RANGE",
  weight: "WEIGHT",
  trend: "7-day trend",
  dayEntries: "Logged this day",
  dayEmpty: "Nothing logged this day yet",
  // Feature 017: squad view.
  me: "Me",
  squad: "Squad",
  squadTrend: "See the squad's trend",
  change: "CHANGE",
  squadEmpty: "Nobody sharing has 2 weigh-ins in this period yet",
  notSharing: "You're not sharing your weight trend, so the squad doesn't see your line.",
  shareInfo: "Members who share appear as kg gained or lost since their first weigh-in in the period, never their actual weight.",
} as const;

/** Signed kg change, always one decimal: "−1.3 kg", "+0.4 kg", "0.0 kg". */
export const weightChange = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)} kg`;

/** Always one decimal: "78.0 kg". */
export const weightKg = (n: number) => `${n.toFixed(1)} kg`;
export const weightRange = (min: number, max: number) => (min === max ? weightKg(min) : `${min.toFixed(1)}–${max.toFixed(1)} kg`);

const utcDate = (d: string) => new Date(`${d}T00:00:00Z`);
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...o, timeZone: "UTC" });
const dmy = fmt({ day: "numeric", month: "short", year: "numeric" });
const dm = fmt({ day: "numeric", month: "short" });
const wdmy = fmt({ weekday: "short", day: "numeric", month: "short", year: "numeric" });

/** "Tue 24 Nov 2026", "1–24 Nov 2026", "25 Oct – 23 Nov 2026", "1 Dec 2025 – 24 Nov 2026". */
export function weightSpan(start: string, end: string): string {
  if (start === end) return wdmy.format(utcDate(start)).replace(",", "");
  if (start.slice(0, 7) === end.slice(0, 7)) return `${+start.slice(8, 10)}–${dmy.format(utcDate(end))}`;
  if (start.slice(0, 4) === end.slice(0, 4)) return `${dm.format(utcDate(start))} – ${dmy.format(utcDate(end))}`;
  return `${dmy.format(utcDate(start))} – ${dmy.format(utcDate(end))}`;
}

/** Day chip label in the quick-log sheet. */
export function weightDayLabel(date: string, today: string, yesterday: string): string {
  if (date === today) return "Today";
  if (date === yesterday) return "Yesterday";
  return fmt({ weekday: "long" }).format(utcDate(date));
}

// ---------------------------------------------------------------- PR badge (feature 019)

type PrShown = { type: "weight" | "reps" | "e1rm"; weightKg: number; reps: number; value: number; gain: number };

/** "★ New PR · 82.5 kg (+2.5 kg)", "★ Rep PR · 80 kg × 10 (+2 reps)", "★ e1RM PR · ~98 kg (+3 kg)". */
export function prBadgeText(p: PrShown): string {
  if (p.type === "weight") return `★ New PR · ${kg(p.weightKg)} (${signedKg(p.gain)})`;
  if (p.type === "reps") return `★ Rep PR · ${kg(p.weightKg)} × ${nf.format(p.reps)} (+${plural(p.gain, "rep")})`;
  return `★ e1RM PR · ~${kg(p.value)} (${signedKg(p.gain)})`;
}

/** Screen-reader sentence, read once per new PR. */
export function prAnnounce(p: PrShown): string {
  if (p.type === "weight") return `New personal record, ${nf.format(p.weightKg)} kilograms`;
  if (p.type === "reps") return `New rep record, ${plural(p.reps, "rep")} at ${nf.format(p.weightKg)} kilograms`;
  return `New estimated max, about ${nf.format(p.value)} kilograms`;
}

export const baselineLine = (volumeKg: number) => `Baseline set · ${kg(volumeKg)} volume`;
export const BIG_JUMP_HINT = "Big jump — typo?";

/** "★ 1 PR · +1,450 kg lifted · 2-week streak"; zero parts are left out. */
export function prToast(o: { prs: number; volumeKg: number | null; streakWeeks: number; raidKg?: number }): string {
  return [
    o.prs > 0 ? `★ ${plural(o.prs, "PR")}` : null,
    o.volumeKg ? `+${kg(o.volumeKg)} lifted` : null,
    // Feature 021: only when this save added counted kg to a raid.
    o.raidKg ? `+${kg(o.raidKg)} to raid` : null,
    o.streakWeeks > 0 ? `${nf.format(o.streakWeeks)}-week streak` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// ---------------------------------------------------------------- squad volume raid (feature 021)

const raidDay = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone }).format(new Date(iso));

export const RAID_COPY = {
  newRaid: "New raid",
  history: "Raid history",
  manage: "Manage raid",
  cleared: "RAID CLEARED",
  sticker: "Raid Cleared",
  zeroYou: "You: 0 kg — any lift counts",
  info: "Every set you tick in the gym counts toward the squad's target. Nothing to join.",
  noHistory: "No finished raids yet.",
  lockedHint: "Locked while the raid is live, so it stays fair.",
} as const;

export const raidTotalLine = (totalKg: number, targetKg: number, pct: number) => `${num(totalKg)} / ${kg(targetKg)} · ${pct}%`;
export const raidYou = (youKg: number, pct: number, capped: boolean) => `You: ${kg(youKg)} (${pct}%)${capped ? " · capped" : ""}`;
/** Split bar (feature 021): your share of the squad total, and one member's tapped segment. */
export const raidYouShare = (youKg: number, sharePct: number, capped: boolean) => `You: ${kg(youKg)} · ${sharePct}% of the squad${capped ? " · capped" : ""}`;
export const raidSegment = (name: string, segKg: number, sessions: number) => `${name} · ${kg(segKg)} · ${sessions} ${sessions === 1 ? "session" : "sessions"}`;
export const raidOthers = "Others";
export const raidDaysLeft = (n: number) => (n <= 1 ? "Last day" : `${n} days left`);
export const raidNext = (name: string, startsAt: string, timeZone: string) => `Next raid: ${name} · starts ${raidDay(startsAt, timeZone)}`;
export const raidEnded = (pct: number) => `Raid ended · ${pct}%`;
export const raidCancelled = (reason: string | null) => (reason ? `Raid cancelled · ${reason}` : "Raid cancelled");
export const raidDates = (startsAt: string, endsAt: string, timeZone: string) =>
  `${raidDay(startsAt, timeZone)} – ${raidDay(new Date(Date.parse(endsAt) - 1).toISOString(), timeZone)}`;
export const raidsClearedLabel = (n: number) => (n > 1 ? `${RAID_COPY.sticker} ×${n}` : RAID_COPY.sticker);
export const raidStatusLabel = { draft: "Draft", scheduled: "Scheduled", live: "Live", won: "Cleared", ended: "Ended", cancelled: "Cancelled" } as const;
