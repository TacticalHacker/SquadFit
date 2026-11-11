import { describe, expect, it } from "vitest";
import { handle } from "../src/handlers/entry-put";
import { makeDeps, makeEvent, parse, seedProfile } from "./fakes";

const put = (deps: Parameters<typeof handle>[1], date: string, workoutId: string, body?: unknown, sub = "user-1") =>
  handle(makeEvent({ sub, pathParameters: { date, workoutId }, ...(body !== undefined ? { body } : {}) }), deps).then(parse);

const setup = async (now = "2026-11-11T10:00:00.000Z") => {
  const ctx = makeDeps(now);
  await seedProfile(ctx.profiles);
  return ctx;
};
type Row = { workoutId: string; entry: { minutes: number; calories: number } | null };
const row = (r: { body: { rows: Row[] } }, id: string) => r.body.rows.find((x) => x.workoutId === id)!;
const custom = (id: string, name = "Badminton", m = 60, c = 400) => ({ workoutId: id, name, defaultMinutes: m, defaultCalories: c, createdAt: "t", updatedAt: "t" });

describe("PUT entry: tick", () => {
  it("creates with defaults and snapshots", async () => {
    const { deps, workouts } = await setup();
    const r = await put(deps, "2026-11-11", "std-running");
    expect(r.status).toBe(200);
    expect(row(r, "std-running").entry).toMatchObject({ minutes: 30, calories: 300 });
    expect(r.body.summary).toEqual({ totalMinutes: 30, totalCalories: 300 });
    const stored = await workouts.getEntry("user-1", "2026-11-11", "std-running");
    expect(stored).toMatchObject({ name: "Running", rateMinutes: 30, rateCalories: 300, date: "2026-11-11" });
  });

  it("is idempotent", async () => {
    const { deps } = await setup();
    await put(deps, "2026-11-11", "std-running");
    const r = await put(deps, "2026-11-11", "std-running");
    expect(row(r, "std-running").entry).toMatchObject({ minutes: 30, calories: 300 });
    expect(r.body.summary.totalMinutes).toBe(30);
  });

  it("404 for unknown, other user's, and removed custom workouts", async () => {
    const { deps, workouts } = await setup();
    await workouts.putCustomWorkout("user-2", custom("c-other"));
    await workouts.putCustomWorkout("user-1", { ...custom("c-gone"), removedAt: "t" });
    for (const id of ["std-nope", "c-other", "c-gone"]) {
      const r = await put(deps, "2026-11-11", id);
      expect(r.status).toBe(404);
      expect(r.body.error.code).toBe("NOT_FOUND");
    }
  });

  it("ticks an active custom workout", async () => {
    const { deps, workouts } = await setup();
    await workouts.putCustomWorkout("user-1", custom("c-1"));
    const r = await put(deps, "2026-11-11", "c-1");
    expect(row(r, "c-1").entry).toMatchObject({ minutes: 60, calories: 400 });
  });

  it("409 DAY_LOCKED three days back, 400 for future, nothing stored", async () => {
    const { deps, workouts } = await setup();
    const locked = await put(deps, "2026-11-08", "std-running");
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe("DAY_LOCKED");
    expect((await put(deps, "2026-11-12", "std-running")).status).toBe(400);
    expect(workouts.entries.size).toBe(0);
  });

  it("window edges: today-2 ok; after midnight it locks", async () => {
    const { deps, setNow } = await setup();
    expect((await put(deps, "2026-11-09", "std-running")).status).toBe(200);
    setNow("2026-11-12T10:00:00.000Z");
    expect((await put(deps, "2026-11-09", "std-yoga")).status).toBe(409);
  });

  it("stores the entry under the user's local date (Kolkata vs LA)", async () => {
    const { deps, profiles, workouts, setNow } = await setup();
    await seedProfile(profiles, "user-2", "America/Los_Angeles", "bob");
    setNow("2026-11-11T20:00:00.000Z");
    expect((await put(deps, "2026-11-12", "std-running", undefined, "user-1")).status).toBe(200);
    expect((await put(deps, "2026-11-12", "std-running", undefined, "user-2")).status).toBe(400);
    expect((await put(deps, "2026-11-11", "std-running", undefined, "user-2")).status).toBe(200);
    expect(await workouts.getEntry("user-1", "2026-11-12", "std-running")).not.toBeNull();
  });
});

describe("PUT entry: minutes", () => {
  it("updates minutes and scales calories", async () => {
    const { deps } = await setup();
    await put(deps, "2026-11-11", "std-running");
    const r = await put(deps, "2026-11-11", "std-running", { minutes: 45 });
    expect(row(r, "std-running").entry).toMatchObject({ minutes: 45, calories: 450 });
  });

  it("uses the entry's own rate even if the workout was edited", async () => {
    const { deps, workouts } = await setup();
    await workouts.putCustomWorkout("user-1", custom("c-1", "Badminton", 60, 400));
    await put(deps, "2026-11-11", "c-1");
    await workouts.updateCustomWorkout("user-1", "c-1", { name: "Badminton", defaultMinutes: 60, defaultCalories: 800 }, "t");
    const r = await put(deps, "2026-11-11", "c-1", { minutes: 30 });
    expect(row(r, "c-1").entry).toMatchObject({ minutes: 30, calories: 200 });
  });

  it("creates with given minutes when no entry exists", async () => {
    const { deps } = await setup();
    const r = await put(deps, "2026-11-11", "std-strength", { minutes: 90 });
    expect(row(r, "std-strength").entry).toMatchObject({ minutes: 90, calories: 440 });
  });

  it("rejects bad minutes and leaves the entry unchanged", async () => {
    const { deps } = await setup();
    await put(deps, "2026-11-11", "std-running", { minutes: 45 });
    for (const m of [0, 601, 12.5, "30", -5]) {
      const r = await put(deps, "2026-11-11", "std-running", { minutes: m });
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe("VALIDATION_FAILED");
      expect(r.body.error.fields.minutes).toBe("Minutes must be a whole number from 1 to 600");
    }
    const r = await put(deps, "2026-11-11", "std-running");
    expect(row(r, "std-running").entry?.minutes).toBe(45);
  });

  it("can edit an entry whose custom workout was removed", async () => {
    const { deps, workouts } = await setup();
    await workouts.putCustomWorkout("user-1", custom("c-1"));
    await put(deps, "2026-11-11", "c-1");
    await workouts.markCustomRemoved("user-1", "c-1", "t");
    const r = await put(deps, "2026-11-11", "c-1", { minutes: 30 });
    expect(r.status).toBe(200);
    expect(row(r, "c-1").entry).toMatchObject({ minutes: 30, calories: 200 });
  });

  it("409 DAY_LOCKED for edits three days back", async () => {
    const { deps } = await setup();
    expect((await put(deps, "2026-11-08", "std-running", { minutes: 40 })).status).toBe(409);
  });
});
