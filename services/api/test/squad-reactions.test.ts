import { describe, expect, it } from "vitest";
import { handle as rxDelete } from "../src/handlers/squad-reaction-delete";
import { handle as rxPut } from "../src/handlers/squad-reaction-put";
import { handle as feedGet } from "../src/handlers/squad-feed-get";
import { handle as exercisePost } from "../src/handlers/gym-exercise-post";
import { handle as timelineGet } from "../src/handlers/squad-member-timeline-get";
import { handle as squadPut } from "../src/handlers/me-squad-put";
import { refreshSquadStats } from "../src/lib/squad-stats";
import { parseHighFiveSk } from "../src/lib/squad-repo";
import { makeDeps, makeEvent, parse, seedProfile, seedWorkoutEntry } from "./fakes";
import { gymPut, sets } from "./gym-helpers";

async function setup() {
  const ctx = makeDeps();
  await seedProfile(ctx.profiles, "user-1", "Asia/Kolkata", "alice");
  await seedProfile(ctx.profiles, "user-2", "Asia/Kolkata", "bob");
  await seedProfile(ctx.profiles, "user-3", "Asia/Kolkata", "cy");
  await seedWorkoutEntry(ctx.workouts, "user-2", "2026-11-10", 200, "c-run");
  return ctx;
}
type D = Awaited<ReturnType<typeof setup>>["deps"];
const DAY = "user-2~day#2026-11-10";
const PR = "user-1~pr#gx-bench-press#2026-11-11";
const rx = (d: D, sub: string, id: string, type: string, on: boolean) =>
  (on ? rxPut : rxDelete)(makeEvent({ sub, pathParameters: { id: encodeURIComponent(id), type } }), d).then(parse);
const counts = (r: { body: { reactions: Record<string, { count: number; mine: boolean }> } }) =>
  Object.fromEntries(Object.entries(r.body.reactions).map(([k, v]) => [k, [v.count, v.mine]]));
const bench = (d: D, sub: string, date: string, weightKg: number, reps: number) => gymPut(d, date, "gx-bench-press", { sets: sets(3, weightKg, reps, true) }, sub);

describe("feed reactions", () => {
  it("toggle each type once per member, count every member, and go when the PR is edited away", async () => {
    const { deps } = await setup();
    await bench(deps, "user-1", "2026-11-10", 60, 8); // baseline
    await bench(deps, "user-1", "2026-11-11", 65, 5); // PR

    expect(counts(await rx(deps, "user-2", PR, "fire", true))).toEqual({ fire: [1, true], muscle: [0, false], crown: [0, false] });
    await rx(deps, "user-2", PR, "fire", true); // idempotent
    await rx(deps, "user-2", PR, "muscle", true);
    expect(counts(await rx(deps, "user-3", PR, "fire", true))).toEqual({ fire: [2, true], muscle: [1, false], crown: [0, false] });
    expect(counts(await rx(deps, "user-2", PR, "fire", false))).toEqual({ fire: [1, false], muscle: [1, true], crown: [0, false] });

    const item = (await feedGet(makeEvent({ sub: "user-2" }), deps).then(parse)).body.items.find((i: { id: string }) => i.id === PR);
    expect(item).toMatchObject({ canReact: true, pr: { gainKg: expect.any(Number) }, reactions: { muscle: { count: 1, mine: true } } });

    await bench(deps, "user-1", "2026-11-11", 55, 5); // no longer beats the 60 kg best
    expect((await rx(deps, "user-2", PR, "fire", true)).status).toBe(404);
  });

  it("lists PRs on built-in exercises only; own-exercise PRs stay on the profile", async () => {
    const { deps } = await setup();
    const own = (await exercisePost(makeEvent({ sub: "user-1", body: { name: "Forearm Curl", group: "arms" } }), deps).then(parse)).body.exercise.exerciseId;
    expect(own).toMatch(/^gc-/);
    await gymPut(deps, "2026-11-10", own, { sets: sets(3, 20, 8, true) });
    await gymPut(deps, "2026-11-11", own, { sets: sets(3, 25, 8, true) }); // PR on an own exercise
    await bench(deps, "user-1", "2026-11-10", 60, 8);
    await bench(deps, "user-1", "2026-11-11", 65, 5);
    const ids = (await feedGet(makeEvent({ sub: "user-2" }), deps).then(parse)).body.items.map((i: { id: string }) => i.id);
    expect(ids).toContain(PR);
    expect(ids.some((id: string) => id.includes(own))).toBe(false);
  });

  it("refuses own items, unknown types and hidden authors", async () => {
    const { deps } = await setup();
    await bench(deps, "user-1", "2026-11-11", 60, 8); // "first" event
    expect((await rx(deps, "user-1", "user-1~first", "fire", true)).status).toBe(404);
    expect((await rx(deps, "user-2", "user-1~first", "heart", true)).status).toBe(400);
    expect((await feedGet(makeEvent({ sub: "user-1" }), deps).then(parse)).body.items[0].canReact).toBe(false);
    await squadPut(makeEvent({ sub: "user-1", body: { weeklyTarget: 3, leaderboardVisible: false, shareBodyWeight: false } }), deps);
    expect((await feedGet(makeEvent({ sub: "user-2" }), deps).then(parse)).body.items).toEqual([]);
    expect((await rx(deps, "user-2", "user-1~first", "fire", true)).status).toBe(404);
  });
});

describe("workout-day reactions", () => {
  const card = async (d: D, sub: string) => (await timelineGet(makeEvent({ sub, pathParameters: { memberId: "user-2" } }), d).then(parse)).body.items[0].card;

  it("are created lazily for a workout day only, never listed, and removed when the day stops being one", async () => {
    const { deps, workouts, squad } = await setup();
    expect((await rx(deps, "user-1", "user-2~day#2026-11-05", "crown", true)).status).toBe(404);
    await rx(deps, "user-1", DAY, "crown", true);
    expect(await card(deps, "user-1")).toMatchObject({ id: DAY, canReact: true, reactions: { crown: { count: 1, mine: true } } });
    expect((await card(deps, "user-2")).canReact).toBe(false);
    expect((await feedGet(makeEvent({ sub: "user-1" }), deps).then(parse)).body.items.some((i: { id: string }) => i.id === DAY)).toBe(false);

    await refreshSquadStats("user-2", deps);
    expect(squad.feed.has(DAY)).toBe(true);
    await workouts.deleteEntry("user-2", "2026-11-10", "c-run");
    await refreshSquadStats("user-2", deps);
    expect(squad.feed.has(DAY)).toBe(false);
    expect(squad.reactions.size).toBe(0);
  });
});

describe("high-five migration", () => {
  it("reads event ids that contain '#' from the old high-five key", () => {
    expect(parseHighFiveSk("HI5#pr#gx-bench-press#2026-11-11#user-9")).toEqual({ eventId: "pr#gx-bench-press#2026-11-11", reactor: "user-9" });
    expect(parseHighFiveSk("HI5#day#2026-11-10#abc-123")).toEqual({ eventId: "day#2026-11-10", reactor: "abc-123" });
  });
});
