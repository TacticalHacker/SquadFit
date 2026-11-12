import { describe, expect, it } from "vitest";
import { makeDeps, seedProfile } from "./fakes";
import { callTool, seedKey, toolText } from "./mcp-helpers";

const good = {
  date: "2026-11-11",
  headline: "Chest PR today, protein 30 g short",
  status: "pr_alert",
  highlights: ["Bench 3×8 @ 62.5 kg", "Protein 110/140 g"],
  actionItems: ["Protein shake after dinner", "10 min walk"],
};

async function setup() {
  const ctx = makeDeps();
  await seedProfile(ctx.profiles);
  return { ...ctx, token: await seedKey(ctx.deps) };
}

describe("post_overall_coach_note", () => {
  it("saves a v2 note with unticked actions", async () => {
    const { deps, coach, token } = await setup();
    const r = toolText(await callTool(deps, token, "post_overall_coach_note", good));
    expect(r.isError).toBe(false);
    expect(r.text).toContain("2026-11-11");
    expect(await coach.get("user-1", "2026-11-11")).toMatchObject({
      headline: good.headline,
      status: "pr_alert",
      highlights: good.highlights,
      actions: [
        { text: "Protein shake after dinner", done: false },
        { text: "10 min walk", done: false },
      ],
      generatedBy: "AI",
    });
  });

  it("replaces the day's note and resets ticks", async () => {
    const { deps, coach, token, setNow } = await setup();
    await callTool(deps, token, "post_overall_coach_note", good);
    const first = (await coach.get("user-1", "2026-11-11"))!;
    expect(await coach.setActionDone("user-1", "2026-11-11", 0, true, first.updatedAt)).toBe("ok");
    setNow("2026-11-11T12:00:00.000Z");
    await callTool(deps, token, "post_overall_coach_note", { ...good, headline: "Second take" });
    const second = (await coach.get("user-1", "2026-11-11"))!;
    expect(second.headline).toBe("Second take");
    expect(second.actions.every((a) => !a.done)).toBe(true);
    expect(coach.notes.size).toBe(1);
  });

  it.each([
    ["future date", { date: "2026-11-12" }],
    ["too old", { date: "2026-10-11" }],
    ["66-char headline", { headline: "a".repeat(66) }],
    ["bad status", { status: "meh" }],
    ["4 highlights", { highlights: ["a", "b", "c", "d"] }],
    ["4 actions", { actionItems: ["a", "b", "c", "d"] }],
  ])("rejects %s and stores nothing", async (_n, patch) => {
    const { deps, coach, token } = await setup();
    const r = toolText(await callTool(deps, token, "post_overall_coach_note", { ...good, ...patch }));
    expect(r.isError).toBe(true);
    expect(r.text).not.toContain("aaaa");
    expect(coach.notes.size).toBe(0);
  });

  it("ignores a stray userId", async () => {
    const { deps, coach, token } = await setup();
    await callTool(deps, token, "post_overall_coach_note", { ...good, userId: "user-2" });
    expect(await coach.get("user-1", "2026-11-11")).not.toBeNull();
    expect(await coach.get("user-2", "2026-11-11")).toBeNull();
  });
});

describe("post_daily_coach_note (retired)", () => {
  it("returns an error pointing to post_overall_coach_note and saves nothing", async () => {
    const { deps, coach, token } = await setup();
    const r = toolText(
      await callTool(deps, token, "post_daily_coach_note", { date: "2026-11-11", summaryMarkdown: "hi", recommendations: ["a"] }),
    );
    expect(r.isError).toBe(true);
    expect(r.text).toContain("post_overall_coach_note");
    expect(coach.notes.size).toBe(0);
  });
});
