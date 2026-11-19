import { describe, expect, it } from "vitest";
import { addDays } from "../src/domain/day";
import {
  buildMemberStats,
  e1rm,
  weekVolumes,
  rankRows,
  streakFigures,
  type SquadEntry,
  type SquadStats,
} from "../src/domain/squad";

const TODAY = "2026-11-18"; // Wednesday; the current week starts 2026-11-16
const NOW = "2026-11-18T10:00:00.000Z";

const build = (entries: SquadEntry[], prev: SquadStats | null = null, opts: Partial<Parameters<typeof buildMemberStats>[2]> = {}) =>
  buildMemberStats(entries, prev, { weeklyTarget: 3, today: TODAY, nowIso: NOW, ...opts });

const activity = (date: string, id = "c-walk"): SquadEntry => ({ date, workoutId: id, name: "Walk" });
const lift = (date: string, sets: [number, number, boolean?][], id = "gx-bench-press", extra: Partial<SquadEntry> = {}): SquadEntry => ({
  date,
  workoutId: id,
  name: id,
  kind: "gym",
  exerciseKind: "strength",
  sets: sets.map(([weightKg, reps, completed], i) => ({ setNumber: i + 1, weightKg, reps, completed: completed ?? true })),
  ...extra,
});
/** `n` activity days starting on the Monday `ws`. */
const days = (ws: string, n: number) => Array.from({ length: n }, (_, i) => activity(addDays(ws, i)));

describe("weekly streak", () => {
  it("counts consecutive hit weeks and keeps an unfinished week from breaking it", () => {
    const { stats } = build([...days("2026-10-26", 3), ...days("2026-11-02", 3), ...days("2026-11-09", 3), ...days("2026-11-16", 1)]);
    expect(streakFigures(stats.weeks, TODAY, 3)).toEqual({ current: 3, best: 3, weekDays: 1, target: 3 });
  });

  it("adds the current week once it is hit", () => {
    const { stats } = build([...days("2026-11-09", 3), ...days("2026-11-16", 3)]);
    expect(streakFigures(stats.weeks, TODAY, 3).current).toBe(2);
  });

  it("a missed ended week resets the current streak but keeps the best", () => {
    const { stats } = build([...days("2026-10-12", 3), ...days("2026-10-19", 3), ...days("2026-10-26", 3), ...days("2026-11-09", 3)]);
    expect(streakFigures(stats.weeks, TODAY, 3)).toMatchObject({ current: 1, best: 3 });
  });

  it("counts several entries on one day once", () => {
    const { stats } = build([activity("2026-11-09"), activity("2026-11-09", "c-run"), activity("2026-11-10")]);
    expect(stats.weeks["2026-11-09"]).toEqual({ days: 2, target: 3 });
  });

  it("counts gym cardio and strength with a completed set, not strength with none", () => {
    const cardio: SquadEntry = { date: "2026-11-09", workoutId: "gx-stairmaster", name: "Stairmaster", kind: "gym", exerciseKind: "cardio" };
    const { stats } = build([cardio, lift("2026-11-10", [[60, 8, true]]), lift("2026-11-11", [[60, 8, false]])]);
    expect(stats.weeks["2026-11-09"]?.days).toBe(2);
  });

  it("keeps the target an ended week was stored with when the profile target changes", () => {
    const first = build(days("2026-11-09", 3)).stats;
    const { stats } = build(days("2026-11-09", 3), first, { weeklyTarget: 4 });
    expect(stats.weeks["2026-11-09"]).toEqual({ days: 3, target: 3 });
    expect(streakFigures(stats.weeks, TODAY, 4).current).toBe(1);
  });
});

describe("e1RM and PRs", () => {
  it("uses Epley for 1-10 reps only", () => {
    expect(e1rm(100, 10)).toBe(133.3);
    expect(e1rm(100, 11)).toBeNull();
  });

  it("treats the first log of an exercise as a baseline, not a PR", () => {
    const { stats, events } = build([lift("2026-11-16", [[60, 8]])]);
    expect(stats.lifts["gx-bench-press"]?.prDays).toEqual([]);
    expect(events.some((e) => e.kind === "pr")).toBe(false);
  });

  it("records one PR for a later heavier set", () => {
    const { stats, events } = build([lift("2026-11-14", [[60, 8]]), lift("2026-11-16", [[62.5, 3]])]);
    expect(stats.lifts["gx-bench-press"]?.prDays).toEqual([{ date: "2026-11-16", weightKg: 62.5, reps: 3, e1rm: 68.8, gainKg: 2.5 }]);
    expect(events.find((e) => e.kind === "pr")?.id).toBe("pr#gx-bench-press#2026-11-16");
  });

  it("records a PR when only the estimate improves", () => {
    const { stats } = build([lift("2026-11-14", [[100, 1]]), lift("2026-11-16", [[90, 8]])]);
    expect(stats.lifts["gx-bench-press"]?.prDays).toHaveLength(1);
  });

  it("lets a set of more than 10 reps set a heaviest-weight PR without an estimate", () => {
    const { stats } = build([lift("2026-11-14", [[60, 8]]), lift("2026-11-16", [[70, 11]])]);
    expect(stats.lifts["gx-bench-press"]?.prDays[0]).toMatchObject({ weightKg: 70, e1rm: null });
  });

  it("ignores sets that are not completed or have no weight", () => {
    const { stats } = build([lift("2026-11-14", [[60, 8]]), lift("2026-11-15", [[100, 5, false]]), lift("2026-11-16", [[0, 10]])]);
    expect(stats.lifts["gx-bench-press"]?.prDays).toEqual([]);
  });
});

describe("unusual jumps", () => {
  const base = lift("2026-11-14", [[80, 5]], "gx-barbell-squat");

  it("flags a set more than 50% and 20 kg above the best, and excludes it", () => {
    const { stats } = build([base, lift("2026-11-16", [[125, 1]], "gx-barbell-squat")]);
    const sq = stats.lifts["gx-barbell-squat"]!;
    expect(sq.prDays).toEqual([]);
    expect(sq.best?.weightKg).toBe(80);
    expect(stats.flags).toEqual([{ date: "2026-11-16", exerciseId: "gx-barbell-squat" }]);
  });

  it("does not flag a big relative jump on a light lift", () => {
    const { stats } = build([lift("2026-11-14", [[20, 10]]), lift("2026-11-16", [[32.5, 5]])]);
    expect(stats.flags).toEqual([]);
    expect(stats.lifts["gx-bench-press"]?.prDays).toHaveLength(1);
  });

  it("counts a confirmed set", () => {
    const { stats } = build([base, lift("2026-11-16", [[125, 1]], "gx-barbell-squat", { jumpConfirmedAt: NOW })]);
    expect(stats.flags).toEqual([]);
    expect(stats.lifts["gx-barbell-squat"]?.prDays).toHaveLength(1);
  });

  it("trusts history saved before trustedBefore", () => {
    const old = lift("2026-11-16", [[125, 1]], "gx-barbell-squat", { updatedAt: "2026-01-01T00:00:00.000Z" });
    const { stats } = build([base, old], null, { trustedBefore: "2026-06-01T00:00:00.000Z" });
    expect(stats.flags).toEqual([]);
    expect(stats.lifts["gx-barbell-squat"]?.prDays).toHaveLength(1);
  });

  it("never flags the first log", () => {
    expect(build([lift("2026-11-16", [[300, 1]])]).stats.flags).toEqual([]);
  });
});

describe("feed events", () => {
  it("emits first workout and numbers consecutive streak weeks", () => {
    const { events } = build([...days("2026-11-02", 3), ...days("2026-11-09", 3)]);
    expect(events.find((e) => e.id === "first")).toBeTruthy();
    expect(events.find((e) => e.id === "wk#2026-11-02")?.payload).toEqual({ week: 1 });
    expect(events.find((e) => e.id === "wk#2026-11-09")?.payload).toEqual({ week: 2 });
  });

  it("gives the same ids when rebuilt from the same entries, and skips seeded ones", () => {
    const entries = [...days("2026-11-09", 3)];
    const a = build(entries);
    const b = build(entries, a.stats);
    expect(b.events.map((e) => e.id)).toEqual(a.events.map((e) => e.id));
    const seeded = build(entries, { ...a.stats, seededEventIds: ["first"] });
    expect(seeded.events.some((e) => e.id === "first")).toBe(false);
  });
});

describe("months", () => {
  it("buckets workout days and lifts improved by the month of the entry date", () => {
    const { stats } = build([lift("2026-10-31", [[100, 5]]), lift("2026-11-01", [[100, 6], [50, 10]]), activity("2026-11-01"), activity("2026-11-02")]);
    expect(stats.months).toEqual({ "2026-10": { workoutDays: 1, liftsImproved: 0 }, "2026-11": { workoutDays: 2, liftsImproved: 1 } });
    expect("dayVolumeKg" in stats).toBe(false);
  });

  it("counts a session that beats the previous one: more weight at the same or more reps, or more reps at the same weight", () => {
    const sessions = (top: [number, number][], id = "gx-bench-press") => top.map(([w, r], i) => lift(`2026-11-0${i + 1}`, [[w, r]], id));
    const improved = (top: [number, number][]) => build(sessions(top)).stats.months["2026-11"]?.liftsImproved;
    expect(improved([[60, 8], [62.5, 8], [62.5, 9], [65, 10]])).toBe(3); // first session is a baseline
    expect(improved([[60, 8], [62.5, 6]])).toBe(0); // more weight but fewer reps
    expect(improved([[60, 8], [60, 8]])).toBe(0); // same session again
    expect(improved([[60, 8], [55, 12], [57.5, 12]])).toBe(1); // compares with the previous session, not the best ever
    // Cardio and other exercises never count, and each exercise compares only with itself.
    const cardio: SquadEntry = { date: "2026-11-02", workoutId: "gx-stairmaster", name: "Stairmaster", kind: "gym", exerciseKind: "cardio" };
    expect(build([...sessions([[60, 8]]), lift("2026-11-02", [[100, 5]], "gx-deadlift"), cardio]).stats.months["2026-11"]?.liftsImproved).toBe(0);
  });

  it("keeps each lift's best estimate per month, without flagged sets", () => {
    const { stats } = build([lift("2026-10-20", [[100, 1]]), lift("2026-10-27", [[90, 1]]), lift("2026-11-03", [[200, 1]]), lift("2026-11-04", [[102, 1]])]);
    expect(stats.lifts["gx-bench-press"]?.monthBests).toEqual({
      "2026-10": { e1rm: 103.3, date: "2026-10-20" },
      "2026-11": { e1rm: 105.4, date: "2026-11-04" },
    });
  });

  it("puts the gain over the previous best on PR events", () => {
    const { events } = build([lift("2026-11-02", [[100, 1]]), lift("2026-11-09", [[110, 1]])]);
    expect(events.find((e) => e.id === "pr#gx-bench-press#2026-11-09")?.payload.gainKg).toBe(10.4);
  });
});

describe("weekVolumes", () => {
  it("sums working sets this week (Mon–today) and all of last week", () => {
    // TODAY is Wednesday 18 Nov: this week = 16–18 Nov, last week = 9–15 Nov.
    const v = weekVolumes([lift("2026-11-08", [[100, 5]]), lift("2026-11-09", [[100, 5]]), lift("2026-11-15", [[50, 10, false]]), lift("2026-11-16", [[60, 10]])], TODAY);
    expect(v).toEqual({ thisWeek: 600, lastWeek: 500 });
  });
});

describe("club badges", () => {
  const big3 = (date: string, bench: number, squat: number, dead: number) => [
    lift(date, [[bench, 1]], "gx-bench-press"),
    lift(date, [[squat, 1]], "gx-barbell-squat"),
    lift(date, [[dead, 1]], "gx-deadlift"),
  ];
  // e1rm(w, 1) = w × 1.0333, so 300 kg of single reps is ~310 kg estimated.
  it("holds each club from the first date the estimated Big 3 met it, with one event each", () => {
    const { stats, events } = build([...big3("2026-11-02", 60, 80, 70), ...big3("2026-11-09", 90, 110, 100)]);
    expect(stats.badges).toEqual({ club225: "2026-11-09", club300: "2026-11-09" });
    expect(events.filter((e) => e.kind === "badge").map((e) => e.id)).toEqual(["badge#club225", "badge#club300"]);
  });

  it("needs all three lifts", () => {
    expect(build([lift("2026-11-02", [[200, 1]], "gx-bench-press"), lift("2026-11-02", [[200, 1]], "gx-deadlift")]).stats.badges).toEqual({});
  });

  it("is identical when rebuilt and disappears when the lifts no longer reach it", () => {
    const entries = big3("2026-11-09", 90, 110, 100);
    const a = build(entries);
    expect(build(entries, a.stats).events.filter((e) => e.kind === "badge")).toEqual(a.events.filter((e) => e.kind === "badge"));
    const edited = build(big3("2026-11-09", 60, 80, 70), a.stats);
    expect(edited.stats.badges).toEqual({});
    expect(edited.events.some((e) => e.kind === "badge")).toBe(false);
  });
});

describe("rankRows", () => {
  it("ties share a rank and the next rank skips", () => {
    const rows = [
      { name: "Zed", a: 3, b: 5 },
      { name: "Amy", a: 3, b: 5 },
      { name: "Bob", a: 2, b: 9 },
    ];
    const ranked = rankRows(rows, (r) => [r.a, r.b], (r) => r.name);
    expect(ranked.map((r) => [r.name, r.rank])).toEqual([
      ["Amy", 1],
      ["Zed", 1],
      ["Bob", 3],
    ]);
  });
});
