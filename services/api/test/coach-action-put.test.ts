import { describe, expect, it } from "vitest";
import { handle } from "../src/handlers/coach-action-put";
import { makeDeps, makeEvent, parse, seedProfile } from "./fakes";

const note = { date: "2026-11-11", headline: "h", status: "on_track" as const, highlights: ["x"], actionItems: ["a", "b"] };
const AT = "2026-11-11T05:00:00.000Z";

async function setup() {
  const ctx = makeDeps();
  await seedProfile(ctx.profiles);
  await ctx.coach.put("user-1", note, AT);
  return ctx;
}
const ev = (date: string, index: string, body: unknown) => makeEvent({ pathParameters: { date, index }, body });

describe("PUT /coach-note/{date}/actions/{index}", () => {
  it("ticks and un-ticks without changing the note version", async () => {
    const { deps, coach } = await setup();
    let r = parse(await handle(ev("2026-11-11", "1", { done: true, noteUpdatedAt: AT }), deps));
    expect(r.status).toBe(200);
    expect(r.body.actions).toEqual([{ text: "a", done: false }, { text: "b", done: true }]);
    r = parse(await handle(ev("2026-11-11", "1", { done: false, noteUpdatedAt: AT }), deps));
    expect(r.body.actions[1].done).toBe(false);
    expect((await coach.get("user-1", "2026-11-11"))!.updatedAt).toBe(AT);
  });

  it("404 without a v2 note", async () => {
    const { deps, coach } = await setup();
    expect(parse(await handle(ev("2026-11-10", "0", { done: true, noteUpdatedAt: AT }), deps)).status).toBe(404);
    coach.seedLegacy("user-1", "2026-11-09");
    expect(parse(await handle(ev("2026-11-09", "0", { done: true, noteUpdatedAt: AT }), deps)).status).toBe(404);
  });

  it("409 when the note was replaced, or the index is past the actions", async () => {
    const { deps } = await setup();
    const stale = parse(await handle(ev("2026-11-11", "0", { done: true, noteUpdatedAt: "2026-11-11T04:00:00.000Z" }), deps));
    expect(stale.status).toBe(409);
    expect(stale.body.error.fields._).toMatch(/refresh/);
    expect(parse(await handle(ev("2026-11-11", "2", { done: true, noteUpdatedAt: AT }), deps)).status).toBe(409);
  });

  it.each([
    ["index 3", "2026-11-11", "3", { done: true, noteUpdatedAt: AT }],
    ["index x", "2026-11-11", "x", { done: true, noteUpdatedAt: AT }],
    ["missing done", "2026-11-11", "0", { noteUpdatedAt: AT }],
    ["extra key", "2026-11-11", "0", { done: true, noteUpdatedAt: AT, text: "hack" }],
    ["future date", "2026-11-12", "0", { done: true, noteUpdatedAt: AT }],
    ["too old", "2026-10-11", "0", { done: true, noteUpdatedAt: AT }],
  ])("400 for %s", async (_n, date, index, body) => {
    const { deps } = await setup();
    expect(parse(await handle(ev(date, index, body), deps)).status).toBe(400);
  });
});
