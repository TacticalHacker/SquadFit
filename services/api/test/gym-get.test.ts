import { describe, expect, it } from "vitest";
import { GYM_EXERCISES } from "@calci/shared";
import { makeDeps, seedProfile } from "./fakes";
import { exercise, gymGet, gymPut, sets } from "./gym-helpers";

const setup = async () => {
  const ctx = makeDeps("2026-11-11T10:00:00.000Z");
  await seedProfile(ctx.profiles);
  return ctx;
};

describe("GET /workouts/gym", () => {
  it("409 without a profile; 400 for a future date", async () => {
    const { deps } = makeDeps();
    expect((await gymGet(deps)).body.error.code).toBe("PROFILE_REQUIRED");
    const { deps: d2 } = await setup();
    expect((await gymGet(d2, "2026-11-12")).status).toBe(400);
  });

  it("lists the built-ins plus own exercises for today, nothing logged", async () => {
    const { deps, gym } = await setup();
    await gym.putOwnExercise("user-1", { exerciseId: "gc-1", name: "Hip Thrust", group: "legs", createdAt: "t", updatedAt: "t" });
    const r = await gymGet(deps);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ date: "2026-11-11", today: "2026-11-11", editable: true, summary: { totalMinutes: 0, totalCalories: 0 } });
    expect(r.body.exercises).toHaveLength(GYM_EXERCISES.length + 1);
    expect(r.body.exercises.every((e: { entry: unknown; last: unknown }) => e.entry === null && e.last === null)).toBe(true);
  });

  it("`last` is the latest entry strictly before the viewed date, with its top set", async () => {
    const { deps, setNow } = await setup();
    setNow("2026-11-09T10:00:00.000Z");
    await gymPut(deps, "2026-11-08", "gx-barbell-squat", { sets: sets(3, 70, 8) });
    await gymPut(deps, "2026-11-09", "gx-barbell-squat", { sets: [...sets(2, 80, 8), { setNumber: 3, weightKg: 80, reps: 6, completed: true }] });
    setNow("2026-11-11T10:00:00.000Z");
    await gymPut(deps, "2026-11-11", "gx-barbell-squat", { sets: sets(1, 90, 3) });

    const today = exercise(await gymGet(deps, "2026-11-11"), "gx-barbell-squat")!;
    expect(today.entry).toMatchObject({ volumeKg: 270 });
    expect(today.last).toMatchObject({ date: "2026-11-09", minutes: 8, top: { weightKg: 80, reps: 8 } });
    expect((today.last as { sets: unknown[] }).sets).toHaveLength(3);

    const nov9 = exercise(await gymGet(deps, "2026-11-09"), "gx-barbell-squat")!;
    expect(nov9.last).toMatchObject({ date: "2026-11-08", top: { weightKg: 70, reps: 8 } });
    expect(exercise(await gymGet(deps, "2026-11-08"), "gx-barbell-squat")!.last).toBeNull();
  });

  it("bodyweight top set and cardio last minutes", async () => {
    const { deps, setNow } = await setup();
    setNow("2026-11-10T10:00:00.000Z");
    await gymPut(deps, "2026-11-10", "gx-pull-ups", { sets: sets(3, 0, 12) });
    await gymPut(deps, "2026-11-10", "gx-stairmaster", { minutes: 30 });
    setNow("2026-11-11T10:00:00.000Z");
    const r = await gymGet(deps);
    expect(exercise(r, "gx-pull-ups")!.last).toMatchObject({ top: { weightKg: 0, reps: 12 } });
    expect(exercise(r, "gx-stairmaster")!.last).toMatchObject({ minutes: 30, sets: null, top: null });
  });

  it("shows a removed own exercise only on a day it was logged", async () => {
    const { deps, gym } = await setup();
    await gym.putOwnExercise("user-1", { exerciseId: "gc-1", name: "Hip Thrust", group: "legs", createdAt: "t", updatedAt: "t" });
    await gymPut(deps, "2026-11-11", "gc-1", { sets: sets(3, 60, 10) });
    await gym.markOwnRemoved("user-1", "gc-1", "t");
    expect(exercise(await gymGet(deps, "2026-11-11"), "gc-1")).toMatchObject({ name: "Hip Thrust", group: "legs" });
    expect(exercise(await gymGet(deps, "2026-11-10"), "gc-1")).toBeUndefined();
  });

  it("is read-only for older days", async () => {
    const { deps } = await setup();
    expect((await gymGet(deps, "2026-11-01")).body.editable).toBe(false);
  });
});
