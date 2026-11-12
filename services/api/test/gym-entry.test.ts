import { describe, expect, it } from "vitest";
import { handle as foodGet } from "../src/handlers/food-get";
import { handle as workoutsGet } from "../src/handlers/workouts-get";
import { handle as summaryGet } from "../src/handlers/workouts-summary-get";
import { makeDeps, makeEvent, parse, seedActivities, seedProfile } from "./fakes";
import { exercise, gymDelete, gymGet, gymPut, sets } from "./gym-helpers";

const setup = async (now = "2026-11-11T10:00:00.000Z") => {
  const ctx = makeDeps(now);
  await seedProfile(ctx.profiles);
  return ctx;
};
const own = (id: string, name = "Hip Thrust", extra = {}) => ({ exerciseId: id, name, group: "legs" as const, createdAt: "t", updatedAt: "t", ...extra });

describe("PUT gym entry", () => {
  it("stores server-computed totals and returns the save result", async () => {
    const { deps, gym, workouts } = await setup();
    const r = await gymPut(deps, "2026-11-11", "gx-bench-press", { sets: sets(3, 60, 10, true) });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ date: "2026-11-11", editable: true, exerciseId: "gx-bench-press", summary: { totalMinutes: 8, totalCalories: 45 } });
    expect(r.body.entry).toMatchObject({ name: "Bench Press", muscleGroup: "chest", exerciseKind: "strength", volumeKg: 1800, minutes: 8, calories: 45 });
    expect(r.body).not.toHaveProperty("exercises");
    expect(gym.lastQueries).toBe(0);
    const stored = await workouts.getEntry("user-1", "2026-11-11", "gx-bench-press");
    expect(stored).toMatchObject({ kind: "gym", rateMinutes: 5, rateCalories: 30, volumeKg: 1800 });
  });

  it("rejects client totals, wrong body kind and bad sets with 400", async () => {
    const { deps, workouts } = await setup();
    for (const [id, body] of [
      ["gx-bench-press", { sets: sets(1, 60, 10), totalVolumeKg: 600 }],
      ["gx-bench-press", { sets: sets(1, 60, 10), calories: 999 }],
      ["gx-bench-press", { minutes: 20 }],
      ["gx-stairmaster", { sets: sets(1, 0, 10) }],
      ["gx-bench-press", { sets: sets(1, 62.3, 10) }],
    ] as const) {
      const r = await gymPut(deps, "2026-11-11", id, body);
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe("VALIDATION_FAILED");
    }
    expect(workouts.entries.size).toBe(0);
  });

  it("logs cardio as minutes with the exercise rate", async () => {
    const { deps } = await setup();
    const r = await gymPut(deps, "2026-11-11", "gx-incline-treadmill-walk", { minutes: 25 });
    expect(r.body.entry).toMatchObject({ exerciseKind: "cardio", sets: null, volumeKg: null, minutes: 25, calories: 175 });
  });

  it("404 for unknown, other member's and removed own exercises without an entry", async () => {
    const { deps, gym } = await setup();
    await gym.putOwnExercise("user-2", own("gc-other"));
    await gym.putOwnExercise("user-1", own("gc-gone", "Gone", { removedAt: "t" }));
    for (const id of ["gx-nope", "gc-other", "gc-gone", "std-running"]) {
      const r = await gymPut(deps, "2026-11-11", id, { sets: sets(1, 10, 10) });
      expect(r.status).toBe(404);
    }
  });

  it("re-save replaces sets, keeps createdAt, and refreshes a renamed own exercise's name", async () => {
    const { deps, gym, workouts, setNow } = await setup();
    await gym.putOwnExercise("user-1", own("gc-1"));
    await gymPut(deps, "2026-11-11", "gc-1", { sets: sets(3, 60, 10) });
    const first = await workouts.getEntry("user-1", "2026-11-11", "gc-1");
    await gym.updateOwnExercise("user-1", "gc-1", { name: "Barbell Hip Thrust", group: "legs" }, "t2");
    setNow("2026-11-11T11:00:00.000Z");
    const r = await gymPut(deps, "2026-11-11", "gc-1", { sets: sets(1, 100, 5) });
    expect(r.body.entry).toMatchObject({ name: "Barbell Hip Thrust", volumeKg: 500, minutes: 3, calories: 15 });
    const after = await workouts.getEntry("user-1", "2026-11-11", "gc-1");
    expect(after?.createdAt).toBe(first?.createdAt);
    expect(after?.sets).toHaveLength(1);
  });

  it("a removed own exercise can be re-saved on a logged day, keeping its stored name", async () => {
    const { deps, gym } = await setup();
    await gym.putOwnExercise("user-1", own("gc-1"));
    await gymPut(deps, "2026-11-11", "gc-1", { sets: sets(3, 60, 10) });
    await gym.markOwnRemoved("user-1", "gc-1", "t");
    const r = await gymPut(deps, "2026-11-11", "gc-1", { sets: sets(2, 60, 10) });
    expect(r.status).toBe(200);
    expect(r.body.entry).toMatchObject({ name: "Hip Thrust", muscleGroup: "legs", minutes: 5 });
    expect((await gymPut(deps, "2026-11-10", "gc-1", { sets: sets(2, 60, 10) })).status).toBe(404);
  });

  it("409 DAY_LOCKED three days back, 400 in the future", async () => {
    const { deps, workouts } = await setup();
    const locked = await gymPut(deps, "2026-11-08", "gx-deadlift", { sets: sets(1, 100, 5) });
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe("DAY_LOCKED");
    expect((await gymPut(deps, "2026-11-12", "gx-deadlift", { sets: sets(1, 100, 5) })).status).toBe(400);
    expect((await gymPut(deps, "2026-11-09", "gx-deadlift", { sets: sets(1, 100, 5) })).status).toBe(200);
    expect(workouts.entries.size).toBe(1);
  });

  it("409 PROFILE_REQUIRED without a profile", async () => {
    const { deps } = makeDeps();
    expect((await gymPut(deps, "2026-11-11", "gx-deadlift", { sets: sets(1, 100, 5) })).body.error.code).toBe("PROFILE_REQUIRED");
  });
});

describe("DELETE gym entry", () => {
  it("removes it, is idempotent, and only takes gym ids", async () => {
    const { deps, workouts } = await setup();
    await gymPut(deps, "2026-11-11", "gx-deadlift", { sets: sets(3, 100, 5) });
    const r = await gymDelete(deps, "2026-11-11", "gx-deadlift");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ entry: null, summary: { totalMinutes: 0, totalCalories: 0 } });
    expect(workouts.entries.size).toBe(0);
    expect((await gymDelete(deps, "2026-11-11", "gx-deadlift")).status).toBe(200);
    expect((await gymDelete(deps, "2026-11-11", "std-running")).status).toBe(404);
    expect((await gymDelete(deps, "2026-11-07", "gx-deadlift")).status).toBe(409);
  });
});

describe("gym entries count once in every total (FR-015)", () => {
  it("day view, summary range and food ledger", async () => {
    const { deps, workouts } = await setup();
    await workoutsGet(makeEvent({}), deps);
    const { handle: tick } = await import("../src/handlers/entry-put");
    await seedActivities(workouts);
    await tick(makeEvent({ pathParameters: { date: "2026-11-11", workoutId: "c-run" } }), deps);
    await gymPut(deps, "2026-11-11", "gx-bench-press", { sets: sets(3, 80, 8) });

    const day = parse(await workoutsGet(makeEvent({}), deps));
    expect(day.body.summary).toEqual({ totalMinutes: 38, totalCalories: 345 });
    expect(day.body.gymMinutes).toBe(8);
    expect(day.body.gym).toHaveLength(1);
    expect(day.body.rows.some((r: { workoutId: string }) => r.workoutId === "gx-bench-press")).toBe(false);

    const range = parse(await summaryGet(makeEvent({ queryStringParameters: { from: "2026-11-11", to: "2026-11-11" } }), deps));
    expect(range.body.days).toEqual([{ date: "2026-11-11", totalMinutes: 38, totalCalories: 345 }]);

    const food = parse(await foodGet(makeEvent({}), deps));
    expect(food.body.ledger.burned).toBe(345);
  });
});

describe("privacy (FR-022, SC-007)", () => {
  it("another member can neither see nor change my gym data", async () => {
    const { deps, profiles, gym } = await setup();
    await seedProfile(profiles, "user-2", "Asia/Kolkata", "bob");
    await gym.putOwnExercise("user-1", own("gc-mine"));
    await gymPut(deps, "2026-11-11", "gx-deadlift", { sets: sets(3, 100, 5) });

    const theirs = await gymGet(deps, "2026-11-11", "user-2");
    expect(exercise(theirs, "gx-deadlift")?.entry).toBeNull();
    expect(exercise(theirs, "gc-mine")).toBeUndefined();
    expect(theirs.body.summary).toEqual({ totalMinutes: 0, totalCalories: 0 });

    expect((await gymPut(deps, "2026-11-11", "gc-mine", { sets: sets(1, 1, 1) }, "user-2")).status).toBe(404);
    await gymDelete(deps, "2026-11-11", "gx-deadlift", "user-2");
    expect(exercise(await gymGet(deps, "2026-11-11"), "gx-deadlift")?.entry).not.toBeNull();
  });
});

describe("gym save clears an AI adjustment (feature 007, FR-013)", () => {
  it("drops aiNote and restores the app estimate", async () => {
    const ctx = makeDeps();
    await seedProfile(ctx.profiles);
    await gymPut(ctx.deps, "2026-11-11", "gx-bench-press", { sets: sets(3, 60, 8, true) });
    const before = (await ctx.workouts.getEntry("user-1", "2026-11-11", "gx-bench-press"))!;
    await ctx.workouts.setAiAdjustment("user-1", "2026-11-11", "gx-bench-press", { minutes: 14, calories: 62, aiNote: "x" }, before.updatedAt, "t2");
    const r = await gymPut(ctx.deps, "2026-11-11", "gx-bench-press", { sets: sets(2, 60, 8, true) });
    expect(r.body.entry).toMatchObject({ calories: 30, aiNote: null });
    expect((await ctx.workouts.getEntry("user-1", "2026-11-11", "gx-bench-press"))?.aiNote).toBeUndefined();
  });
});
