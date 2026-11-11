import { describe, expect, it } from "vitest";
import { handle as post } from "../src/handlers/food-entry-post";
import { handle as put } from "../src/handlers/food-entry-put";
import { handle as del } from "../src/handlers/food-entry-delete";
import { makeDeps, makeEvent, parse, seedProfile } from "./fakes";

type D = Parameters<typeof post>[1];
const DATE = "2026-11-11";
const add = (deps: D, body: unknown, date = DATE, sub = "user-1") =>
  post(makeEvent({ sub, body, pathParameters: { date } }), deps).then(parse);
const edit = (deps: D, entryId: string, body: unknown, date = DATE, sub = "user-1") =>
  put(makeEvent({ sub, body, pathParameters: { date, entryId } }), deps).then(parse);
const remove = (deps: D, entryId: string, date = DATE, sub = "user-1") =>
  del(makeEvent({ sub, pathParameters: { date, entryId } }), deps).then(parse);

type Entry = { entryId: string; name: string; calories: number; servings: number; macros: unknown; source: string; meal: string };
const entries = (r: { body: { meals: { entries: Entry[] }[] } }) => r.body.meals.flatMap((m) => m.entries);
const first = (r: Parameters<typeof entries>[0]) => entries(r)[0]!;

const setup = async (now = "2026-11-11T10:00:00.000Z") => {
  const c = makeDeps(now);
  await seedProfile(c.profiles);
  await seedProfile(c.profiles, "user-2", "UTC", "bob");
  return c;
};
const banana = { kind: "typed", meal: "snacks", name: "  Banana ", calories: 100 };

describe("POST typed", () => {
  it("creates an entry with a time-sortable id, the meal and the user's date", async () => {
    const { deps, food } = await setup();
    const r = await add(deps, banana);
    expect(r.status).toBe(200);
    const e = first(r);
    expect(e).toMatchObject({ name: "Banana", calories: 100, servings: 1, macros: null, source: "typed", meal: "snacks" });
    expect(e.entryId).toMatch(/^\d{13}-[0-9a-f]{6}$/);
    const stored = await food.getEntry("user-1", DATE, e.entryId);
    expect(stored).toMatchObject({ date: DATE, rate: { calories: 100, macros: null } });
    expect(r.body.ledger.eaten).toBe(100);
  });

  it("completes partial macros with 0 and stores none when blank", async () => {
    const { deps } = await setup();
    const byCalories = (r: Parameters<typeof entries>[0], kcal: number) => entries(r).find((e) => e.calories === kcal)!;
    expect(byCalories(await add(deps, { ...banana, calories: 101, macros: { protein: 5 } }), 101).macros).toEqual({ protein: 5, carbs: 0, fat: 0 });
    expect(byCalories(await add(deps, { ...banana, calories: 102, macros: {} }), 102).macros).toBeNull();
  });

  it("validates calories, name, macros and meal with field messages", async () => {
    const { deps, food } = await setup();
    for (const calories of [0, 5001, 99.5, undefined, "100"]) {
      const r = await add(deps, { ...banana, calories });
      expect(r.status).toBe(400);
      expect(r.body.error.fields.calories).toBe("Calories must be a whole number from 1 to 5,000");
    }
    expect((await add(deps, { ...banana, name: "  " })).body.error.fields.name).toBeDefined();
    expect((await add(deps, { ...banana, name: "x".repeat(61) })).status).toBe(400);
    expect((await add(deps, { ...banana, macros: { fat: 500.5 } })).status).toBe(400);
    expect((await add(deps, { ...banana, meal: "brunch" })).status).toBe(400);
    expect(food.entries.size).toBe(0);
  });

  it("keeps the same food twice as separate entries", async () => {
    const { deps } = await setup();
    await add(deps, banana);
    const r = await add(deps, banana);
    expect(entries(r)).toHaveLength(2);
    expect(r.body.ledger.eaten).toBe(200);
  });

  it("window: today-2 ok, today-3 DAY_LOCKED, future 400; after midnight today-2 locks", async () => {
    const { deps, food, setNow } = await setup();
    expect((await add(deps, banana, "2026-11-09")).status).toBe(200);
    const locked = await add(deps, banana, "2026-11-08");
    expect(locked.status).toBe(409);
    expect(locked.body.error).toMatchObject({ code: "DAY_LOCKED", message: "This day can no longer be edited" });
    expect((await add(deps, banana, "2026-11-12")).status).toBe(400);
    expect(food.entries.size).toBe(1);
    setNow("2026-11-12T10:00:00.000Z");
    expect((await add(deps, banana, "2026-11-09")).status).toBe(409);
  });

  it("stores under the user's local date (Kolkata vs LA)", async () => {
    const { deps, setNow } = await setup();
    setNow("2026-11-11T20:00:00.000Z");
    expect((await add(deps, banana, "2026-11-12", "user-1")).status).toBe(200);
    expect((await add(deps, banana, "2026-11-12", "user-2")).status).toBe(400);
    expect((await add(deps, banana, "2026-11-11", "user-2")).status).toBe(200);
  });

  it("409 without a profile", async () => {
    const { deps } = makeDeps();
    expect((await add(deps, banana)).status).toBe(409);
  });
});

describe("POST list entries", () => {
  it("adds a built-in food scaled by servings with a rate snapshot", async () => {
    const { deps, food } = await setup();
    const r = await add(deps, { kind: "standard", meal: "breakfast", foodId: "sf-oats", servings: 1.5 });
    expect(first(r)).toMatchObject({ source: "standard", name: "Oats with milk", servings: 1.5, calories: 375, macros: { protein: 15, carbs: 57, fat: 9 } });
    const stored = await food.getEntry("user-1", DATE, first(r).entryId);
    expect(stored).toMatchObject({ foodId: "sf-oats", serving: "1 bowl", rate: { calories: 250, macros: { protein: 10, carbs: 38, fat: 6 } } });
  });

  it("rejects bad servings and out-of-range results", async () => {
    const { deps } = await setup();
    for (const servings of [0, 0.25, 21, "1"]) {
      const r = await add(deps, { kind: "standard", meal: "lunch", foodId: "sf-dal", servings });
      expect(r.status).toBe(400);
      expect(r.body.error.fields.servings).toBe("Servings must be from 0.5 to 20 in steps of 0.5");
    }
    const { deps: d2, profiles } = makeDeps();
    await seedProfile(profiles);
    // 400 kcal × 20 = 8,000 > 5,000
    const big = await add(d2, { kind: "standard", meal: "lunch", foodId: "sf-burger", servings: 20 });
    expect(big.status).toBe(400);
    expect(big.body.error.fields.servings).toBeDefined();
  });

  it("404 for unknown, other users' and missing own foods", async () => {
    const { deps, food } = await setup();
    await food.putOwnFood("user-2", { foodId: "f-theirs", name: "Theirs", serving: "1", calories: 50, macros: null, createdAt: "t", updatedAt: "t" });
    for (const body of [
      { kind: "standard", meal: "lunch", foodId: "sf-nope", servings: 1 },
      { kind: "own", meal: "lunch", foodId: "f-theirs", servings: 1 },
      { kind: "own", meal: "lunch", foodId: "f-missing", servings: 1 },
    ]) {
      const r = await add(deps, body);
      expect(r.status).toBe(404);
      expect(r.body.error.code).toBe("NOT_FOUND");
    }
  });

  it("adds an own food, with no macros when it has none", async () => {
    const { deps, food } = await setup();
    await food.putOwnFood("user-1", { foodId: "f-1", name: "Paratha", serving: "1 piece", calories: 180, macros: null, createdAt: "t", updatedAt: "t" });
    const r = await add(deps, { kind: "own", meal: "dinner", foodId: "f-1", servings: 2 });
    expect(first(r)).toMatchObject({ source: "own", calories: 360, macros: null });
  });
});

describe("PUT entry", () => {
  it("typed: edits name, calories, macros and meal; keeps date and id", async () => {
    const { deps } = await setup();
    const id = first(await add(deps, { ...banana, macros: { protein: 1, carbs: 24, fat: 0 } })).entryId;
    const r = await edit(deps, id, { name: "Big banana", calories: 120, meal: "lunch", macros: { protein: 2 } });
    expect(first(r)).toMatchObject({ entryId: id, name: "Big banana", calories: 120, meal: "lunch", macros: { protein: 2, carbs: 0, fat: 0 } });
    const cleared = await edit(deps, id, { macros: null });
    expect(first(cleared).macros).toBeNull();
  });

  it("typed: servings is rejected; bad values leave the entry unchanged", async () => {
    const { deps } = await setup();
    const id = first(await add(deps, banana)).entryId;
    expect((await edit(deps, id, { servings: 2 })).status).toBe(400);
    const bad = await edit(deps, id, { calories: 0 });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.calories).toBeDefined();
    expect(first(await edit(deps, id, {})).calories).toBe(100);
  });

  it("list entry: servings recompute from the entry's own rate, even if the own food changed", async () => {
    const { deps, food } = await setup();
    await food.putOwnFood("user-1", { foodId: "f-1", name: "Paratha", serving: "1 piece", calories: 180, macros: { protein: 4, carbs: 25, fat: 7 }, createdAt: "t", updatedAt: "t" });
    const id = first(await add(deps, { kind: "own", meal: "lunch", foodId: "f-1", servings: 1 })).entryId;
    await food.updateOwnFood("user-1", "f-1", { name: "Paratha", serving: "1 piece", calories: 300, macros: null }, "t");
    const r = await edit(deps, id, { servings: 2, meal: "dinner" });
    expect(first(r)).toMatchObject({ servings: 2, calories: 360, meal: "dinner", macros: { protein: 8, carbs: 50, fat: 14 } });
  });

  it("list entry: name, calories and macros are not editable", async () => {
    const { deps } = await setup();
    const id = first(await add(deps, { kind: "standard", meal: "lunch", foodId: "sf-dal", servings: 1 })).entryId;
    for (const patch of [{ calories: 10 }, { name: "x" }, { macros: null }]) {
      const r = await edit(deps, id, patch);
      expect(r.status).toBe(400);
      expect(JSON.stringify(r.body)).toContain("Calories and macros follow the servings");
    }
  });

  it("an entry whose own food was deleted can still be edited and removed (FR-008)", async () => {
    const { deps, food } = await setup();
    await food.putOwnFood("user-1", { foodId: "f-1", name: "P", serving: "1", calories: 100, macros: null, createdAt: "t", updatedAt: "t" });
    const id = first(await add(deps, { kind: "own", meal: "lunch", foodId: "f-1", servings: 1 })).entryId;
    await food.deleteOwnFood("user-1", "f-1");
    expect(first(await edit(deps, id, { servings: 3 })).calories).toBe(300);
    expect(entries(await remove(deps, id))).toHaveLength(0);
  });

  it("404 for unknown entries and other users' entries; DAY_LOCKED and window edges", async () => {
    const { deps } = await setup();
    const id = first(await add(deps, banana)).entryId;
    expect((await edit(deps, "1762851000000-abcdef", { meal: "lunch" })).status).toBe(404);
    expect((await edit(deps, id, { meal: "lunch" }, DATE, "user-2")).status).toBe(404);
    expect((await edit(deps, id, { meal: "lunch" }, "2026-11-08")).status).toBe(409);
    expect((await edit(deps, "garbage", { meal: "lunch" })).status).toBe(404);
  });
});

describe("DELETE entry", () => {
  it("removes it and returns the view; idempotent", async () => {
    const { deps } = await setup();
    const id = first(await add(deps, banana)).entryId;
    const r = await remove(deps, id);
    expect(r.status).toBe(200);
    expect(r.body.ledger.eaten).toBe(0);
    expect((await remove(deps, id)).status).toBe(200);
  });
  it("DAY_LOCKED three days back, ok on today-2; cannot delete another user's entry", async () => {
    const { deps, food } = await setup();
    expect((await remove(deps, "1762851000000-abcdef", "2026-11-08")).status).toBe(409);
    expect((await remove(deps, "1762851000000-abcdef", "2026-11-09")).status).toBe(200);
    const id = first(await add(deps, banana)).entryId;
    await remove(deps, id, DATE, "user-2");
    expect(await food.getEntry("user-1", DATE, id)).not.toBeNull();
  });
});
