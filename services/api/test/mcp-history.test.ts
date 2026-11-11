import { describe, expect, it } from "vitest";
import { makeDeps, seedProfile, seedWorkoutEntry } from "./fakes";
import { callTool, seedKey, toolText } from "./mcp-helpers";

// Fixed clock 2026-11-11T10:00Z → Asia/Kolkata today = 2026-11-11.
const entry = (date: string, id: string, name: string, calories: number, meal = "lunch", macros: unknown = null) =>
  ({
    entryId: id, date, meal, source: "typed", name, servings: 1, calories, macros,
    rate: { calories, macros }, createdAt: "t", updatedAt: "t",
  }) as never;

describe("get_user_history", () => {
  it("returns one object per day with entries and totals, oldest first", async () => {
    const { deps, profiles, food, workouts } = makeDeps();
    await seedProfile(profiles);
    const token = await seedKey(deps);
    await food.putEntry("user-1", entry("2026-11-10", "a", "Rice", 400, "lunch", { protein: 8, carbs: 80, fat: 1 }));
    await food.putEntry("user-1", entry("2026-11-10", "b", "Egg", 100, "breakfast"));
    await seedWorkoutEntry(workouts, "user-1", "2026-11-10", 250);
    const r = toolText(await callTool(deps, token, "get_user_history", { startDate: "2026-11-09", endDate: "2026-11-11" }));
    expect(r.isError).toBe(false);
    const out = JSON.parse(r.text);
    expect(out.timezone).toBe("Asia/Kolkata");
    expect(out.today).toBe("2026-11-11");
    expect(out.targets).toEqual({ calories: 2200, protein: null });
    expect(out.days.map((d: { date: string }) => d.date)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11"]);
    const d = out.days[1];
    expect(d.totals).toMatchObject({ eaten: 500, burned: 250, net: 250, protein: 8, carbs: 80, fat: 1 });
    expect(d.food.map((f: { name: string }) => f.name)).toEqual(["Egg", "Rice"]); // meal order: breakfast first
    expect(d.food[1]).toMatchObject({ meal: "lunch", calories: 400, protein: 8 });
    expect(d.workouts).toEqual([{ name: "std-running", minutes: 30, calories: 250 }]);
    expect(out.days[0].food).toEqual([]);
  });

  it.each([
    [{ startDate: "2026-11-11", endDate: "2026-11-10" }, /before/],
    [{ startDate: "2026-10-01", endDate: "2026-11-11" }, /31 days/],
    [{ startDate: "2026-11-10", endDate: "2026-11-12" }, /future/i],
    [{ startDate: "garbage", endDate: "2026-11-11" }, /YYYY-MM-DD/],
  ])("rejects invalid window %j", async (args, message) => {
    const { deps, profiles } = makeDeps();
    await seedProfile(profiles);
    const token = await seedKey(deps);
    const r = toolText(await callTool(deps, token, "get_user_history", args));
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(message);
  });

  it("uses the member's timezone for today (LA is still on the 10th)", async () => {
    const { deps, profiles, setNow } = makeDeps();
    await seedProfile(profiles, "user-1", "America/Los_Angeles");
    setNow("2026-11-11T03:00:00.000Z"); // 2026-11-10 19:00 in LA
    const token = await seedKey(deps);
    const ok = toolText(await callTool(deps, token, "get_user_history", { startDate: "2026-11-10", endDate: "2026-11-10" }));
    expect(ok.isError).toBe(false);
    const bad = toolText(await callTool(deps, token, "get_user_history", { startDate: "2026-11-11", endDate: "2026-11-11" }));
    expect(bad.isError).toBe(true);
  });
});
