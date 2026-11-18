import { describe, expect, it } from "vitest";
import { handle as feedGet } from "../src/handlers/squad-feed-get";
import { handle as hi5Delete } from "../src/handlers/squad-hi5-delete";
import { handle as hi5Put } from "../src/handlers/squad-hi5-put";
import { handle as boardGet } from "../src/handlers/squad-leaderboard-get";
import { handle as squadPut } from "../src/handlers/me-squad-put";
import { makeDeps, makeEvent, parse, seedProfile, validProfile } from "./fakes";
import { gymPut, sets } from "./gym-helpers";

// Fixed clock 2026-11-11T10:00Z → Asia/Kolkata today = Wednesday 2026-11-11 (week of 2026-11-09).
async function setup() {
  const ctx = makeDeps();
  await seedProfile(ctx.profiles, "user-1", "Asia/Kolkata", "alice");
  await seedProfile(ctx.profiles, "user-2", "Asia/Kolkata", "bob");
  await ctx.profiles.upsert("user-2", "bob", { ...validProfile, displayName: "Bob" }, "2026-01-02T00:00:00.000Z");
  return ctx;
}
type D = Awaited<ReturnType<typeof setup>>["deps"];

const board = (deps: D, sub: string, q: Record<string, string> = {}) =>
  boardGet(makeEvent({ sub, queryStringParameters: q }), deps).then(parse);
const feed = (deps: D, sub: string) => feedGet(makeEvent({ sub }), deps).then(parse);
const hi5 = (deps: D, sub: string, id: string, on: boolean) =>
  (on ? hi5Put : hi5Delete)(makeEvent({ sub, pathParameters: { id: encodeURIComponent(id) } }), deps).then(parse);
const bench = (deps: D, sub: string, date: string, weightKg: number, reps: number) =>
  gymPut(deps, date, "gx-bench-press", { sets: sets(3, weightKg, reps, true) }, sub);

describe("access and privacy", () => {
  it("asks callers without a profile to finish setup", async () => {
    const { deps } = makeDeps() as unknown as { deps: D };
    expect((await board(deps, "nobody")).status).toBe(409);
    expect((await feed(deps, "nobody")).status).toBe(409);
  });

  it("hides an opted-out member from others, shows them their own unranked row, and keeps members with no stats", async () => {
    const { deps, profiles } = await setup();
    await seedProfile(profiles, "user-3", "Asia/Kolkata", "carol");
    await bench(deps, "user-1", "2026-11-11", 60, 8);
    await bench(deps, "user-2", "2026-11-11", 60, 8);
    await squadPut(makeEvent({ sub: "user-2", body: { weeklyTarget: 3, leaderboardVisible: false, shareBodyWeight: false } }), deps);

    const forA = (await board(deps, "user-1")).body;
    expect(forA.viewerHidden).toBe(false);
    const ids = forA.streaks.map((r: { member: { userId: string } }) => r.member.userId);
    expect(ids).toContain("user-1");
    expect(ids).toContain("user-3"); // no stats yet: still listed with a streak of 0
    expect(ids).not.toContain("user-2");

    const forB = (await board(deps, "user-2")).body;
    expect(forB.viewerHidden).toBe(true);
    const own = forB.streaks.find((r: { member: { isYou: boolean } }) => r.member.isYou);
    expect(own.rank).toBeNull();
    expect(forB.streaks.filter((r: { rank: number | null }) => r.rank !== null).map((r: { member: { userId: string } }) => r.member.userId)).not.toContain("user-2");
  });

  it("never serialises body weight, timezone, username or calorie target", async () => {
    const { deps, profiles } = await setup();
    await profiles.upsert("user-1", "alice", { ...validProfile, bodyWeightKg: 80 }, "2026-01-01T00:00:00.000Z");
    await squadPut(makeEvent({ sub: "user-1", body: { weeklyTarget: 3, leaderboardVisible: true, shareBodyWeight: true } }), deps);
    await bench(deps, "user-1", "2026-11-10", 60, 8);
    await bench(deps, "user-1", "2026-11-11", 65, 5);
    const text = JSON.stringify([(await board(deps, "user-2")).body, (await feed(deps, "user-2")).body]);
    for (const leak of ["bodyWeight", "timezone", "username", "dailyCalorieTarget", "Asia/Kolkata", "alice", "2200"]) {
      expect(text, leak).not.toContain(leak);
    }
  });
});

describe("lift board", () => {
  it("shows relative strength only for members who opted in with a saved body weight", async () => {
    const { deps, profiles } = await setup();
    await profiles.upsert("user-1", "alice", { ...validProfile, bodyWeightKg: 80 }, "2026-01-01T00:00:00.000Z");
    await squadPut(makeEvent({ sub: "user-1", body: { weeklyTarget: 3, leaderboardVisible: true, shareBodyWeight: true } }), deps);
    await gymPut(deps, "2026-11-11", "gx-bench-press", { sets: sets(1, 75, 10, true) }, "user-1"); // e1RM 100
    await bench(deps, "user-2", "2026-11-11", 60, 8);

    const rows = (await board(deps, "user-2")).body.lift.rows;
    const alice = rows.find((r: { member: { userId: string } }) => r.member.userId === "user-1");
    const bob = rows.find((r: { member: { userId: string } }) => r.member.userId === "user-2");
    expect(alice).toMatchObject({ rank: 1, e1rm: 100, relative: 1.25, relativeRank: 1 });
    expect(bob).toMatchObject({ relative: null, relativeRank: null });
  });
});

describe("feed and high-fives", () => {
  const prId = "user-1~pr#gx-bench-press#2026-11-11";

  it("shows a PR, toggles one high-five per member, and drops the item when the PR is edited away", async () => {
    const { deps } = await setup();
    await bench(deps, "user-1", "2026-11-10", 60, 8); // baseline
    await bench(deps, "user-1", "2026-11-11", 65, 5); // PR

    const items = (await feed(deps, "user-2")).body.items;
    expect(items.map((i: { id: string }) => i.id)).toContain(prId);

    expect((await hi5(deps, "user-2", prId, true)).body).toEqual({ highFives: 1, highFivedByMe: true });
    expect((await hi5(deps, "user-2", prId, true)).body.highFives).toBe(1); // idempotent
    expect((await hi5(deps, "user-2", prId, false)).body).toEqual({ highFives: 0, highFivedByMe: false });

    await bench(deps, "user-1", "2026-11-11", 55, 5); // no longer beats the 60 kg best
    const after = (await feed(deps, "user-2")).body.items;
    expect(after.map((i: { id: string }) => i.id)).not.toContain(prId);
    expect((await hi5(deps, "user-2", prId, true)).status).toBe(404);
  });

  it("hides a hidden member's items and their high-fives from others", async () => {
    const { deps } = await setup();
    await bench(deps, "user-1", "2026-11-11", 60, 8); // first workout event
    await squadPut(makeEvent({ sub: "user-1", body: { weeklyTarget: 3, leaderboardVisible: false, shareBodyWeight: false } }), deps);
    expect((await feed(deps, "user-2")).body.items).toEqual([]);
    expect((await feed(deps, "user-1")).body.items.length).toBeGreaterThan(0);
    expect((await hi5(deps, "user-2", "user-1~first", true)).status).toBe(404);
  });
});
