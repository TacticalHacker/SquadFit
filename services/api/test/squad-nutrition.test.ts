import { describe, expect, it } from "vitest";
import { handle as squadPut } from "../src/handlers/me-squad-put";
import { handle as feedGet } from "../src/handlers/squad-feed-get";
import { handle as boardGet } from "../src/handlers/squad-leaderboard-get";
import { handle as timelineGet } from "../src/handlers/squad-member-timeline-get";
import { handle as dayGet } from "../src/handlers/squad-member-day-get";
import { refreshProteinEvents } from "../src/lib/protein-events";
import type { FoodEntryItem } from "../src/lib/food-repo";
import { makeDeps, makeEvent, parse, seedProfile, seedWorkoutEntry, validProfile } from "./fakes";

async function setup() {
  const ctx = makeDeps();
  for (const [sub, name] of [["user-1", "Alice"], ["user-2", "Bob"], ["user-3", "Cy"]] as const) {
    await ctx.profiles.upsert(sub, name.toLowerCase(), { ...validProfile, displayName: name, dailyProteinTarget: 100 }, "2026-01-02T00:00:00.000Z");
  }
  return ctx;
}
type D = Awaited<ReturnType<typeof setup>>["deps"];

const share = (d: D, sub: string, level: string) =>
  squadPut(makeEvent({ sub, body: { weeklyTarget: 3, leaderboardVisible: true, shareBodyWeight: false, nutritionSharing: level } }), d);
const addFood = (d: D, sub: string, date: string, protein: number, extra: Partial<FoodEntryItem> = {}) =>
  d.food.putEntry(sub, {
    entryId: `${date}-${Math.random()}`, source: "typed", name: "Chicken bowl", servings: 1, calories: 600, macros: { protein, carbs: 40, fat: 10 },
    rate: { calories: 600, macros: { protein, carbs: 40, fat: 10 } }, meal: "lunch", date, createdAt: "t", updatedAt: "t", ...extra,
  });
const memberEv = (sub: string, id: string, date?: string) => makeEvent({ sub, pathParameters: { memberId: id, ...(date ? { date } : {}) } });
const dayOf = (d: D, sub: string, id: string, date: string) => dayGet(memberEv(sub, id, date), d).then(parse);
const board = (d: D, sub: string, q: Record<string, string> = {}) => boardGet(makeEvent({ sub, queryStringParameters: q }), d).then(parse);

const TOTALS = ["burned", "burnedAdjusted", "calorieTarget", "caloriesIn", "carbs", "fat", "pending", "protein", "proteinTarget"];

describe("sharing levels", () => {
  it("returns exactly the allowed fields at each level, and reflects a change on past days at once", async () => {
    const { deps, workouts } = await setup();
    await seedWorkoutEntry(workouts, "user-2", "2026-11-09", 300, "c-run");
    await addFood(deps, "user-2", "2026-11-09", 80, { source: "photo", photo: { status: "ai", caption: "dinner" }, photoKey: "food-photos/user-2/x.jpg" } as Partial<FoodEntryItem>);

    const off = (await dayOf(deps, "user-1", "user-2", "2026-11-09")).body;
    expect(off).not.toHaveProperty("nutrition");
    expect(JSON.stringify(off)).not.toContain("Chicken");

    await share(deps, "user-2", "totals");
    const totals = (await dayOf(deps, "user-1", "user-2", "2026-11-09")).body.nutrition;
    expect(Object.keys(totals).sort()).toEqual(TOTALS);
    expect(totals).toMatchObject({ caloriesIn: 600, protein: 80, burned: 300, proteinTarget: 100 });
    expect(JSON.stringify(totals)).not.toMatch(/meals|photo|x\.jpg|caption/);

    await share(deps, "user-2", "meals");
    const meals = (await dayOf(deps, "user-1", "user-2", "2026-11-09")).body.nutrition;
    expect(Object.keys(meals).sort()).toEqual([...TOTALS, "meals"].sort());
    expect(meals.meals[0].items[0]).toMatchObject({ caption: "dinner", photoUrl: expect.stringContaining("food-photos/user-2/x.jpg") });

    await share(deps, "user-2", "off");
    expect((await dayOf(deps, "user-1", "user-2", "2026-11-09")).body).not.toHaveProperty("nutrition");
  });

  it("shows nothing to others once the owner hides from the leaderboard, whatever the level", async () => {
    const { deps, workouts } = await setup();
    await seedWorkoutEntry(workouts, "user-2", "2026-11-09", 300, "c-run");
    await addFood(deps, "user-2", "2026-11-09", 80);
    await share(deps, "user-2", "meals");
    await squadPut(makeEvent({ sub: "user-2", body: { weeklyTarget: 3, leaderboardVisible: false, shareBodyWeight: false } }), deps);
    expect((await dayOf(deps, "user-1", "user-2", "2026-11-09")).status).toBe(403);
    expect(JSON.stringify((await board(deps, "user-1")).body)).not.toContain("Chicken");
  });

  it("labels burned calories as adjusted when any workout carries an AI note", async () => {
    const { deps, workouts } = await setup();
    await seedWorkoutEntry(workouts, "user-2", "2026-11-09", 300, "c-run");
    await workouts.putEntryIfAbsent("user-2", { date: "2026-11-09", workoutId: "c-yoga", name: "Yoga", rateMinutes: 30, rateCalories: 90, minutes: 30, calories: 90, aiNote: "Heart rate was low", createdAt: "t", updatedAt: "t" });
    await share(deps, "user-2", "totals");
    expect((await dayOf(deps, "user-1", "user-2", "2026-11-09")).body.nutrition.burnedAdjusted).toBe(true);
    const row = (await board(deps, "user-1", { date: "2026-11-09" })).body.nutritionToday.find((r: { userId: string }) => r.userId === "user-2");
    expect(Object.keys(row.nutrition).sort()).toEqual(TOTALS);
    expect(row.nutrition.burnedAdjusted).toBe(true);
  });

  it("shows the one-time card until a choice is made or it is dismissed", async () => {
    const { deps } = await setup();
    expect((await board(deps, "user-1")).body.viewer.nutritionPrompt).toBe(true);
    await squadPut(makeEvent({ sub: "user-1", body: { weeklyTarget: 3, leaderboardVisible: true, shareBodyWeight: false, dismissPrompt: true } }), deps);
    expect((await board(deps, "user-1")).body.viewer.nutritionPrompt).toBe(false);
    expect((await board(deps, "user-1")).body.nutrition.viewer.level).toBe("off");
  });
});

describe("nutrition board", () => {
  it("ranks on days hitting the member's own target; ties share a rank; off and no-target members are excluded", async () => {
    const { deps, profiles } = await setup();
    await profiles.upsert("user-4", "dee", { ...validProfile, displayName: "Dee" }, "2026-01-02T00:00:00.000Z"); // no protein target
    for (const sub of ["user-1", "user-2", "user-3", "user-4"]) await share(deps, sub, sub === "user-3" ? "off" : "totals");
    for (const d of ["2026-11-09", "2026-11-10"]) {
      await addFood(deps, "user-1", d, 100);
      await addFood(deps, "user-2", d, 120);
      await addFood(deps, "user-3", d, 200);
      await addFood(deps, "user-4", d, 200);
    }
    await addFood(deps, "user-1", "2026-11-11", 10); // logged, but a miss

    const nut = (await board(deps, "user-1", { period: "week" })).body.nutrition;
    expect(nut.rows.map((r: { member: { userId: string }; rank: number; hitDays: number }) => [r.member.userId, r.rank, r.hitDays])).toEqual([["user-1", 1, 2], ["user-2", 1, 2]]);
    expect(nut.rows[0]).toMatchObject({ periodDays: 3, daysLogged: 3 });
    expect(nut.viewer).toEqual({ level: "totals", needsTarget: false });
    expect(JSON.stringify(nut)).not.toMatch(/calor|burn|kcal/i);

    const dee = (await board(deps, "user-4")).body.nutrition;
    expect(dee.viewer.needsTarget).toBe(true);
  });
});

describe("protein streak feed item", () => {
  it("appears after 7 hit days for a sharing member and disappears when sharing goes off", async () => {
    const { deps } = await setup();
    await share(deps, "user-2", "totals");
    for (let i = 5; i <= 11; i++) await addFood(deps, "user-2", `2026-11-${String(i).padStart(2, "0")}`, 110);
    await refreshProteinEvents("user-2", deps);
    const items = (await feedGet(makeEvent({ sub: "user-1" }), deps).then(parse)).body.items;
    expect(items.map((i: { kind: string }) => i.kind)).toEqual(["protein_streak"]);

    const tl = (await timelineGet(memberEv("user-1", "user-2"), deps).then(parse)).body;
    expect(tl.items.some((i: { kind: string }) => i.kind === "protein_streak")).toBe(true);

    await share(deps, "user-2", "off");
    expect((await feedGet(makeEvent({ sub: "user-1" }), deps).then(parse)).body.items).toEqual([]);
  });
});
