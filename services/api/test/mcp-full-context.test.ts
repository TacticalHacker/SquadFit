import { describe, expect, it } from "vitest";
import { parseLogId } from "@calci/shared";
import { makeDeps, seedProfile, seedWorkoutEntry } from "./fakes";
import { callTool, seedKey, toolText } from "./mcp-helpers";

// Fixed clock 2026-11-11T10:00Z → Asia/Kolkata today = 2026-11-11.
const typed = (date: string, id: string, name: string, calories: number, macros: unknown = null, extra: object = {}) =>
  ({
    entryId: id, date, meal: "lunch", source: "typed", name, servings: 1, calories, macros,
    rate: { calories, macros }, createdAt: "t", updatedAt: "t", ...extra,
  }) as never;

async function setup() {
  const ctx = makeDeps();
  await seedProfile(ctx.profiles);
  await seedProfile(ctx.profiles, "user-2", "America/New_York", "bob");
  const token = await seedKey(ctx.deps);
  // Workouts on the 3 days before today and today → streak 4.
  for (const d of ["2026-11-08", "2026-11-09", "2026-11-10"]) await seedWorkoutEntry(ctx.workouts, "user-1", d, 100, "c-run");
  await ctx.gym.putGymEntry("user-1", {
    date: "2026-11-11", workoutId: "gx-bench-press", name: "Bench Press", kind: "gym", muscleGroup: "chest", exerciseKind: "strength",
    rateMinutes: 2.5, rateCalories: 15, minutes: 8, calories: 62, volumeKg: 1440, aiNote: "6 MET @ 78kg",
    sets: [1, 2, 3].map((n) => ({ setNumber: n, reps: 8, weightKg: 60, completed: true })), createdAt: "t", updatedAt: "t",
  });
  await ctx.food.putEntry("user-1", typed("2026-11-11", "0000000000001-aaaaaa", "Rice", 400, { protein: 8, carbs: 80, fat: 1 }));
  await ctx.food.putEntry(
    "user-1",
    typed("2026-11-11", "0000000000002-bbbbbb", "Photo meal", 0, null, { source: "photo", photo: { status: "pending", caption: "" } }),
  );
  await ctx.food.putEntry("user-2", typed("2026-11-11", "0000000000003-cccccc", "Bob's snack", 999));
  await ctx.coach.put("user-1", { date: "2026-11-11", headline: "Strong day", status: "on_track", highlights: ["x"], actionItems: [] }, "t");
  return { ...ctx, token };
}

const full = async (deps: Awaited<ReturnType<typeof setup>>["deps"], token: string, args: object = {}) =>
  toolText(await callTool(deps, token, "get_full_context", args));

describe("get_full_context", () => {
  it("defaults to the last 7 days and returns profile, logs with ids, totals, streak and no leaderboard", async () => {
    const { deps, token } = await setup();
    const r = await full(deps, token);
    expect(r.isError).toBe(false);
    const out = JSON.parse(r.text);
    expect(out.today).toBe("2026-11-11");
    expect(out.timezone).toBe("Asia/Kolkata");
    expect(out.profile).toEqual({ bodyWeightKg: 75, bodyWeightIsDefault: true, calorieTarget: 2200, proteinTarget: null });
    expect(out.editableFrom).toBe("2026-11-09");
    expect(out.streak).toBe(4);
    expect(out.leaderboard).toBeNull();
    expect(out.leaderboardNote).toMatch(/not built/);
    expect(out.days.map((d: { date: string }) => d.date)).toEqual([
      "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11",
    ]);

    const today = out.days[6];
    const bench = today.workouts.find((w: { name: string }) => w.name === "Bench Press");
    expect(bench).toMatchObject({
      logId: "2026-11-11#gx-bench-press", kind: "gym", muscleGroup: "chest", exerciseKind: "strength",
      calories: 62, aiNote: "6 MET @ 78kg", volumeKg: 1440,
    });
    expect(bench.sets[0]).toEqual({ set: 1, reps: 8, weightKg: 60, done: true });
    expect(out.days[5].workouts[0]).toMatchObject({ logId: "2026-11-10#c-run", kind: "activity" });
    for (const d of out.days) {
      for (const line of [...d.workouts, ...d.food]) expect(parseLogId(line.logId), line.logId).not.toBeNull();
    }
    expect(today.food.map((f: { name: string }) => f.name)).toContain("Photo meal");
    expect(today.totals).toMatchObject({ eaten: 400, burned: 62, net: 338, protein: 8, gymVolumeKg: 1440 });
    expect(today.coachNote).toEqual({ headline: "Strong day", status: "on_track" });
    expect(out.days[5].coachNote).toBeNull();
    expect(out.pendingPhotoMeals).toBe(1);
    expect(out.next).toMatch(/list_pending_food_photos/);
  });

  it("reports a stored body weight", async () => {
    const { deps, profiles, token } = await setup();
    await profiles.upsert("user-1", "alice", { displayName: "Alice", timezone: "Asia/Kolkata", dailyCalorieTarget: 2200, bodyWeightKg: 78.5 }, "t");
    const out = JSON.parse((await full(deps, token)).text);
    expect(out.profile).toMatchObject({ bodyWeightKg: 78.5, bodyWeightIsDefault: false });
  });

  it("accepts an explicit window and fills the other end", async () => {
    const { deps, token } = await setup();
    const one = JSON.parse((await full(deps, token, { startDate: "2026-11-10", endDate: "2026-11-11" })).text);
    expect(one.days.map((d: { date: string }) => d.date)).toEqual(["2026-11-10", "2026-11-11"]);
    const fromStart = JSON.parse((await full(deps, token, { startDate: "2026-11-01" })).text);
    expect(fromStart.days).toHaveLength(7);
    expect(fromStart.days[6].date).toBe("2026-11-07");
    const fromEnd = JSON.parse((await full(deps, token, { endDate: "2026-11-09" })).text);
    expect(fromEnd.days[0].date).toBe("2026-11-03");
  });

  it.each([
    [{ startDate: "2026-10-01", endDate: "2026-11-11" }, /31 days/],
    [{ startDate: "2026-11-10", endDate: "2026-11-12" }, /future/i],
    [{ startDate: "2026-11-11", endDate: "2026-11-10" }, /before/],
  ])("rejects window %j", async (args, message) => {
    const { deps, token } = await setup();
    const r = await full(deps, token, args);
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(message);
  });

  it("contains nothing about other members", async () => {
    const { deps, token } = await setup();
    const r = await full(deps, token);
    expect(r.text).not.toMatch(/Bob|999|bob|alice|America\/New_York/);
  });
});
