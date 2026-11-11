import { describe, expect, it } from "vitest";
import { handle } from "../src/handlers/coach-note-get";
import { makeDeps, makeEvent, parse, seedProfile } from "./fakes";

describe("GET /coach-note", () => {
  it("returns null when absent, then the note", async () => {
    const { deps, profiles, coach } = makeDeps();
    await seedProfile(profiles);
    expect(parse(await handle(makeEvent({}), deps)).body).toEqual({ note: null });
    await coach.put("user-1", { date: "2026-11-11", summaryMarkdown: "hi", recommendations: ["a"] }, "2026-11-11T05:00:00.000Z");
    const r = parse(await handle(makeEvent({ queryStringParameters: { date: "2026-11-11" } }), deps));
    expect(r.status).toBe(200);
    expect(r.body.note).toEqual({ date: "2026-11-11", summaryMarkdown: "hi", recommendations: ["a"], generatedBy: "AI", updatedAt: "2026-11-11T05:00:00.000Z" });
  });

  it("never returns another member's note", async () => {
    const { deps, profiles, coach } = makeDeps();
    await seedProfile(profiles);
    await coach.put("user-2", { date: "2026-11-11", summaryMarkdown: "bob", recommendations: ["a"] }, "t");
    expect(parse(await handle(makeEvent({}), deps)).body).toEqual({ note: null });
  });

  it("400 for a future date, 409 without profile", async () => {
    const { deps, profiles } = makeDeps();
    expect(parse(await handle(makeEvent({}), deps)).status).toBe(409);
    await seedProfile(profiles);
    expect(parse(await handle(makeEvent({ queryStringParameters: { date: "2026-11-12" } }), deps)).status).toBe(400);
  });
});
