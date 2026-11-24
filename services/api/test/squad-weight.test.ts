import { describe, expect, it } from "vitest";
import { handle as post } from "../src/handlers/weight-post";
import { handle as squadWeight } from "../src/handlers/squad-weight-get";
import { handle as squadPut } from "../src/handlers/me-squad-put";
import { makeDeps, makeEvent, parse, seedProfile, validProfile } from "./fakes";

describe("GET /squad/weight", () => {
  it("shows opted-in, visible members as kg change only", async () => {
    const t = makeDeps("2026-11-24T02:00:00.000Z");
    await seedProfile(t.profiles);
    for (const [sub, name] of [["user-2", "Bob"], ["user-3", "Cleo"], ["user-4", "Dev"]] as const) {
      await t.profiles.upsert(sub, name.toLowerCase(), { ...validProfile, displayName: name }, "2026-01-02T00:00:00.000Z");
    }
    const log = (sub: string, weightKg: number, date: string) => post(makeEvent({ sub, body: { weightKg, date } }), t.deps);
    const settings = (sub: string, shareBodyWeight: boolean, leaderboardVisible = true) =>
      squadPut(makeEvent({ sub, body: { weeklyTarget: 3, leaderboardVisible, shareBodyWeight } }), t.deps);
    for (const sub of ["user-1", "user-2", "user-3", "user-4"]) {
      await log(sub, 82.4, "2026-11-22");
      await log(sub, 81.1, "2026-11-24");
    }
    await settings("user-1", true);
    await settings("user-2", true);
    await settings("user-3", false); // not sharing
    await settings("user-4", true, false); // hidden from the squad

    const r = parse(await squadWeight(makeEvent({ sub: "user-1", queryStringParameters: { range: "W" } }), t.deps));
    expect(r.status).toBe(200);
    expect(r.body.sharing).toBe(true);
    expect(r.body.members.map((m: { member: { displayName: string; isYou: boolean } }) => m.member.isYou || m.member.displayName)).toEqual([true, "Bob"]);
    expect(r.body.members[1]).toMatchObject({ change: -1.3 });
    expect(r.body.members[1].deltas.filter((d: number | null) => d !== null)).toEqual([0, -1.3]);
    expect(JSON.stringify(r.body)).not.toMatch(/82\.4|81\.1/);
  });
});
