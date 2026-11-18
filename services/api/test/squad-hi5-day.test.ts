import { describe, expect, it } from "vitest";
import { handle as hi5Delete } from "../src/handlers/squad-hi5-delete";
import { handle as hi5Put } from "../src/handlers/squad-hi5-put";
import { handle as feedGet } from "../src/handlers/squad-feed-get";
import { handle as timelineGet } from "../src/handlers/squad-member-timeline-get";
import { refreshSquadStats } from "../src/lib/squad-stats";
import { makeDeps, makeEvent, parse, seedProfile, seedWorkoutEntry } from "./fakes";

async function setup() {
  const ctx = makeDeps();
  await seedProfile(ctx.profiles, "user-1", "Asia/Kolkata", "alice");
  await seedProfile(ctx.profiles, "user-2", "Asia/Kolkata", "bob");
  await seedWorkoutEntry(ctx.workouts, "user-2", "2026-11-10", 200, "c-run");
  return ctx;
}
type D = Awaited<ReturnType<typeof setup>>["deps"];
const ID = "user-2~day#2026-11-10";
const hi5 = (d: D, sub: string, id: string, on: boolean) =>
  (on ? hi5Put : hi5Delete)(makeEvent({ sub, pathParameters: { id: encodeURIComponent(id) } }), d).then(parse);
const card = async (d: D, sub: string) => (await timelineGet(makeEvent({ sub, pathParameters: { memberId: "user-2" } }), d).then(parse)).body.items[0].card;

describe("workout-day high-fives", () => {
  it("count once per member, toggle off, and never show in the squad feed", async () => {
    const { deps } = await setup();
    expect((await hi5(deps, "user-1", ID, true)).body).toEqual({ highFives: 1, highFivedByMe: true });
    expect((await hi5(deps, "user-1", ID, true)).body.highFives).toBe(1);
    expect(await card(deps, "user-1")).toMatchObject({ highFives: 1, highFivedByMe: true, canHighFive: true, id: ID });
    expect((await feedGet(makeEvent({ sub: "user-1" }), deps).then(parse)).body.items).toEqual([]);
    expect((await hi5(deps, "user-1", ID, false)).body).toEqual({ highFives: 0, highFivedByMe: false });
  });

  it("rejects your own day and a day without a workout", async () => {
    const { deps } = await setup();
    expect((await hi5(deps, "user-2", ID, true)).status).toBe(404);
    expect((await hi5(deps, "user-1", "user-2~day#2026-11-05", true)).status).toBe(404);
    expect((await card(deps, "user-2")).canHighFive).toBe(false);
  });

  it("is removed with its high-fives when the day stops being a workout day", async () => {
    const { deps, workouts, squad } = await setup();
    await hi5(deps, "user-1", ID, true);
    await refreshSquadStats("user-2", deps);
    expect(squad.feed.has(ID)).toBe(true); // a stats rebuild keeps it while the day is still a workout day
    await workouts.deleteEntry("user-2", "2026-11-10", "c-run");
    await refreshSquadStats("user-2", deps);
    expect(squad.feed.has(ID)).toBe(false);
    expect(squad.reactions.size).toBe(0);
  });
});
