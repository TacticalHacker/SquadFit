import { describe, expect, it } from "vitest";
import { makeDeps, seedProfile } from "./fakes";
import { callTool, seedKey, toolText } from "./mcp-helpers";

async function setup() {
  const ctx = makeDeps();
  await seedProfile(ctx.profiles);
  return { ...ctx, token: await seedKey(ctx.deps) };
}

describe("update_user_targets", () => {
  it("updates only the calorie target", async () => {
    const { deps, profiles, token } = await setup();
    const r = toolText(await callTool(deps, token, "update_user_targets", { dailyCalorieTarget: 2400 }));
    expect(r.isError).toBe(false);
    expect(r.text).toContain("2400");
    expect(profiles.items.get("user-1")).toMatchObject({ dailyCalorieTarget: 2400 });
    expect(profiles.items.get("user-1")?.dailyProteinTarget).toBeUndefined();
  });

  it("sets, keeps and clears the protein target", async () => {
    const { deps, profiles, token } = await setup();
    await callTool(deps, token, "update_user_targets", { dailyProteinTarget: 130 });
    expect(profiles.items.get("user-1")).toMatchObject({ dailyCalorieTarget: 2200, dailyProteinTarget: 130 });
    await callTool(deps, token, "update_user_targets", { dailyCalorieTarget: 2300 });
    expect(profiles.items.get("user-1")?.dailyProteinTarget).toBe(130);
    await callTool(deps, token, "update_user_targets", { dailyProteinTarget: null });
    expect(profiles.items.get("user-1")?.dailyProteinTarget).toBeUndefined();
    expect(profiles.items.get("user-1")?.dailyCalorieTarget).toBe(2300);
  });

  it.each([
    ["nothing", {}],
    ["calories too low", { dailyCalorieTarget: 499 }],
    ["calories fractional", { dailyCalorieTarget: 2000.5 }],
    ["protein too low", { dailyProteinTarget: 9 }],
    ["protein too high", { dailyProteinTarget: 501 }],
  ])("rejects %s without changing anything", async (_n, args) => {
    const { deps, profiles, token } = await setup();
    const r = toolText(await callTool(deps, token, "update_user_targets", args));
    expect(r.isError).toBe(true);
    expect(profiles.items.get("user-1")).toMatchObject({ dailyCalorieTarget: 2200 });
  });

  it("is reflected in the history targets", async () => {
    const { deps, token } = await setup();
    await callTool(deps, token, "update_user_targets", { dailyCalorieTarget: 2400, dailyProteinTarget: 130 });
    const out = JSON.parse(toolText(await callTool(deps, token, "get_user_history", { startDate: "2026-11-11", endDate: "2026-11-11" })).text);
    expect(out.targets).toEqual({ calories: 2400, protein: 130 });
  });
});
