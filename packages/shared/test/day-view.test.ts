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
  it("lists own workouts A→Z, then orphan rows; no built-in activities (feature 007)", () => {
    const view = buildDayView({
      ...base,
      customWorkouts: [custom("c-2", "Squash"), custom("c-1", "Badminton")],
      entries: [entry("c-gone", "Padel", 60, 500, 30)],
    });
    expect(view.rows.map((r) => r.workoutId)).toEqual(["c-1", "c-2", "c-gone"]);
    const orphan = view.rows[2]!;
    expect(orphan).toMatchObject({ removed: true, defaultMinutes: 60, defaultCalories: 500 });
    expect(orphan.entry).toEqual({ minutes: 30, calories: 250, rateMinutes: 60, rateCalories: 500, aiNote: null });
    expect(view.summary).toEqual({ totalMinutes: 30, totalCalories: 250 });
  });

  it("shows a past built-in activity entry as a removed row that still counts (FR-023)", () => {
    const view = buildDayView({ ...base, customWorkouts: [], entries: [entry("std-running", "Running", 30, 300, 30)] });
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0]).toMatchObject({ workoutId: "std-running", name: "Running", removed: true, entry: { minutes: 30, calories: 300 } });
    expect(view.summary).toEqual({ totalMinutes: 30, totalCalories: 300 });
    expect(buildDayView({ ...base, customWorkouts: [], entries: [] }).rows).toEqual([]);
  });

  it("sets editable from the window", () => {
    expect(buildDayView({ ...base, date: "2026-11-09", customWorkouts: [], entries: [] }).editable).toBe(true);
    expect(buildDayView({ ...base, date: "2026-11-08", customWorkouts: [], entries: [] }).editable).toBe(false);
  });
});

describe("applyChange", () => {
  const empty = buildDayView({ ...base, customWorkouts: [custom("c-run", "Running", 30, 300), custom("c-yoga", "Yoga", 30, 90)], entries: [] });
  const row = (v: typeof empty, id: string) => v.rows.find((r) => r.workoutId === id)!;

  it("tick creates default entry and is idempotent", () => {
    const v = applyChange(empty, { type: "tick", workoutId: "c-run" });
    expect(row(v, "c-run").entry).toEqual({ minutes: 30, calories: 300, rateMinutes: 30, rateCalories: 300, aiNote: null });
    expect(v.summary).toEqual({ totalMinutes: 30, totalCalories: 300 });
    expect(applyChange(v, { type: "tick", workoutId: "c-run" })).toEqual(v);
  });

  it("untick removes", () => {
    const v = applyChange(applyChange(empty, { type: "tick", workoutId: "c-run" }), { type: "untick", workoutId: "c-run" });
    expect(v).toEqual(empty);
  });

  it("setMinutes recomputes from the entry's own rate", () => {
    const view = buildDayView({
      ...base,
      customWorkouts: [custom("c-1", "Badminton", 60, 800)],
      entries: [entry("c-1", "Badminton", 60, 400, 60)],
    });
    const v = applyChange(view, { type: "setMinutes", workoutId: "c-1", minutes: 30 });
    expect(row(v, "c-1").entry).toEqual({ minutes: 30, calories: 200, rateMinutes: 60, rateCalories: 400, aiNote: null });
    expect(v.summary).toEqual({ totalMinutes: 30, totalCalories: 200 });
  });

  it("matches a rebuild from server-stored entries", () => {
    let v = empty;
    v = applyChange(v, { type: "tick", workoutId: "c-run" });
    v = applyChange(v, { type: "tick", workoutId: "c-yoga" });
    v = applyChange(v, { type: "setMinutes", workoutId: "c-run", minutes: 45 });
    const rebuilt = buildDayView({
      ...base,
      customWorkouts: [custom("c-run", "Running", 30, 300), custom("c-yoga", "Yoga", 30, 90)],
      entries: [entry("c-run", "Running", 30, 300, 45), entry("c-yoga", "Yoga", 30, 90, 30)],
    });
    expect(v).toEqual(rebuilt);
    expect(v.summary).toEqual({ totalMinutes: 75, totalCalories: 540 });
  });
});

describe("buildDayView with gym entries (feature 006)", () => {
  const gym = (id: string, minutes: number, calories: number, createdAt: string): StoredEntry => ({
    workoutId: id,
    name: id,
    rateMinutes: 5,
    rateCalories: 30,
    minutes,
    calories,
    kind: "gym",
    muscleGroup: "chest",
    exerciseKind: "strength",
    sets: [{ setNumber: 1, reps: 10, weightKg: 60, completed: true }],
    volumeKg: 600,
    createdAt,
    updatedAt: createdAt,
  });

  it("puts gym entries in `gym` (oldest first), never in rows, and sums both", () => {
    const view = buildDayView({
      ...base,
      customWorkouts: [],
      entries: [entry("std-running", "Running", 30, 300, 30), gym("gx-deadlift", 8, 45, "2026-11-11T09:00:00Z"), gym("gx-bench-press", 3, 15, "2026-11-11T08:00:00Z")],
    });
    expect(view.rows.some((r) => r.workoutId.startsWith("gx-"))).toBe(false);
    expect(view.gym.map((g) => g.exerciseId)).toEqual(["gx-bench-press", "gx-deadlift"]);
    expect(view.gym[0]).toMatchObject({ name: "gx-bench-press", muscleGroup: "chest", exerciseKind: "strength", volumeKg: 600, minutes: 3, calories: 15 });
    expect(view.summary).toEqual({ totalMinutes: 41, totalCalories: 360 });
    expect(view.gymMinutes).toBe(11);
  });

  it("a day without gym entries has an empty gym list", () => {
    const view = buildDayView({ ...base, customWorkouts: [], entries: [entry("std-yoga", "Yoga", 30, 90, 30)] });
    expect(view.gym).toEqual([]);
    expect(view.gymMinutes).toBe(0);
  });

  it("applyChange keeps gym entries and their totals", () => {
    const view = buildDayView({ ...base, customWorkouts: [custom("c-run", "Running", 30, 300)], entries: [gym("gx-deadlift", 8, 45, "t")] });
    const next = applyChange(view, { type: "tick", workoutId: "c-run" });
    expect(next.gym).toHaveLength(1);
    expect(next.summary).toEqual({ totalMinutes: 38, totalCalories: 345 });
  });
});

describe("aiNote on entries (feature 007)", () => {
  it("carries the AI note into the row entry and the summary uses the stored calories", () => {
    const view = buildDayView({
      ...base,
      customWorkouts: [custom("c-1", "Padel")],
      entries: [{ ...entry("c-1", "Padel", 60, 400, 60), calories: 520, aiNote: "8 MET @ 78kg" }],
    });
    const row = view.rows.find((r) => r.workoutId === "c-1")!;
    expect(row.entry).toMatchObject({ calories: 520, aiNote: "8 MET @ 78kg" });
    expect(view.summary.totalCalories).toBe(520);
  });
  it("is null without a note, and a minutes change clears it", () => {
    const view = buildDayView({
      ...base,
      customWorkouts: [custom("c-1", "Padel")],
      entries: [{ ...entry("c-1", "Padel", 60, 400, 60), aiNote: "x" }],
    });
    const changed = applyChange(view, { type: "setMinutes", workoutId: "c-1", minutes: 30 });
    expect(changed.rows.find((r) => r.workoutId === "c-1")!.entry).toMatchObject({ minutes: 30, calories: 200, aiNote: null });
    const plain = buildDayView({ ...base, customWorkouts: [custom("c-1", "Padel")], entries: [entry("c-1", "Padel", 60, 400, 60)] });
    expect(plain.rows.find((r) => r.workoutId === "c-1")!.entry!.aiNote).toBeNull();
  });
});
