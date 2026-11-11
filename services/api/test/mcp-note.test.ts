import { describe, expect, it } from "vitest";
import { makeDeps, seedProfile } from "./fakes";
import { callTool, seedKey, toolText } from "./mcp-helpers";

const good = { date: "2026-11-11", summaryMarkdown: "**Solid** day", recommendations: ["Walk", "Protein"] };

async function setup() {
  const ctx = makeDeps();
  await seedProfile(ctx.profiles);
  return { ...ctx, token: await seedKey(ctx.deps) };
}

describe("post_daily_coach_note", () => {
  it("saves a note labelled AI", async () => {
    const { deps, coach, token } = await setup();
    const r = toolText(await callTool(deps, token, "post_daily_coach_note", good));
    expect(r.isError).toBe(false);
    expect(r.text).toContain("2026-11-11");
    expect(await coach.get("user-1", "2026-11-11")).toMatchObject({ summaryMarkdown: "**Solid** day", recommendations: ["Walk", "Protein"], generatedBy: "AI" });
  });

  it("replaces a note for the same date and keeps createdAt", async () => {
    const { deps, coach, token, setNow } = await setup();
    await callTool(deps, token, "post_daily_coach_note", good);
    const first = await coach.get("user-1", "2026-11-11");
    setNow("2026-11-11T12:00:00.000Z");
    await callTool(deps, token, "post_daily_coach_note", { ...good, summaryMarkdown: "Updated" });
    const second = await coach.get("user-1", "2026-11-11");
    expect(second?.summaryMarkdown).toBe("Updated");
    expect(second?.createdAt).toBe(first?.createdAt);
    expect(coach.notes.size).toBe(1);
  });

  it.each([
    ["empty summary", { ...good, summaryMarkdown: "  " }],
    ["no recommendations", { ...good, recommendations: [] }],
    ["11 recommendations", { ...good, recommendations: Array(11).fill("x") }],
    ["281-char recommendation", { ...good, recommendations: ["a".repeat(281)] }],
    ["4001-char summary", { ...good, summaryMarkdown: "a".repeat(4001) }],
    ["future date", { ...good, date: "2026-11-12" }],
    ["too old", { ...good, date: "2026-10-11" }],
    ["bad date", { ...good, date: "2026-13-40" }],
  ])("rejects %s and stores nothing", async (_n, args) => {
    const { deps, coach, token } = await setup();
    const r = toolText(await callTool(deps, token, "post_daily_coach_note", args));
    expect(r.isError).toBe(true);
    expect(coach.notes.size).toBe(0);
  });

  it("never lets the caller pick another member: extra userId is ignored", async () => {
    const { deps, coach, token } = await setup();
    await callTool(deps, token, "post_daily_coach_note", { ...good, userId: "user-2" });
    expect(coach.notes.has("user-2|2026-11-11")).toBe(false);
    expect(coach.notes.has("user-1|2026-11-11")).toBe(true);
  });
});
