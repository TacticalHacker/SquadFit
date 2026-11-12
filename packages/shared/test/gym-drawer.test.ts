import { describe, expect, it } from "vitest";
import { commitTyped, drawerReducer, drawerToBody, drawerTotals, initDrawer, type DrawerState } from "../src/domain/gym-drawer";

const strength = { kind: "strength" as const };
const cardio = { kind: "cardio" as const, rateMinutes: 20, rateCalories: 140 };
const saved = (weightKg: number, reps: number, n = 3, completed = true) =>
  Array.from({ length: n }, (_, i) => ({ setNumber: i + 1, weightKg, reps, completed }));

const run = (s: DrawerState, ...actions: Parameters<typeof drawerReducer>[1][]) => actions.reduce(drawerReducer, s);

describe("initDrawer", () => {
  it("defaults to 3 × 10 × 0 kg", () => {
    const s = initDrawer({ exercise: strength });
    expect(s.rows).toEqual([0, 1, 2].map(() => ({ weightKg: 0, reps: 10, completed: false, repsEdited: false })));
    expect(s.defaultReps).toBe(10);
    expect(s.dirty).toBe(false);
  });

  it("pre-fills from last time, nothing completed, nothing edited", () => {
    const s = initDrawer({ exercise: strength, last: { sets: saved(80, 8, 4) } });
    expect(s.rows).toHaveLength(4);
    expect(s.rows.every((r) => r.weightKg === 80 && r.reps === 8 && !r.completed && !r.repsEdited)).toBe(true);
    expect(s.defaultReps).toBe(8);
  });

  it("a saved entry wins over last time and keeps ticks", () => {
    const s = initDrawer({ exercise: strength, entry: { sets: saved(60, 10, 2) }, last: { sets: saved(80, 8) } });
    expect(s.rows).toHaveLength(2);
    expect(s.rows[0]).toMatchObject({ weightKg: 60, reps: 10, completed: true });
  });

  it("a draft wins over everything", () => {
    const draft = run(initDrawer({ exercise: strength }), { type: "addSet" });
    const s = initDrawer({ exercise: strength, draft, entry: { sets: saved(60, 10, 2) } });
    expect(s).toBe(draft);
  });

  it("cardio starts at 20 minutes or last time's minutes", () => {
    expect(initDrawer({ exercise: cardio }).minutes).toBe(20);
    expect(initDrawer({ exercise: cardio, last: { minutes: 35 } }).minutes).toBe(35);
    expect(initDrawer({ exercise: cardio, entry: { minutes: 25 }, last: { minutes: 35 } }).minutes).toBe(25);
  });
});

describe("drawerReducer", () => {
  it("addSet copies the last row (incl. edited state), not completed, max 20", () => {
    let s = run(initDrawer({ exercise: strength }), { type: "setWeight", index: 2, value: 80 }, { type: "setReps", index: 2, value: 8 }, { type: "toggleDone", index: 2 });
    s = drawerReducer(s, { type: "addSet" });
    expect(s.rows[3]).toEqual({ weightKg: 80, reps: 8, completed: false, repsEdited: true });
    for (let i = 0; i < 30; i++) s = drawerReducer(s, { type: "addSet" });
    expect(s.rows).toHaveLength(20);
  });

  it("removeSet drops the last row, min 1", () => {
    let s = initDrawer({ exercise: strength });
    s = run(s, { type: "removeSet" }, { type: "removeSet" }, { type: "removeSet" });
    expect(s.rows).toHaveLength(1);
  });

  it("default reps updates only rows the member did not edit", () => {
    let s = run(initDrawer({ exercise: strength }), { type: "setWeight", index: 2, value: 80 }, { type: "setReps", index: 2, value: 8 }, { type: "addSet" });
    s = run(s, { type: "defaultReps", delta: 1 }, { type: "defaultReps", delta: 1 });
    expect(s.defaultReps).toBe(12);
    expect(s.rows.map((r) => r.reps)).toEqual([12, 12, 8, 8]);
    s = drawerReducer(s, { type: "setDefaultReps", value: 5 });
    expect(s.rows.map((r) => r.reps)).toEqual([5, 5, 8, 8]);
  });

  it("default reps stays within 1–100", () => {
    let s = run(initDrawer({ exercise: strength }), { type: "setDefaultReps", value: 1 }, { type: "defaultReps", delta: -1 });
    expect(s.defaultReps).toBe(1);
    s = run(s, { type: "setDefaultReps", value: 100 }, { type: "defaultReps", delta: 1 });
    expect(s.defaultReps).toBe(100);
  });

  it("weight moves by 2.5 within 0–500", () => {
    let s = run(initDrawer({ exercise: strength }), { type: "weight", index: 0, delta: 1 }, { type: "weight", index: 0, delta: 1 });
    expect(s.rows[0]!.weightKg).toBe(5);
    s = run(s, { type: "weight", index: 0, delta: -1 }, { type: "weight", index: 0, delta: -1 }, { type: "weight", index: 0, delta: -1 });
    expect(s.rows[0]!.weightKg).toBe(0);
    s = run(s, { type: "setWeight", index: 0, value: 499 }, { type: "weight", index: 0, delta: 1 });
    expect(s.rows[0]!.weightKg).toBe(500);
  });

  it("reps move by 1 within 1–100 and mark the row edited", () => {
    let s = run(initDrawer({ exercise: strength }), { type: "reps", index: 1, delta: -1 });
    expect(s.rows[1]).toMatchObject({ reps: 9, repsEdited: true });
    s = run(s, { type: "setReps", index: 1, value: 1 }, { type: "reps", index: 1, delta: -1 });
    expect(s.rows[1]!.reps).toBe(1);
  });

  it("toggles completion and flips dirty", () => {
    const s0 = initDrawer({ exercise: strength });
    const s1 = drawerReducer(s0, { type: "toggleDone", index: 0 });
    expect(s1.rows[0]!.completed).toBe(true);
    expect(s1.dirty).toBe(true);
    expect(drawerReducer(s1, { type: "toggleDone", index: 0 }).rows[0]!.completed).toBe(false);
  });

  it("cardio minutes move by 5 within 1–600", () => {
    let s = run(initDrawer({ exercise: cardio }), { type: "minutes", delta: 1 });
    expect(s.minutes).toBe(25);
    s = run(s, { type: "setMinutes", value: 3 }, { type: "minutes", delta: -1 });
    expect(s.minutes).toBe(1);
  });
});

describe("commitTyped", () => {
  it("validates typed values with the shared parsers", () => {
    expect(commitTyped("weight", "62.3")).toEqual({ ok: false, message: expect.any(String) });
    expect(commitTyped("weight", "62,5")).toEqual({ ok: true, value: 62.5 });
    expect(commitTyped("reps", "0").ok).toBe(false);
    expect(commitTyped("reps", "12")).toEqual({ ok: true, value: 12 });
    expect(commitTyped("minutes", "45")).toEqual({ ok: true, value: 45 });
  });
});

describe("body and totals", () => {
  it("strength body numbers sets 1..n; totals match gymTotals", () => {
    const s = initDrawer({ exercise: strength, last: { sets: saved(80, 8) } });
    expect(drawerToBody(s)).toEqual({ sets: saved(80, 8, 3, false) });
    expect(drawerTotals(s, strength)).toEqual({ volumeKg: 1920, minutes: 8, calories: 45 });
  });

  it("cardio body is minutes; totals use the rate", () => {
    const s = initDrawer({ exercise: cardio, last: { minutes: 25 } });
    expect(drawerToBody(s)).toEqual({ minutes: 25 });
    expect(drawerTotals(s, cardio)).toEqual({ volumeKg: null, minutes: 25, calories: 175 });
  });
});
