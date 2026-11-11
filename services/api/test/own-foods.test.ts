import { describe, expect, it } from "vitest";
import { handle as getF } from "../src/handlers/own-foods-get";
import { handle as postF } from "../src/handlers/own-foods-post";
import { handle as putF } from "../src/handlers/own-foods-put";
import { handle as delF } from "../src/handlers/own-foods-delete";
import { handle as addEntry } from "../src/handlers/food-entry-post";
import { makeDeps, makeEvent, parse, seedProfile } from "./fakes";

type D = Parameters<typeof postF>[1];
const valid = { name: "Mom's paratha", serving: "1 piece", calories: 180, macros: { protein: 4, carbs: 25, fat: 7 } };
const create = (deps: D, body: unknown, sub = "user-1") => postF(makeEvent({ sub, body }), deps).then(parse);
const edit = (deps: D, foodId: string, body: unknown, sub = "user-1") =>
  putF(makeEvent({ sub, body, pathParameters: { foodId } }), deps).then(parse);
const remove = (deps: D, foodId: string, sub = "user-1") =>
  delF(makeEvent({ sub, pathParameters: { foodId } }), deps).then(parse);
const list = (deps: D, sub = "user-1") => getF(makeEvent({ sub }), deps).then(parse);
const setup = async () => {
  const c = makeDeps("2026-11-11T10:00:00.000Z");
  await seedProfile(c.profiles);
  await seedProfile(c.profiles, "user-2", "UTC", "bob");
  return c;
};

describe("own foods", () => {
  it("creates with an f- id, trims, and returns the food", async () => {
    const { deps } = await setup();
    const r = await create(deps, { ...valid, name: "  Mom's   paratha " });
    expect(r.status).toBe(200);
    expect(r.body.food).toMatchObject({ name: "Mom's paratha", serving: "1 piece", calories: 180, macros: valid.macros });
    expect(r.body.food.foodId).toMatch(/^f-/);
    expect((await create(deps, { name: "Plain", serving: "1", calories: 50 })).body.food.macros).toBeNull();
  });

  it("validates with per-field messages", async () => {
    const { deps } = await setup();
    const r = await create(deps, { name: "", serving: "", calories: 0 });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.error.fields)).toEqual(expect.arrayContaining(["name", "serving", "calories"]));
    expect((await create(deps, { ...valid, serving: "x".repeat(41) })).status).toBe(400);
    expect((await create(deps, { ...valid, macros: { protein: 1 } })).status).toBe(400);
  });

  it("409 DUPLICATE_NAME for a repeat, but a built-in name is allowed", async () => {
    const { deps } = await setup();
    await create(deps, valid);
    for (const name of ["mom's paratha", "  MOM'S  PARATHA "]) {
      const r = await create(deps, { ...valid, name });
      expect(r.status).toBe(409);
      expect(r.body.error.code).toBe("DUPLICATE_NAME");
    }
    expect((await create(deps, { ...valid, name: "Dal" })).status).toBe(200);
    expect((await create(deps, valid, "user-2")).status).toBe(200);
  });

  it("lists only the caller's foods, A to Z", async () => {
    const { deps } = await setup();
    await create(deps, { ...valid, name: "Zebra cake" });
    await create(deps, { ...valid, name: "Apple pie" });
    await create(deps, { ...valid, name: "Hidden" }, "user-2");
    const r = await list(deps);
    expect(r.body.foods.map((f: { name: string }) => f.name)).toEqual(["Apple pie", "Zebra cake"]);
  });

  it("edits (own name allowed), 404 for others', built-in ids; 409 on clash", async () => {
    const { deps } = await setup();
    const id = (await create(deps, valid)).body.food.foodId as string;
    await create(deps, { ...valid, name: "Other" });
    expect((await edit(deps, id, { ...valid, calories: 200 })).body.food.calories).toBe(200);
    expect((await edit(deps, id, { ...valid, name: "other" })).status).toBe(409);
    expect((await edit(deps, id, valid, "user-2")).status).toBe(404);
    expect((await edit(deps, "sf-dal", valid)).status).toBe(404);
  });

  it("deletes; 404 for others' and built-in ids; entries already logged are unchanged", async () => {
    const { deps, food } = await setup();
    const id = (await create(deps, valid)).body.food.foodId as string;
    const logged = await addEntry(makeEvent({ body: { kind: "own", meal: "lunch", foodId: id, servings: 1 }, pathParameters: { date: "2026-11-11" } }), deps).then(parse);
    expect((await remove(deps, id, "user-2")).status).toBe(404);
    expect((await remove(deps, "sf-dal")).status).toBe(404);
    expect((await remove(deps, id)).status).toBe(200);
    expect((await list(deps)).body.foods).toHaveLength(0);
    expect(logged.body.ledger.eaten).toBe(180);
    expect(food.entries.size).toBe(1);
  });

  it("409 without a profile", async () => {
    const { deps } = makeDeps();
    expect((await create(deps, valid)).status).toBe(409);
  });
});
