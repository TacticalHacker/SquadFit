import { describe, expect, it } from "vitest";
import { handle as foodGet } from "../src/handlers/food-get";
import { makeDeps, makeEvent, parse, seedProfile } from "./fakes";
import { callTool, seedKey, toolText } from "./mcp-helpers";

// 2026-11-11T10:00Z is 15:30 in Asia/Kolkata: today = 2026-11-11.
async function setup() {
  const ctx = makeDeps();
  await seedProfile(ctx.profiles);
  const token = await seedKey(ctx.deps);
  await ctx.gym.putGymEntry("user-1", {
    date: "2026-11-11", workoutId: "gx-bench-press", name: "Bench Press", kind: "gym", muscleGroup: "chest",
    exerciseKind: "strength", rateMinutes: 2.5, rateCalories: 15, minutes: 8, calories: 45, volumeKg: 1440,
    sets: [1, 2, 3].map((n) => ({ setNumber: n, reps: 8, weightKg: 60, completed: true })),
    createdAt: "2026-11-11T09:00:00.000Z", updatedAt: "2026-11-11T09:00:00.000Z",
  });
  await ctx.workouts.putEntryIfAbsent("user-1", {
    date: "2026-11-11", workoutId: "c-padel", name: "Padel", rateMinutes: 60, rateCalories: 400, minutes: 60, calories: 400,
    createdAt: "t", updatedAt: "t",
  });
  return { ...ctx, token };
}

const args = (logId: string, extra: Record<string, unknown> = {}) => ({
  logId,
  updatedCalories: 62,
  updatedDurationMins: 14,
  reasoning: "6.0 MET compound lift + rest intervals @ 78kg",
  ...extra,
});

describe("update_workout_calories", () => {
  it("adjusts a gym entry, keeps its sets, and every total follows", async () => {
    const { deps, workouts, token } = await setup();
    const r = toolText(await callTool(deps, token, "update_workout_calories", args("2026-11-11#gx-bench-press")));
    expect(r.isError).toBe(false);
    expect(r.text).toContain("45 → 62 kcal");
    expect(r.text).toContain("445 → 462 kcal");
    const stored = await workouts.getEntry("user-1", "2026-11-11", "gx-bench-press");
    expect(stored).toMatchObject({ calories: 62, minutes: 14, aiNote: "6.0 MET compound lift + rest intervals @ 78kg", volumeKg: 1440 });
    expect(stored?.sets).toHaveLength(3);

    const ledger = parse(await foodGet(makeEvent({}), deps)).body.ledger;
    expect(ledger.burned).toBe(462);
    const hist = toolText(await callTool(deps, token, "get_user_history", { startDate: "2026-11-11", endDate: "2026-11-11" }));
    expect(JSON.parse(hist.text).days[0].totals.burned).toBe(462);
  });

  it("adjusts an activity entry too", async () => {
    const { deps, workouts, token } = await setup();
    const r = toolText(await callTool(deps, token, "update_workout_calories", args("2026-11-11#c-padel", { updatedCalories: 520, updatedDurationMins: 60 })));
    expect(r.isError).toBe(false);
    expect(await workouts.getEntry("user-1", "2026-11-11", "c-padel")).toMatchObject({ calories: 520, minutes: 60, aiNote: expect.any(String) });
  });

  it.each([
    ["garbage id", "nope"],
    ["unknown entry", "2026-11-11#gx-deadlift"],
  ])("says 'Log not found' for %s", async (_n, logId) => {
    const { deps, token } = await setup();
    const r = toolText(await callTool(deps, token, "update_workout_calories", args(logId)));
    expect(r).toEqual({ isError: true, text: "Log not found" });
  });

  it("treats another member's entry as not found", async () => {
    const { deps, profiles, workouts, token } = await setup();
    await seedProfile(profiles, "user-2", "Asia/Kolkata", "bob");
    await workouts.putEntryIfAbsent("user-2", {
      date: "2026-11-11", workoutId: "c-bob", name: "Bob", rateMinutes: 1, rateCalories: 1, minutes: 1, calories: 1, createdAt: "t", updatedAt: "t",
    });
    const r = toolText(await callTool(deps, token, "update_workout_calories", args("2026-11-11#c-bob")));
    expect(r.text).toBe("Log not found");
    expect((await workouts.getEntry("user-2", "2026-11-11", "c-bob"))?.calories).toBe(1);
  });

  it("refuses locked and future days", async () => {
    const { deps, workouts, token } = await setup();
    await workouts.putEntryIfAbsent("user-1", {
      date: "2026-11-08", workoutId: "c-padel", name: "Padel", rateMinutes: 60, rateCalories: 400, minutes: 60, calories: 400, createdAt: "t", updatedAt: "t",
    });
    const locked = toolText(await callTool(deps, token, "update_workout_calories", args("2026-11-08#c-padel")));
    expect(locked.isError).toBe(true);
    expect(locked.text).toMatch(/can no longer be changed/);
    const future = toolText(await callTool(deps, token, "update_workout_calories", args("2026-11-12#c-padel")));
    expect(future.text).toMatch(/future/);
  });

  it.each([
    ["0 kcal", { updatedCalories: 0 }],
    ["5001 kcal", { updatedCalories: 5001 }],
    ["0 min", { updatedDurationMins: 0 }],
    ["601 min", { updatedDurationMins: 601 }],
    ["empty reason", { reasoning: "  " }],
    ["long reason", { reasoning: "a".repeat(121) }],
    ["multi-line reason", { reasoning: "a\nb" }],
  ])("rejects %s and changes nothing", async (_n, extra) => {
    const { deps, workouts, token } = await setup();
    const r = toolText(await callTool(deps, token, "update_workout_calories", args("2026-11-11#gx-bench-press", extra)));
    expect(r.isError).toBe(true);
    expect((await workouts.getEntry("user-1", "2026-11-11", "gx-bench-press"))?.calories).toBe(45);
  });

  it("refuses to overwrite an entry the member changed after the agent read it", async () => {
    const { deps, workouts, token } = await setup();
    workouts.beforeAiWrite = async () => {
      await workouts.updateEntryMinutes("user-1", "2026-11-11", "c-padel", 30, 200, "2026-11-11T10:00:01.000Z");
    };
    const r = toolText(await callTool(deps, token, "update_workout_calories", args("2026-11-11#c-padel")));
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/changed since you read it/);
    expect(await workouts.getEntry("user-1", "2026-11-11", "c-padel")).toMatchObject({ minutes: 30, calories: 200 });
  });
});
