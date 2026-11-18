import { describe, expect, it } from "vitest";
import { makeDeps, seedProfile } from "./fakes";
import { callTool, seedKey, toolText } from "./mcp-helpers";

describe("MCP daily activity tools", () => {
  it("saves as the key's member with source mcp, reports the goal, and overwrites a Shortcut day", async () => {
    const { deps, profiles, activity } = makeDeps("2026-11-18T10:00:00.000Z");
    await seedProfile(profiles);
    await activity.putDays("user-1", [{ date: "2026-11-17", steps: 3000, activeKcal: null, distanceKm: null }], "shortcut", "2026-11-17T22:00:00.000Z");
    const token = await seedKey(deps);

    const saved = toolText(await callTool(deps, token, "upsert_daily_activity", { days: [{ date: "2026-11-17", steps: 9100.4, distance_km: 6.1 }] }));
    expect(saved.isError).toBe(false);
    expect(JSON.parse(saved.text)).toEqual({ saved: [{ date: "2026-11-17", steps: 9100, activeKcal: null, distanceKm: 6.1, goalHit: true }], stepGoal: 8000, source: "mcp" });

    const read = JSON.parse(toolText(await callTool(deps, token, "get_daily_activity", { startDate: "2026-11-11", endDate: "2026-11-18" })).text);
    expect(read.days).toEqual([expect.objectContaining({ date: "2026-11-17", steps: 9100, source: "mcp", goalHit: true })]);
  });

  it("saves nothing when any day is invalid", async () => {
    const { deps, profiles, activity } = makeDeps("2026-11-18T10:00:00.000Z");
    await seedProfile(profiles);
    const token = await seedKey(deps);
    const r = toolText(await callTool(deps, token, "upsert_daily_activity", { days: [{ date: "2026-11-18", steps: 5 }, { date: "2026-10-01", steps: 5 }] }));
    expect(r.isError).toBe(true);
    expect(r.text).toContain("1 Oct: date is more than 30 days ago");
    expect(await activity.listRange("user-1", "2026-09-01", "2026-12-01")).toHaveLength(0);
  });
});
