import { describe, expect, it } from "vitest";
import { handle as boardsGet } from "../src/handlers/squad-boards-get";
import { handle as fameGet } from "../src/handlers/squad-hall-of-fame-get";
import { handle as feedGet } from "../src/handlers/squad-feed-get";
import { handle as dayGet } from "../src/handlers/squad-member-day-get";
import { handle as squadPut } from "../src/handlers/me-squad-put";
import { handle as targetsPut } from "../src/handlers/me-targets-put";
import { makeDeps, makeEvent, parse, seedProfile, seedWorkoutEntry, validProfile } from "./fakes";
import { gymPut, sets } from "./gym-helpers";

// Clock 2026-11-11T10:00Z → Asia/Kolkata: Wednesday 11 Nov; squad month 2026-11.
async function setup() {
  const ctx = makeDeps();
  await seedProfile(ctx.profiles, "user-1", "Asia/Kolkata", "alice");
  await ctx.profiles.upsert("user-2", "bob", { ...validProfile, displayName: "Bob" }, "2026-01-02T00:00:00.000Z");
  return ctx;
}
type D = Awaited<ReturnType<typeof setup>>["deps"];
const boards = (d: D, sub: string) => boardsGet(makeEvent({ sub }), d).then(parse);
const board = async (d: D, sub: string, id: string) => (await boards(d, sub)).body.boards.find((b: { id: string }) => b.id === id);
const ids = (b: { rows: { member: { userId: string } }[] }) => b.rows.map((r) => r.member.userId);
const bench = (d: D, sub: string, date: string, weightKg: number, reps: number) => gymPut(d, date, "gx-bench-press", { sets: sets(3, weightKg, reps, true) }, sub);
const share = (d: D, sub: string, level: string) =>
  squadPut(makeEvent({ sub, body: { weeklyTarget: 3, leaderboardVisible: true, shareBodyWeight: false, nutritionSharing: level } }), d);

describe("access and privacy", () => {
  it("asks callers without a profile to finish setup", async () => {
    const { deps } = makeDeps();
    expect((await boards(deps as D, "nobody")).status).toBe(409);
    expect((await fameGet(makeEvent({ sub: "nobody" }), deps).then(parse)).status).toBe(409);
  });

  it("drops a hidden member for others and gives them their own unranked row", async () => {
    const { deps } = await setup();
    await bench(deps, "user-1", "2026-11-11", 60, 8);
    await bench(deps, "user-2", "2026-11-11", 60, 8);
    await squadPut(makeEvent({ sub: "user-2", body: { weeklyTarget: 3, leaderboardVisible: false, shareBodyWeight: false } }), deps);

    const forA = await boards(deps, "user-1");
    expect(forA.body.month).toBe("2026-11");
    for (const b of forA.body.boards) expect(ids(b)).not.toContain("user-2");
    expect((await fameGet(makeEvent({ sub: "user-1" }), deps).then(parse)).body.records.find((r: { id: string }) => r.id === "liftBench").holder.userId).toBe("user-1");

    const forB = await boards(deps, "user-2");
    expect(forB.body.viewer.hidden).toBe(true);
    const own = forB.body.boards.find((b: { id: string }) => b.id === "workouts").rows.find((r: { member: { isYou: boolean } }) => r.member.isYou);
    expect(own).toMatchObject({ rank: null, days: 1 });
  });

  it("never serialises body weight, timezone, username, calories or targets", async () => {
    const { deps, profiles } = await setup();
    await profiles.upsert("user-1", "alice", { ...validProfile, bodyWeightKg: 80, dailyProteinTarget: 150 }, "2026-01-01T00:00:00.000Z");
    await bench(deps, "user-1", "2026-11-10", 60, 8);
    await bench(deps, "user-1", "2026-11-11", 65, 5);
    const text = JSON.stringify([(await boards(deps, "user-2")).body, (await feedGet(makeEvent({ sub: "user-2" }), deps).then(parse)).body, (await fameGet(makeEvent({ sub: "user-2" }), deps).then(parse)).body]);
    for (const leak of ["bodyWeight", "timezone", "username", "Calorie", "Asia/Kolkata", "alice", "2200", "150"]) expect(text, leak).not.toContain(leak);
  });
});

describe("protein days and confirmed targets", () => {
  const addFood = (d: D, sub: string, date: string, protein: number) =>
    d.food.putEntry(sub, {
      entryId: `${date}-${Math.random()}`, source: "typed", name: "Bowl", servings: 1, calories: 600, macros: { protein, carbs: 40, fat: 10 },
      rate: { calories: 600, macros: { protein, carbs: 40, fat: 10 } }, meal: "lunch", date, createdAt: "t", updatedAt: "t",
    });

  it("ranks confirmed members only, and hides unconfirmed targets from others until confirmed", async () => {
    const { deps, profiles } = await setup();
    for (const sub of ["user-1", "user-2"]) {
      await targetsPut(makeEvent({ sub, body: { dailyCalorieTarget: 2000, dailyProteinTarget: 100 } }), deps);
      await share(deps, sub, "totals");
      await addFood(deps, sub, "2026-11-10", 120);
    }
    await seedWorkoutEntry(deps.workouts as never, "user-2", "2026-11-10", 200, "c-run");
    // Bob's targets came from before feature 013: never confirmed.
    const { targetsConfirmedAt: _c, ...bob } = profiles.items.get("user-2")!;
    profiles.items.set("user-2", bob);

    const protein = await board(deps, "user-1", "protein");
    expect(protein.rows.map((r: { member: { userId: string }; hitDays: number; loggedDays: number }) => [r.member.userId, r.hitDays, r.loggedDays])).toEqual([["user-1", 1, 1]]);

    const day = (sub: string) => dayGet(makeEvent({ sub, pathParameters: { memberId: "user-2", date: "2026-11-10" } }), deps).then(parse);
    expect((await day("user-1")).body.nutrition).toMatchObject({ protein: 120, proteinTarget: null, calorieTarget: null });
    expect((await day("user-2")).body.nutrition).toMatchObject({ proteinTarget: 100, calorieTarget: 2000 });
    expect((await boards(deps, "user-2")).body.viewer.targetsPrompt).toBe(true);

    await targetsPut(makeEvent({ sub: "user-2", body: { dailyCalorieTarget: 2000, dailyProteinTarget: 100 } }), deps);
    expect((await day("user-1")).body.nutrition).toMatchObject({ proteinTarget: 100, calorieTarget: 2000 });
    expect(ids(await board(deps, "user-1", "protein"))).toEqual(["user-1", "user-2"]);
    expect((await boards(deps, "user-2")).body.viewer.targetsPrompt).toBe(false);
  });

  it("shows an empty protein board while nobody has hit their goal, and no board when nobody shares", async () => {
    const { deps } = await setup();
    expect(await board(deps, "user-1", "protein")).toBeUndefined();
    await targetsPut(makeEvent({ sub: "user-1", body: { dailyCalorieTarget: 2000, dailyProteinTarget: 100 } }), deps);
    await share(deps, "user-1", "totals");
    await addFood(deps, "user-1", "2026-11-10", 40); // logged, but a miss
    expect((await board(deps, "user-2", "protein")).rows).toEqual([]);
  });

  it("lets a member dismiss the prompt without confirming", async () => {
    const { deps, profiles } = await setup();
    const { targetsConfirmedAt: _c, ...alice } = profiles.items.get("user-1")!;
    profiles.items.set("user-1", alice);
    const res = parse(await targetsPut(makeEvent({ sub: "user-1", body: { dismiss: true } }), deps));
    expect(res.body.profile).toMatchObject({ targetsConfirmed: false, targetsPromptDismissed: true });
    expect((await boards(deps, "user-1")).body.viewer.targetsPrompt).toBe(false);
    expect(parse(await targetsPut(makeEvent({ sub: "user-1", body: { dailyCalorieTarget: 100 } }), deps)).status).toBe(400);
  });
});
