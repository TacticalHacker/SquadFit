import { describe, expect, it } from "vitest";
import { makeDeps, seedProfile } from "./fakes";
import { callTool, seedKey, toolText } from "./mcp-helpers";

describe("MCP weight tools", () => {
  it("logs a weigh-in as the key's member, syncs the profile, and reads it back; locked days are refused", async () => {
    const { deps, profiles } = makeDeps("2026-11-24T02:00:00.000Z");
    await seedProfile(profiles);
    const token = await seedKey(deps);

    const saved = toolText(await callTool(deps, token, "log_weight", { weightKg: 81.3, date: "2026-11-23" }));
    expect(saved.isError).toBe(false);
    expect(JSON.parse(saved.text).latest).toMatchObject({ date: "2026-11-23", weightKg: 81.3 });
    expect((await profiles.get("user-1"))?.bodyWeightKg).toBe(81.3);

    const read = JSON.parse(toolText(await callTool(deps, token, "get_weight_log", { range: "W" })).text);
    expect(read.entries).toEqual([expect.objectContaining({ date: "2026-11-23", weightKg: 81.3 })]);
    expect(read.slots).toEqual([expect.objectContaining({ start: "2026-11-23", average: 81.3 })]);

    const locked = toolText(await callTool(deps, token, "log_weight", { weightKg: 80, date: "2026-11-20" }));
    expect(locked.isError).toBe(true);
    expect(locked.text).toContain("can no longer be edited");
  });
});
