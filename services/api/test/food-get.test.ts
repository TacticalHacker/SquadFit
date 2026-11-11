import { describe, expect, it } from "vitest";
import { handle } from "../src/handlers/food-get";
import { makeDeps, makeEvent, parse, seedProfile, seedWorkoutEntry } from "./fakes";
import { addPhoto } from "./photo-helpers";

type D = Parameters<typeof handle>[1];
const get = (deps: D, date?: string, sub = "user-1") =>
  handle(makeEvent({ sub, ...(date ? { queryStringParameters: { date } } : {}) }), deps).then(parse);

const item = (date: string, entryId: string, calories: number, over: Record<string, unknown> = {}) => ({
  entryId, date, meal: "lunch" as const, source: "typed" as const, name: "Thing", servings: 1, calories,
  macros: null, rate: { calories, macros: null }, createdAt: "t", updatedAt: "t", ...over,
});

describe("GET /food", () => {
  it("409 without a profile", async () => {
    const { deps } = makeDeps();
    const r = await get(deps);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("PROFILE_REQUIRED");
  });

  it("gives a new user four empty meals and a full target remaining", async () => {
    const { deps, profiles } = makeDeps("2026-11-11T10:00:00.000Z");
    await seedProfile(profiles);
    const r = await get(deps);
    expect(r.status).toBe(200);
    expect(r.body.date).toBe("2026-11-11");
    expect(r.body.editable).toBe(true);
    expect(r.body.meals.map((m: { meal: string }) => m.meal)).toEqual(["breakfast", "lunch", "dinner", "snacks"]);
    expect(r.body.ledger).toMatchObject({ eaten: 0, burned: 0, net: 0, target: 2200, remaining: 2200 });
  });

  it("lists entries in the order added and never shows another user's", async () => {
    const { deps, profiles, food } = makeDeps();
    await seedProfile(profiles);
    await food.putEntry("user-1", item("2026-11-11", "1762851000002-aaaaaa", 200, { name: "Second" }));
    await food.putEntry("user-1", item("2026-11-11", "1762851000001-bbbbbb", 100, { name: "First" }));
    await food.putEntry("user-2", item("2026-11-11", "1762851000003-cccccc", 999));
    const r = await get(deps);
    expect(r.body.meals[1].entries.map((e: { name: string }) => e.name)).toEqual(["First", "Second"]);
    expect(r.body.ledger.eaten).toBe(300);
  });

  it("400 for future or malformed dates", async () => {
    const { deps, profiles } = makeDeps("2026-11-11T10:00:00.000Z");
    await seedProfile(profiles);
    expect((await get(deps, "2026-11-12")).status).toBe(400);
    expect((await get(deps, "nope")).status).toBe(400);
  });

  it("computes the ledger: eaten, burned from workouts, net, remaining, macros", async () => {
    const { deps, profiles, food, workouts } = makeDeps("2026-11-11T10:00:00.000Z");
    await seedProfile(profiles);
    await food.putEntry("user-1", item("2026-11-11", "1762851000001-aaaaaa", 300, { macros: { protein: 10, carbs: 40, fat: 5 }, rate: { calories: 300, macros: { protein: 10, carbs: 40, fat: 5 } } }));
    await food.putEntry("user-1", item("2026-11-11", "1762851000002-bbbbbb", 100));
    await seedWorkoutEntry(workouts, "user-1", "2026-11-11", 300);
    await seedWorkoutEntry(workouts, "user-1", "2026-11-10", 999, "std-yoga"); // other day
    await seedWorkoutEntry(workouts, "user-2", "2026-11-11", 999); // other user
    const r = await get(deps);
    expect(r.body.ledger).toMatchObject({ eaten: 400, burned: 300, net: 100, target: 2200, remaining: 2100 });
    expect(r.body.ledger.macros).toEqual({ protein: 10, carbs: 40, fat: 5, entriesWithoutMacros: 1 });
  });

  it("remaining is negative when over the target, and follows the current target", async () => {
    const { deps, profiles, food } = makeDeps();
    await seedProfile(profiles);
    await food.putEntry("user-1", item("2026-11-11", "1762851000001-aaaaaa", 2500));
    expect((await get(deps)).body.ledger.remaining).toBe(-300);
    await profiles.upsert("user-1", "alice", { displayName: "A", timezone: "Asia/Kolkata", dailyCalorieTarget: 3000 }, "t");
    expect((await get(deps)).body.ledger.remaining).toBe(500);
  });

  it("returns past days; editable only inside the window, which moves with the clock", async () => {
    const { deps, profiles, food, setNow } = makeDeps("2026-11-11T10:00:00.000Z");
    await seedProfile(profiles, "user-1", "UTC");
    await food.putEntry("user-1", item("2026-11-08", "1762600000000-aaaaaa", 50));
    expect((await get(deps, "2026-11-08")).body.editable).toBe(false);
    expect((await get(deps, "2026-11-09")).body.editable).toBe(true);
    expect((await get(deps, "2020-01-01")).status).toBe(200);
    setNow("2026-11-12T00:00:01.000Z");
    expect((await get(deps, "2026-11-09")).body.editable).toBe(false);
  });

  it("uses each user's own local date (Kolkata vs Los Angeles)", async () => {
    const { deps, profiles } = makeDeps("2026-11-11T20:00:00.000Z");
    await seedProfile(profiles, "user-1", "Asia/Kolkata");
    await seedProfile(profiles, "user-2", "America/Los_Angeles", "bob");
    expect((await get(deps, undefined, "user-1")).body.date).toBe("2026-11-12");
    expect((await get(deps, undefined, "user-2")).body.date).toBe("2026-11-11");
  });
});

describe("GET /food with photo entries", () => {
  it("shows pending entries with a signed URL, counts them, excludes them from totals, and hides other members' photos", async () => {
    const { deps, profiles } = makeDeps();
    await seedProfile(profiles);
    await seedProfile(profiles, "user-2", "Asia/Kolkata", "bob");
    await addPhoto(deps);
    await addPhoto(deps, {}, "user-2");
    const r = parse(await handle(makeEvent({}), deps));
    const entries = r.body.meals.flatMap((m: { entries: unknown[] }) => m.entries);
    expect(entries).toHaveLength(1);
    expect(entries[0].photo.url).toContain("food-photos/user-1/");
    expect(r.body.ledger).toMatchObject({ eaten: 0, net: 0, pending: 1 });
  });
});
