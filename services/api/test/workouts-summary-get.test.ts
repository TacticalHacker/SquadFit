import { describe, expect, it } from "vitest";
import { handle } from "../src/handlers/workouts-summary-get";
import { makeDeps, makeEvent, parse, seedProfile } from "./fakes";

const get = (deps: Parameters<typeof handle>[1], q: Record<string, string>) =>
  handle(makeEvent({ queryStringParameters: q }), deps).then(parse);
const entry = (date: string, id: string, minutes: number, calories: number) => ({
  date, workoutId: id, name: id, rateMinutes: minutes, rateCalories: calories, minutes, calories, createdAt: "t", updatedAt: "t",
});

describe("GET /workouts/summary", () => {
  it("returns every date oldest first with zeros and sums", async () => {
    const { deps, profiles, workouts } = makeDeps("2026-11-11T10:00:00.000Z");
    await seedProfile(profiles);
    await workouts.putEntryIfAbsent("user-1", entry("2026-11-10", "std-running", 30, 300));
    await workouts.putEntryIfAbsent("user-1", entry("2026-11-10", "std-yoga", 30, 90));
    await workouts.putEntryIfAbsent("user-1", entry("2026-11-11", "std-yoga", 30, 90));
    await workouts.putEntryIfAbsent("user-2", entry("2026-11-10", "std-yoga", 99, 99));
    const r = await get(deps, { from: "2026-11-09", to: "2026-11-11" });
    expect(r.status).toBe(200);
    expect(r.body.days).toEqual([
      { date: "2026-11-09", totalMinutes: 0, totalCalories: 0 },
      { date: "2026-11-10", totalMinutes: 60, totalCalories: 390 },
      { date: "2026-11-11", totalMinutes: 30, totalCalories: 90 },
    ]);
  });

  it("includes entries on the last day of the range", async () => {
    const { deps, profiles, workouts } = makeDeps("2026-11-11T10:00:00.000Z");
    await seedProfile(profiles);
    await workouts.putEntryIfAbsent("user-1", entry("2026-11-11", "std-zz", 5, 5));
    const r = await get(deps, { from: "2026-11-11", to: "2026-11-11" });
    expect(r.body.days[0].totalMinutes).toBe(5);
  });

  it("400 for bad ranges", async () => {
    const { deps, profiles } = makeDeps("2026-11-11T10:00:00.000Z");
    await seedProfile(profiles);
    for (const q of [
      { from: "2026-11-11", to: "2026-11-10" },
      { from: "2026-11-10", to: "2026-11-12" },
      { from: "2026-01-01", to: "2026-11-11" },
      { from: "x", to: "2026-11-11" },
      { to: "2026-11-11" },
    ]) {
      expect((await get(deps, q as Record<string, string>)).status).toBe(400);
    }
  });

  it("allows exactly 62 days", async () => {
    const { deps, profiles } = makeDeps("2026-11-11T10:00:00.000Z");
    await seedProfile(profiles);
    const r = await get(deps, { from: "2026-09-11", to: "2026-11-11" });
    expect(r.status).toBe(200);
    expect(r.body.days).toHaveLength(62);
  });

  it("409 without profile", async () => {
    const { deps } = makeDeps();
    expect((await get(deps, { from: "2026-11-10", to: "2026-11-11" })).status).toBe(409);
  });
});
