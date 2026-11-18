import { describe, expect, it } from "vitest";
import { makeDeps, seedProfile } from "./fakes";
import { callTool, seedKey, toolText } from "./mcp-helpers";

// Fixed clock 2026-11-11T10:00Z → Asia/Kolkata today = 2026-11-11.
async function setup() {
  const ctx = makeDeps();
  await seedProfile(ctx.profiles);
  return { ...ctx, token: await seedKey(ctx.deps) };
}
const lifts = (n: number, weightKg = 60, reps = 8) => Array.from({ length: n }, () => ({ reps, weightKg }));

describe("upsert_workout_log", () => {
  it("creates by name with app-computed totals and numbered sets", async () => {
    const { deps, workouts, token } = await setup();
    const r = toolText(await callTool(deps, token, "upsert_workout_log", { date: "2026-11-11", exercise: "bench press", sets: lifts(3) }));
    expect(r.isError).toBe(false);
    expect(r.text).toContain("2026-11-11#gx-bench-press");
    const e = await workouts.getEntry("user-1", "2026-11-11", "gx-bench-press");
    expect(e).toMatchObject({ kind: "gym", calories: 45, volumeKg: 1440 });
    expect(e?.sets?.map((s) => [s.setNumber, s.completed])).toEqual([[1, true], [2, true], [3, true]]);
  });

  it("replaces the day's entry by id and clears an AI adjustment", async () => {
    const { deps, workouts, token } = await setup();
    await callTool(deps, token, "upsert_workout_log", { date: "2026-11-11", exercise: "gx-bench-press", sets: lifts(3) });
    const e = (await workouts.getEntry("user-1", "2026-11-11", "gx-bench-press"))!;
    await workouts.setAiAdjustment("user-1", "2026-11-11", "gx-bench-press", { minutes: 14, calories: 62, aiNote: "x" }, e.updatedAt, "t2");
    await callTool(deps, token, "upsert_workout_log", { date: "2026-11-11", exercise: "gx-bench-press", sets: [{ reps: 5, weightKg: 80, completed: false }] });
    const after = await workouts.listEntriesForDay("user-1", "2026-11-11");
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ calories: 15, volumeKg: 400 });
    expect(after[0]!.aiNote).toBeUndefined();
    expect(after[0]!.sets![0]!.completed).toBe(false);
  });

  it("finds the member's own exercise by name", async () => {
    const { deps, gym, workouts, token } = await setup();
    await gym.putOwnExercise("user-1", { exerciseId: "gc-abc", name: "Zercher Squat", group: "legs", createdAt: "t", updatedAt: "t" });
    const r = toolText(await callTool(deps, token, "upsert_workout_log", { date: "2026-11-11", exercise: "Zercher squat", sets: lifts(2) }));
    expect(r.isError).toBe(false);
    expect(await workouts.getEntry("user-1", "2026-11-11", "gc-abc")).not.toBeNull();
  });

  it("logs cardio in minutes and needs the right shape for each kind", async () => {
    const { deps, workouts, token } = await setup();
    expect(toolText(await callTool(deps, token, "upsert_workout_log", { date: "2026-11-11", exercise: "Stairmaster", minutes: 20 })).isError).toBe(false);
    expect((await workouts.getEntry("user-1", "2026-11-11", "gx-stairmaster"))?.calories).toBe(180);
    const noMinutes = toolText(await callTool(deps, token, "upsert_workout_log", { date: "2026-11-11", exercise: "Stairmaster", sets: lifts(1) }));
    expect(noMinutes.isError).toBe(true);
    expect(noMinutes.text).toMatch(/minutes/);
    const noSets = toolText(await callTool(deps, token, "upsert_workout_log", { date: "2026-11-11", exercise: "Bench Press", minutes: 10 }));
    expect(noSets.isError).toBe(true);
    expect(noSets.text).toMatch(/sets/);
  });

  it("lists close matches for an unknown name", async () => {
    const { deps, token } = await setup();
    const r = toolText(await callTool(deps, token, "upsert_workout_log", { date: "2026-11-11", exercise: "bench", sets: lifts(1) }));
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/Exercise not found/);
    expect(r.text).toContain("Bench Press");
  });

  it.each([
    ["locked day", { date: "2026-11-08" }, /can no longer be changed/],
    ["future day", { date: "2026-11-12" }, /future/],
    ["bad weight", { sets: [{ reps: 8, weightKg: 60.3 }] }, /weight/i],
    ["21 sets", { sets: lifts(21) }, /20/],
  ])("refuses %s", async (_n, patch, message) => {
    const { deps, workouts, token } = await setup();
    const r = toolText(await callTool(deps, token, "upsert_workout_log", { date: "2026-11-11", exercise: "Bench Press", sets: lifts(2), ...patch }));
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(message);
    expect(workouts.entries.size).toBe(0);
  });
});

describe("upsert_food_log", () => {
  it("creates a list-food entry by id or name, following servings", async () => {
    const { deps, food, token } = await setup();
    let r = toolText(await callTool(deps, token, "upsert_food_log", { date: "2026-11-11", meal: "breakfast", food: "sf-egg-boiled", servings: 2 }));
    expect(r.isError).toBe(false);
    expect(r.text).toMatch(/logId 2026-11-11#\d{13}-[0-9a-f]{6}/);
    r = toolText(await callTool(deps, token, "upsert_food_log", { date: "2026-11-11", meal: "lunch", food: "  steamed RICE " }));
    expect(r.isError).toBe(false);
    const day = await food.listEntriesForDay("user-1", "2026-11-11");
    expect(day.map((e) => [e.source, e.name, e.calories])).toEqual(
      expect.arrayContaining([["standard", "Boiled egg", 140], ["standard", "Steamed rice", 200]]),
    );
  });

  it("matches the member's own food by name", async () => {
    const { deps, food, token } = await setup();
    await food.putOwnFood("user-1", { foodId: "of-1", name: "Grandma's dal", serving: "1 bowl", calories: 250, macros: null, createdAt: "t", updatedAt: "t" });
    await callTool(deps, token, "upsert_food_log", { date: "2026-11-11", meal: "dinner", food: "grandma's dal" });
    expect((await food.listEntriesForDay("user-1", "2026-11-11"))[0]).toMatchObject({ source: "own", foodId: "of-1", calories: 250 });
  });

  it("creates a free-form entry with calories and all-or-none macros", async () => {
    const { deps, food, token } = await setup();
    expect(toolText(await callTool(deps, token, "upsert_food_log", { date: "2026-11-11", meal: "snacks", food: "Protein bar", calories: 210, protein: 20, carbs: 22, fat: 7 })).isError).toBe(false);
    expect((await food.listEntriesForDay("user-1", "2026-11-11"))[0]).toMatchObject({ source: "typed", name: "Protein bar", calories: 210, macros: { protein: 20, carbs: 22, fat: 7 } });
    const partial = toolText(await callTool(deps, token, "upsert_food_log", { date: "2026-11-11", meal: "snacks", food: "Bar", calories: 100, protein: 5 }));
    expect(partial.isError).toBe(true);
    const noCalories = toolText(await callTool(deps, token, "upsert_food_log", { date: "2026-11-11", meal: "snacks", food: "Mystery" }));
    expect(noCalories.isError).toBe(true);
    expect(noCalories.text).toMatch(/calories/);
  });

  it("refuses calories for a list food", async () => {
    const { deps, token } = await setup();
    const r = toolText(await callTool(deps, token, "upsert_food_log", { date: "2026-11-11", meal: "lunch", food: "sf-rice", calories: 500 }));
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/follow the servings/);
  });

  it("updates by logId: servings on a list entry, calories on a typed entry", async () => {
    const { deps, food, token } = await setup();
    await callTool(deps, token, "upsert_food_log", { date: "2026-11-11", meal: "lunch", food: "sf-rice" });
    await callTool(deps, token, "upsert_food_log", { date: "2026-11-11", meal: "snacks", food: "Chai", calories: 80 });
    const [rice, chai] = (await food.listEntriesForDay("user-1", "2026-11-11")).sort((a, b) => a.name.localeCompare(b.name)).reverse();
    expect(toolText(await callTool(deps, token, "upsert_food_log", { logId: `2026-11-11#${rice!.entryId}`, servings: 2 })).isError).toBe(false);
    expect(toolText(await callTool(deps, token, "upsert_food_log", { logId: `2026-11-11#${chai!.entryId}`, calories: 120 })).isError).toBe(false);
    expect((await food.getEntry("user-1", "2026-11-11", rice!.entryId))?.calories).toBe(400);
    expect((await food.getEntry("user-1", "2026-11-11", chai!.entryId))?.calories).toBe(120);
  });

  it("refuses photo entries, unknown logIds and locked days", async () => {
    const { deps, food, token } = await setup();
    await food.putEntry("user-1", {
      entryId: "0000000000001-aaaaaa", date: "2026-11-11", meal: "lunch", source: "photo", name: "Photo meal", servings: 1,
      calories: 0, macros: null, rate: { calories: 0, macros: null }, photo: { status: "pending", caption: "" }, createdAt: "t", updatedAt: "t",
    });
    const photo = toolText(await callTool(deps, token, "upsert_food_log", { logId: "2026-11-11#0000000000001-aaaaaa", calories: 500 }));
    expect(photo.text).toMatch(/submit_food_estimate/);
    expect(toolText(await callTool(deps, token, "upsert_food_log", { logId: "2026-11-11#0000000000009-ffffff", calories: 5 })).text).toBe("Log not found");
    const locked = toolText(await callTool(deps, token, "upsert_food_log", { date: "2026-11-01", meal: "lunch", food: "sf-rice" }));
    expect(locked.text).toMatch(/can no longer be changed/);
    const neither = toolText(await callTool(deps, token, "upsert_food_log", { meal: "lunch" }));
    expect(neither.isError).toBe(true);
  });
});

describe("squad stats follow AI writes (feature 010)", () => {
  it("a heavier set logged through the agent creates the same PR feed item as the app", async () => {
    const { deps, squad, token } = await setup();
    await callTool(deps, token, "upsert_workout_log", { date: "2026-11-10", exercise: "gx-bench-press", sets: lifts(3, 60, 8) });
    await callTool(deps, token, "upsert_workout_log", { date: "2026-11-11", exercise: "gx-bench-press", sets: lifts(3, 65, 5) });
    expect([...squad.feed.values()].map((f) => f.eventId)).toContain("pr#gx-bench-press#2026-11-11");
  });
});
