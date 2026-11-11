import { describe, expect, it } from "vitest";
import { makeDeps, seedProfile } from "./fakes";
import { callTool, seedKey, toolText } from "./mcp-helpers";

describe("MCP privacy", () => {
  it("a key only reads and writes its own member's data", async () => {
    const { deps, profiles, food, coach } = makeDeps();
    await seedProfile(profiles, "user-1", "Asia/Kolkata", "alice");
    await seedProfile(profiles, "user-2", "America/New_York", "bob");
    const a = await seedKey(deps, "user-1");
    await food.putEntry("user-2", {
      entryId: "x", date: "2026-11-11", meal: "lunch", source: "typed", name: "Bob's secret snack", servings: 1,
      calories: 999, macros: null, rate: { calories: 999, macros: null }, createdAt: "t", updatedAt: "t",
    } as never);
    await coach.put("user-2", { date: "2026-11-11", summaryMarkdown: "bob note", recommendations: ["r"] }, "t");

    const hist = toolText(await callTool(deps, a, "get_user_history", { startDate: "2026-11-11", endDate: "2026-11-11" }));
    expect(hist.text).not.toContain("Bob");
    expect(hist.text).not.toContain("999");
    expect(hist.text).not.toMatch(/alice|bob|America\/New_York/);

    await callTool(deps, a, "update_user_targets", { dailyCalorieTarget: 3000, userId: "user-2" });
    expect(profiles.items.get("user-2")?.dailyCalorieTarget).toBe(2200);
    await callTool(deps, a, "post_daily_coach_note", { date: "2026-11-11", summaryMarkdown: "mine", recommendations: ["r"], userId: "user-2" });
    expect((await coach.get("user-2", "2026-11-11"))?.summaryMarkdown).toBe("bob note");
  });

  it("never echoes the key or the note text in error output", async () => {
    const { deps, profiles } = makeDeps();
    await seedProfile(profiles);
    const a = await seedKey(deps);
    const r = toolText(await callTool(deps, a, "post_daily_coach_note", { date: "2030-01-01", summaryMarkdown: "SECRET-NOTE", recommendations: ["r"] }));
    expect(r.isError).toBe(true);
    expect(r.text).not.toContain(a);
    expect(r.text).not.toContain("SECRET-NOTE");
  });
});
