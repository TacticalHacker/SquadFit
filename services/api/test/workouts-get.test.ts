import { describe, expect, it } from "vitest";
import { handle } from "../src/handlers/workouts-get";
import { makeDeps, makeEvent, parse, seedProfile } from "./fakes";

const get = (deps: Parameters<typeof handle>[1], date?: string, sub = "user-1") =>
  handle(makeEvent({ sub, ...(date ? { queryStringParameters: { date } } : {}) }), deps).then(parse);

const entry = (date: string, workoutId: string, name = "X") => ({
  date, workoutId, name, rateMinutes: 30, rateCalories: 300, minutes: 30, calories: 300,
  createdAt: "t", updatedAt: "t",
});

describe("GET /workouts", () => {
  it("409 without a profile", async () => {
    const { deps } = makeDeps();
    const r = await get(deps);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("PROFILE_REQUIRED");
  });

  it("gives a new user no rows: there are no built-in activities (feature 007)", async () => {
    const { deps, profiles } = makeDeps("2026-11-11T10:00:00.000Z");
    await seedProfile(profiles);
    const r = await get(deps);
    expect(r.status).toBe(200);
    expect(r.body.date).toBe("2026-11-11");
    expect(r.body.today).toBe("2026-11-11");
    expect(r.body.editable).toBe(true);
    expect(r.body.rows).toEqual([]);
    expect(r.body.summary).toEqual({ totalMinutes: 0, totalCalories: 0 });
  });

  it("lists custom workouts A→Z and hides removed ones", async () => {
    const { deps, profiles, workouts } = makeDeps();
    await seedProfile(profiles);
    const w = (id: string, name: string) => ({ workoutId: id, name, defaultMinutes: 10, defaultCalories: 50, createdAt: "t", updatedAt: "t" });
    await workouts.putCustomWorkout("user-1", w("c-2", "Squash"));
    await workouts.putCustomWorkout("user-1", w("c-1", "Badminton"));
    await workouts.putCustomWorkout("user-1", { ...w("c-3", "Padel"), removedAt: "t" });
    const r = await get(deps);
    expect(r.body.rows.map((x: { workoutId: string }) => x.workoutId)).toEqual(["c-1", "c-2"]);
  });

  it("never shows another user's entries or workouts", async () => {
    const { deps, profiles, workouts } = makeDeps();
    await seedProfile(profiles);
    await workouts.putEntryIfAbsent("user-2", entry("2026-11-11", "std-running"));
    await workouts.putCustomWorkout("user-2", { workoutId: "c-9", name: "Secret", defaultMinutes: 1, defaultCalories: 1, createdAt: "t", updatedAt: "t" });
    const r = await get(deps);
    expect(r.body.rows).toEqual([]);
    expect(r.body.summary.totalMinutes).toBe(0);
  });

  it("400 for future or malformed dates", async () => {
    const { deps, profiles } = makeDeps("2026-11-11T10:00:00.000Z");
    await seedProfile(profiles);
    expect((await get(deps, "2026-11-12")).status).toBe(400);
    expect((await get(deps, "nope")).status).toBe(400);
  });

  it("returns past days with entries; editable only inside the window", async () => {
    const { deps, profiles, workouts } = makeDeps("2026-11-11T10:00:00.000Z");
    await seedProfile(profiles);
    await workouts.putEntryIfAbsent("user-1", entry("2026-11-08", "std-running"));
    const old = await get(deps, "2026-11-08");
    expect(old.body.editable).toBe(false);
    expect(old.body.summary).toEqual({ totalMinutes: 30, totalCalories: 300 });
    expect((await get(deps, "2026-11-09")).body.editable).toBe(true);
    expect((await get(deps, "2020-01-01")).status).toBe(200);
  });

  it("window moves with the clock across local midnight", async () => {
    const { deps, profiles, setNow } = makeDeps("2026-11-11T10:00:00.000Z");
    await seedProfile(profiles, "user-1", "UTC");
    expect((await get(deps, "2026-11-09")).body.editable).toBe(true);
    setNow("2026-11-12T00:00:01.000Z");
    expect((await get(deps, "2026-11-09")).body.editable).toBe(false);
  });

  it("removed custom workout's entries show as removed rows", async () => {
    const { deps, profiles, workouts } = makeDeps();
    await seedProfile(profiles);
    await workouts.putCustomWorkout("user-1", { workoutId: "c-1", name: "Padel", defaultMinutes: 60, defaultCalories: 500, createdAt: "t", updatedAt: "t", removedAt: "t" });
    await workouts.putEntryIfAbsent("user-1", entry("2026-11-11", "c-1", "Padel"));
    const r = await get(deps);
    const row = r.body.rows.at(-1);
    expect(row).toMatchObject({ workoutId: "c-1", removed: true });
    expect(row.entry.minutes).toBe(30);
  });
});
