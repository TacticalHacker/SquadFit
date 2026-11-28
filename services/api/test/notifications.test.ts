import { describe, expect, it } from "vitest";
import { handle as rxDelete } from "../src/handlers/squad-reaction-delete";
import { handle as rxPut } from "../src/handlers/squad-reaction-put";
import { handle as meGet } from "../src/handlers/me-get";
import { handle as listGet } from "../src/handlers/me-notifications-get";
import { handle as seenPut } from "../src/handlers/me-notifications-seen-put";
import { handle as reactorsGet } from "../src/handlers/squad-reactors-get";
import { handle as squadPut } from "../src/handlers/me-squad-put";
import { makeDeps, makeEvent, parse, seedProfile, seedWorkoutEntry } from "./fakes";

async function setup() {
  const ctx = makeDeps();
  await seedProfile(ctx.profiles, "user-1", "Asia/Kolkata", "alice");
  await seedProfile(ctx.profiles, "user-2", "Asia/Kolkata", "bob");
  await seedProfile(ctx.profiles, "user-3", "Asia/Kolkata", "cy");
  await seedWorkoutEntry(ctx.workouts, "user-2", "2026-11-10", 200, "c-run");
  ctx.setNow("2026-11-11T10:00:00.000Z");
  return ctx;
}
type D = Awaited<ReturnType<typeof setup>>["deps"];
const DAY = "user-2~day#2026-11-10";
const rx = (d: D, sub: string, type: string, on: boolean) => (on ? rxPut : rxDelete)(makeEvent({ sub, pathParameters: { id: encodeURIComponent(DAY), type } }), d);
const list = (d: D) => listGet(makeEvent({ sub: "user-2" }), d).then(parse);
const unread = async (d: D) => (await meGet(makeEvent({ sub: "user-2" }), d).then(parse)).body.unreadNotifications;
const hide = (d: D, sub: string) => squadPut(makeEvent({ sub, body: { weeklyTarget: 3, leaderboardVisible: false, shareBodyWeight: false } }), d);

describe("reaction notifications (feature 022)", () => {
  it("one per reactor and item, merged types, gone when every reaction is removed, cleared by seen", async () => {
    const { deps, setNow } = await setup();
    await rx(deps, "user-1", "fire", true);
    await rx(deps, "user-1", "muscle", true);
    await rx(deps, "user-3", "crown", true);
    expect(await unread(deps)).toBe(2);

    const { body } = await list(deps);
    expect(body.items).toHaveLength(2);
    expect(body.items.find((i: { reactor: { userId: string } }) => i.reactor.userId === "user-1")).toMatchObject({
      types: ["fire", "muscle"],
      item: { id: DAY, ownerId: "user-2", kind: "workout_day", date: "2026-11-10" },
      unread: true,
    });

    await rx(deps, "user-3", "crown", false);
    expect((await list(deps)).body.items).toHaveLength(1);

    expect(parse(await seenPut(makeEvent({ sub: "user-2", body: { upTo: body.latestAt } }), deps)).body.unreadCount).toBe(0);
    expect(await unread(deps)).toBe(0);
    setNow("2026-11-11T11:00:00.000Z");
    await rx(deps, "user-3", "fire", true); // newer than the marker
    expect(await unread(deps)).toBe(1);
  });

  it("names a hidden reactor to no one but themself", async () => {
    const { deps } = await setup();
    await hide(deps, "user-3");
    await rx(deps, "user-3", "fire", true);
    await rx(deps, "user-1", "fire", true);

    expect((await list(deps)).body.items.map((i: { reactor: unknown }) => i.reactor === null).sort()).toEqual([false, true]);

    const who = (sub: string) => reactorsGet(makeEvent({ sub, pathParameters: { id: encodeURIComponent(DAY) } }), deps).then(parse);
    expect((await who("user-2")).body.fire).toMatchObject({ members: [{ userId: "user-1" }], others: 1 });
    const own = (await who("user-3")).body.fire;
    expect(own.members.map((m: { userId: string; isYou: boolean }) => [m.userId, m.isYou])).toEqual([["user-3", true], ["user-1", false]]);
    expect(own.others).toBe(0);
  });

  it("404s who-reacted for a hidden author", async () => {
    const { deps } = await setup();
    await hide(deps, "user-2");
    expect(parse(await reactorsGet(makeEvent({ sub: "user-1", pathParameters: { id: encodeURIComponent(DAY) } }), deps)).status).toBe(404);
  });
});
