import { describe, expect, it } from "vitest";
import { handle as del } from "../src/handlers/food-entry-delete";
import { handle as put } from "../src/handlers/food-entry-put";
import { makeDeps, makeEvent, parse, seedProfile } from "./fakes";
import { addPhoto } from "./photo-helpers";

async function setup() {
  const ctx = makeDeps();
  await seedProfile(ctx.profiles);
  const { entryId } = await addPhoto(ctx.deps);
  return { ...ctx, entryId };
}
const edit = (deps: Parameters<typeof put>[1], entryId: string, body: unknown, date = "2026-11-11", sub = "user-1") =>
  put(makeEvent({ sub, pathParameters: { date, entryId }, body }), deps).then(parse);
const entryOf = (r: { body: { meals: { entries: { entryId: string }[] }[] } }, id: string) =>
  r.body.meals.flatMap((m) => m.entries).find((e) => e.entryId === id) as Record<string, any>;

describe("editing photo entries", () => {
  it("pending: caption and meal edits keep it pending and rename it", async () => {
    const { deps, entryId } = await setup();
    const r = await edit(deps, entryId, { caption: "paneer wrap", meal: "dinner" });
    expect(r.status).toBe(200);
    expect(entryOf(r, entryId)).toMatchObject({ meal: "dinner", name: "paneer wrap", photo: { status: "pending", caption: "paneer wrap" } });
    expect(r.body.ledger.pending).toBe(1);
  });

  it("pending: filling calories by hand makes it manual and counts it", async () => {
    const { deps, entryId } = await setup();
    const r = await edit(deps, entryId, { calories: 450, macros: { protein: 20 } });
    expect(r.status).toBe(200);
    expect(entryOf(r, entryId)).toMatchObject({ calories: 450, macros: { protein: 20, carbs: 0, fat: 0 }, photo: { status: "manual" } });
    expect(r.body.ledger).toMatchObject({ eaten: 450, pending: 0 });
  });

  it("pending: macros without calories are refused", async () => {
    const { deps, entryId } = await setup();
    expect((await edit(deps, entryId, { macros: { protein: 20 } })).status).toBe(400);
  });

  it("analysed (ai): corrections make it edited; caption is ignored; servings and name are refused", async () => {
    const { deps, food, entryId } = await setup();
    await food.updateEntryIf("user-1", "2026-11-11", entryId, { calories: 500, macros: { protein: 10, carbs: 50, fat: 10 }, rate: { calories: 500, macros: { protein: 10, carbs: 50, fat: 10 } }, photoStatus: "ai" }, "t", ["pending"]);
    const r = await edit(deps, entryId, { calories: 450, caption: "ignored" });
    expect(entryOf(r, entryId)).toMatchObject({ calories: 450, photo: { status: "edited", caption: "dal and rotis" } });
    expect((await edit(deps, entryId, { servings: 2 })).status).toBe(400);
    expect((await edit(deps, entryId, { name: "x" })).status).toBe(400);
  });

  it("409 when the agent's estimate lands between the user's read and write (FR-012)", async () => {
    const { deps, food, entryId } = await setup();
    const real = food.updateEntryIf.bind(food);
    food.updateEntryIf = async (...args) => {
      // The agent wins the race: it writes first, then the user's conditional write runs.
      await real("user-1", "2026-11-11", entryId, { calories: 500, macros: { protein: 1, carbs: 1, fat: 1 }, photoStatus: "ai" }, "t", ["pending"]);
      return real(...args);
    };
    const r = await edit(deps, entryId, { caption: "too late" });
    expect(r.status).toBe(409);
    expect(r.body.error.fields._).toMatch(/already analysed/);
    expect((await food.getEntry("user-1", "2026-11-11", entryId))?.photo).toMatchObject({ status: "ai", caption: "dal and rotis" });
  });

  it("refuses locked days and other members' entries", async () => {
    const { deps, entryId } = await setup();
    expect((await edit(deps, entryId, { caption: "x" }, "2026-11-08")).body.error.code).toBe("DAY_LOCKED");
    await seedProfile(deps.profiles as never, "user-2", "Asia/Kolkata", "bob");
    expect((await edit(deps, entryId, { caption: "x" }, "2026-11-11", "user-2")).status).toBe(404);
  });

  it("rejects a caption on non-photo entries", async () => {
    const { deps, food } = await setup();
    await food.putEntry("user-1", { entryId: "1731300000000-abcdef", date: "2026-11-11", meal: "lunch", source: "typed", name: "Rice", servings: 1, calories: 300, macros: null, rate: { calories: 300, macros: null }, createdAt: "t", updatedAt: "t" });
    expect((await edit(deps, "1731300000000-abcdef", { caption: "x" })).status).toBe(400);
  });
});

describe("deleting photo entries", () => {
  it("removes the entry and its picture, for pending and analysed entries", async () => {
    const { deps, photos, food, entryId } = await setup();
    expect(photos.objects.size).toBe(1);
    const r = parse(await del(makeEvent({ pathParameters: { date: "2026-11-11", entryId } }), deps));
    expect(r.status).toBe(200);
    expect(r.body.ledger.pending).toBe(0);
    expect(await food.listEntriesForDay("user-1", "2026-11-11")).toHaveLength(0);
    expect(photos.objects.size).toBe(0);
  });

  it("does not touch another member's entry or picture, or a locked day", async () => {
    const { deps, photos, food, entryId } = await setup();
    await seedProfile(deps.profiles as never, "user-2", "Asia/Kolkata", "bob");
    await del(makeEvent({ sub: "user-2", pathParameters: { date: "2026-11-11", entryId } }), deps);
    expect(await food.listEntriesForDay("user-1", "2026-11-11")).toHaveLength(1);
    expect(photos.objects.size).toBe(1);
    expect(parse(await del(makeEvent({ pathParameters: { date: "2026-11-08", entryId } }), deps)).body.error.code).toBe("DAY_LOCKED");
  });
});
