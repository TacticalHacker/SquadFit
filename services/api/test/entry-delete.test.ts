import { describe, expect, it } from "vitest";
import { handle as del } from "../src/handlers/entry-delete";
import { handle as put } from "../src/handlers/entry-put";
import { makeDeps, makeEvent, parse, seedProfile } from "./fakes";

const setup = async (now = "2026-11-11T10:00:00.000Z") => {
  const ctx = makeDeps(now);
  await seedProfile(ctx.profiles);
  return ctx;
};
const tick = (deps: Parameters<typeof put>[1], date: string, id: string) =>
  put(makeEvent({ pathParameters: { date, workoutId: id } }), deps);
const untick = (deps: Parameters<typeof del>[1], date: string, id: string) =>
  del(makeEvent({ pathParameters: { date, workoutId: id } }), deps).then(parse);

describe("DELETE entry", () => {
  it("removes the entry and returns the day view", async () => {
    const { deps } = await setup();
    await tick(deps, "2026-11-11", "std-running");
    const r = await untick(deps, "2026-11-11", "std-running");
    expect(r.status).toBe(200);
    expect(r.body.summary).toEqual({ totalMinutes: 0, totalCalories: 0 });
  });
  it("succeeds when absent", async () => {
    const { deps } = await setup();
    expect((await untick(deps, "2026-11-11", "std-running")).status).toBe(200);
  });
  it("409 DAY_LOCKED three days back; today-2 ok", async () => {
    const { deps } = await setup();
    expect((await untick(deps, "2026-11-08", "std-running")).status).toBe(409);
    expect((await untick(deps, "2026-11-09", "std-running")).status).toBe(200);
  });
  it("works for an entry whose custom workout was removed", async () => {
    const { deps, workouts } = await setup();
    await workouts.putCustomWorkout("user-1", { workoutId: "c-1", name: "P", defaultMinutes: 10, defaultCalories: 10, createdAt: "t", updatedAt: "t" });
    await tick(deps, "2026-11-11", "c-1");
    await workouts.markCustomRemoved("user-1", "c-1", "t");
    const r = await untick(deps, "2026-11-11", "c-1");
    expect(r.status).toBe(200);
    expect(r.body.rows).toHaveLength(12);
  });
});

describe("DELETE entry: gym ids (feature 006)", () => {
  it("404; gym entries are removed through /workouts/gym", async () => {
    const { deps, workouts } = await setup();
    await workouts.putEntryIfAbsent("user-1", { date: "2026-11-11", workoutId: "gx-deadlift", name: "Deadlift", rateMinutes: 5, rateCalories: 30, minutes: 8, calories: 45, kind: "gym", createdAt: "t", updatedAt: "t" });
    expect((await untick(deps, "2026-11-11", "gx-deadlift")).status).toBe(404);
    expect(workouts.entries.size).toBe(1);
  });
});
