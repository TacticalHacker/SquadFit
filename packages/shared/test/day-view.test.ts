import { describe, expect, it } from "vitest";
import { applyChange, buildDayView, type StoredEntry, type StoredCustomWorkout } from "../src/domain/day-view";
import { caloriesFor } from "../src/domain/calories";

const base = { date: "2026-11-11", today: "2026-11-11", timezone: "Asia/Kolkata" };
const custom = (id: string, name: string, m = 60, c = 400): StoredCustomWorkout => ({
  workoutId: id,
  name,
  defaultMinutes: m,
  defaultCalories: c,
});
const entry = (workoutId: string, name: string, rm: number, rc: number, minutes: number): StoredEntry => ({
  workoutId,
  name,
  rateMinutes: rm,
  rateCalories: rc,
  minutes,
  calories: caloriesFor(rm, rc, minutes),
});

describe("buildDayView", () => {
  it("lists standard, then custom A→Z, then orphan rows", () => {
    const view = buildDayView({
      ...base,
      customWorkouts: [custom("c-2", "Squash"), custom("c-1", "Badminton")],
      entries: [entry("c-gone", "Padel", 60, 500, 30)],
    });
    const ids = view.rows.map((r) => r.workoutId);
    expect(ids.slice(0, 12).every((i) => i.startsWith("std-"))).toBe(true);
    expect(ids.slice(12)).toEqual(["c-1", "c-2", "c-gone"]);
    const orphan = view.rows[14]!;
    expect(orphan).toMatchObject({ removed: true, isStandard: false, defaultMinutes: 60, defaultCalories: 500 });
    expect(orphan.entry).toEqual({ minutes: 30, calories: 250, rateMinutes: 60, rateCalories: 500 });
    expect(view.summary).toEqual({ totalMinutes: 30, totalCalories: 250 });
  });

  it("sets editable from the window", () => {
    expect(buildDayView({ ...base, date: "2026-11-09", customWorkouts: [], entries: [] }).editable).toBe(true);
    expect(buildDayView({ ...base, date: "2026-11-08", customWorkouts: [], entries: [] }).editable).toBe(false);
  });
});

describe("applyChange", () => {
  const empty = buildDayView({ ...base, customWorkouts: [], entries: [] });
  const row = (v: typeof empty, id: string) => v.rows.find((r) => r.workoutId === id)!;

  it("tick creates default entry and is idempotent", () => {
    const v = applyChange(empty, { type: "tick", workoutId: "std-running" });
    expect(row(v, "std-running").entry).toEqual({ minutes: 30, calories: 300, rateMinutes: 30, rateCalories: 300 });
    expect(v.summary).toEqual({ totalMinutes: 30, totalCalories: 300 });
    expect(applyChange(v, { type: "tick", workoutId: "std-running" })).toEqual(v);
  });

  it("untick removes", () => {
    const v = applyChange(applyChange(empty, { type: "tick", workoutId: "std-running" }), {
      type: "untick",
      workoutId: "std-running",
    });
    expect(v).toEqual(empty);
  });

  it("setMinutes recomputes from the entry's own rate", () => {
    const view = buildDayView({
      ...base,
      customWorkouts: [custom("c-1", "Badminton", 60, 800)],
      entries: [entry("c-1", "Badminton", 60, 400, 60)],
    });
    const v = applyChange(view, { type: "setMinutes", workoutId: "c-1", minutes: 30 });
    expect(row(v, "c-1").entry).toEqual({ minutes: 30, calories: 200, rateMinutes: 60, rateCalories: 400 });
    expect(v.summary).toEqual({ totalMinutes: 30, totalCalories: 200 });
  });

  it("matches a rebuild from server-stored entries", () => {
    let v = empty;
    v = applyChange(v, { type: "tick", workoutId: "std-running" });
    v = applyChange(v, { type: "tick", workoutId: "std-yoga" });
    v = applyChange(v, { type: "setMinutes", workoutId: "std-running", minutes: 45 });
    const rebuilt = buildDayView({
      ...base,
      customWorkouts: [],
      entries: [entry("std-running", "Running", 30, 300, 45), entry("std-yoga", "Yoga", 30, 90, 30)],
    });
    expect(v).toEqual(rebuilt);
    expect(v.summary).toEqual({ totalMinutes: 75, totalCalories: 540 });
  });
});
