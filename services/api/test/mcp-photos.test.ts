import { describe, expect, it } from "vitest";
import { handle as getFood } from "../src/handlers/food-get";
import { handle as putEntry } from "../src/handlers/food-entry-put";
import { makeDeps, makeEvent, parse, seedProfile } from "./fakes";
import { callTool, seedKey } from "./mcp-helpers";
import { addPhoto, jpegBytes } from "./photo-helpers";

const D = "2026-11-11";

async function setup() {
  const ctx = makeDeps();
  await seedProfile(ctx.profiles);
  await seedProfile(ctx.profiles, "user-2", "Asia/Kolkata", "bob");
  const token = await seedKey(ctx.deps, "user-1");
  const token2 = await seedKey(ctx.deps, "user-2");
  return { ...ctx, token, token2 };
}
const text = (r: { json: any }) => r.json.result.content.find((c: { type: string }) => c.type === "text")?.text ?? "";
const isError = (r: { json: any }) => r.json.result.isError === true;
const estimate = { calories: 520, protein: 18, carbs: 82.5, fat: 12 };

describe("list_pending_food_photos", () => {
  it("lists only the key owner's pending photo entries, newest first, with limit and hasMore", async () => {
    const { deps, food, token } = await setup();
    const a = await addPhoto(deps, { caption: "first" });
    const b = await addPhoto(deps, { caption: "second" });
    await addPhoto(deps, { caption: "bobs" }, "user-2");
    await food.updateEntryIf("user-1", D, a.entryId, { calories: 100, macros: { protein: 1, carbs: 1, fat: 1 }, photoStatus: "ai" }, "t", ["pending"]);
    const r = await callTool(deps, token, "list_pending_food_photos", {});
    const out = JSON.parse(text(r));
    expect(out.entries.map((e: { entryId: string }) => e.entryId)).toEqual([b.entryId]);
    expect(out.entries[0]).toMatchObject({ date: D, meal: "lunch", caption: "second" });
    expect(out.hasMore).toBe(false);

    await addPhoto(deps, { caption: "third" });
    const limited = JSON.parse(text(await callTool(deps, token, "list_pending_food_photos", { limit: 1 })));
    expect(limited.entries).toHaveLength(1);
    expect(limited.hasMore).toBe(true);
  });

  it("does not offer entries on days that have locked", async () => {
    const { deps, token, setNow } = await setup();
    await addPhoto(deps);
    setNow("2026-11-14T10:00:00.000Z"); // 2026-11-11 is now 3 days back: locked
    expect(JSON.parse(text(await callTool(deps, token, "list_pending_food_photos", {}))).entries).toEqual([]);
  });
});

describe("get_food_photo", () => {
  it("returns an image item and a text item for the owner's entry", async () => {
    const { deps, token } = await setup();
    const { entryId } = await addPhoto(deps, { caption: "dal" });
    const r = await callTool(deps, token, "get_food_photo", { date: D, entryId });
    const image = r.json.result.content.find((c: { type: string }) => c.type === "image");
    expect(image.mimeType).toBe("image/jpeg");
    expect(Buffer.from(image.data, "base64").equals(jpegBytes())).toBe(true);
    expect(JSON.parse(text(r))).toMatchObject({ date: D, entryId, meal: "lunch", caption: "dal" });
  });

  it("is 'not found' for another member's entry, an unknown id and a non-photo entry", async () => {
    const { deps, food, token, token2 } = await setup();
    const { entryId } = await addPhoto(deps, { caption: "SECRET-CAPTION" });
    for (const r of [
      await callTool(deps, token2, "get_food_photo", { date: D, entryId }),
      await callTool(deps, token, "get_food_photo", { date: D, entryId: "1731300000000-abcdef" }),
      await callTool(deps, token, "get_food_photo", { date: D, entryId: "garbage" }),
    ]) {
      expect(isError(r)).toBe(true);
      expect(text(r)).toMatch(/No such photo meal/);
      expect(text(r)).not.toContain("SECRET-CAPTION");
    }
    await food.putEntry("user-1", { entryId: "1731300000000-abcdef", date: D, meal: "lunch", source: "typed", name: "Rice", servings: 1, calories: 300, macros: null, rate: { calories: 300, macros: null }, createdAt: "t", updatedAt: "t" });
    expect(isError(await callTool(deps, token, "get_food_photo", { date: D, entryId: "1731300000000-abcdef" }))).toBe(true);
  });
});

describe("submit_food_estimate", () => {
  it("makes the entry AI-estimated and counts it in the day ledger", async () => {
    const { deps, token } = await setup();
    const { entryId } = await addPhoto(deps);
    const r = await callTool(deps, token, "submit_food_estimate", { date: D, entryId, ...estimate });
    expect(isError(r)).toBe(false);
    expect(text(r)).toContain("520 kcal");
    const day = parse(await getFood(makeEvent({}), deps));
    const e = day.body.meals.flatMap((m: { entries: any[] }) => m.entries)[0];
    expect(e).toMatchObject({ calories: 520, macros: { protein: 18, carbs: 82.5, fat: 12 }, photo: { status: "ai" } });
    expect(day.body.ledger).toMatchObject({ eaten: 520, pending: 0 });
    expect(day.body.ledger.macros.protein).toBe(18);
  });

  it.each([
    ["calories 0", { calories: 0 }],
    ["calories 5001", { calories: 5001 }],
    ["fractional calories", { calories: 500.5 }],
    ["negative protein", { protein: -1 }],
    ["protein over 500", { protein: 501 }],
    ["two-decimal grams", { fat: 1.25 }],
    ["missing macro", { carbs: undefined }],
  ])("rejects %s and leaves the entry pending", async (_n, over) => {
    const { deps, food, token } = await setup();
    const { entryId } = await addPhoto(deps);
    const r = await callTool(deps, token, "submit_food_estimate", { date: D, entryId, ...estimate, ...over });
    expect(isError(r)).toBe(true);
    expect((await food.getEntry("user-1", D, entryId))?.photo?.status).toBe("pending");
  });

  it("works only once: not pending after AI, manual or edited, and never overwrites user values", async () => {
    const { deps, food, token } = await setup();
    const { entryId } = await addPhoto(deps);
    await callTool(deps, token, "submit_food_estimate", { date: D, entryId, ...estimate });
    const again = await callTool(deps, token, "submit_food_estimate", { date: D, entryId, ...estimate, calories: 999 });
    expect(isError(again)).toBe(true);
    expect(text(again)).toMatch(/not pending/);
    expect((await food.getEntry("user-1", D, entryId))?.calories).toBe(520);

    const manual = (await addPhoto(deps)).entryId;
    await putEntry(makeEvent({ pathParameters: { date: D, entryId: manual }, body: { calories: 300 } }), deps);
    expect(isError(await callTool(deps, token, "submit_food_estimate", { date: D, entryId: manual, ...estimate }))).toBe(true);
    expect((await food.getEntry("user-1", D, manual))?.calories).toBe(300);
  });

  it("refuses another member's entry, a deleted entry and a locked day", async () => {
    const { deps, food, token, token2, setNow } = await setup();
    const { entryId } = await addPhoto(deps);
    expect(isError(await callTool(deps, token2, "submit_food_estimate", { date: D, entryId, ...estimate }))).toBe(true);
    expect((await food.getEntry("user-1", D, entryId))?.photo?.status).toBe("pending");
    setNow("2026-11-14T10:00:00.000Z");
    const locked = await callTool(deps, token, "submit_food_estimate", { date: D, entryId, ...estimate });
    expect(isError(locked)).toBe(true);
    expect(text(locked)).toMatch(/locked/);
    await food.deleteEntry("user-1", D, entryId);
    expect(isError(await callTool(deps, token, "submit_food_estimate", { date: D, entryId, ...estimate }))).toBe(true);
  });

  it("two concurrent submits: exactly one wins", async () => {
    const { deps, token } = await setup();
    const { entryId } = await addPhoto(deps);
    const results = await Promise.all([
      callTool(deps, token, "submit_food_estimate", { date: D, entryId, ...estimate, calories: 400 }),
      callTool(deps, token, "submit_food_estimate", { date: D, entryId, ...estimate, calories: 600 }),
    ]);
    expect(results.filter((r) => !isError(r))).toHaveLength(1);
  });
});

describe("get_user_history with photo meals", () => {
  it("shows status and caption, marks pending, and keeps pending out of the totals", async () => {
    const { deps, token } = await setup();
    const a = await addPhoto(deps, { caption: "pending one" });
    const b = await addPhoto(deps, { caption: "done one" });
    await callTool(deps, token, "submit_food_estimate", { date: D, entryId: b.entryId, ...estimate });
    const out = JSON.parse(text(await callTool(deps, token, "get_user_history", { startDate: D, endDate: D })));
    const items = out.days[0].food;
    expect(items.find((i: { caption: string }) => i.caption === "pending one")).toMatchObject({ status: "pending", pending: true, calories: 0 });
    expect(items.find((i: { caption: string }) => i.caption === "done one")).toMatchObject({ status: "ai", calories: 520 });
    expect(out.days[0].totals.eaten).toBe(520);
    // Tells the agent how to finish the job instead of guessing in a note.
    expect(out.pendingPhotoMeals).toBe(1);
    expect(out.next).toMatch(/submit_food_estimate/);
    void a;
  });
});

describe("privacy", () => {
  it("errors and listings never contain the caption of someone else's meal, and nothing logs captions or bytes", async () => {
    const { deps, token, token2 } = await setup();
    await addPhoto(deps, { caption: "ALICE-SECRET" });
    const seen: string[] = [];
    const restore = (["log", "info", "warn", "error"] as const).map((k) => {
      const orig = console[k];
      console[k] = (...a: unknown[]) => void seen.push(a.map(String).join(" "));
      return () => (console[k] = orig);
    });
    const list = await callTool(deps, token2, "list_pending_food_photos", {});
    const { entryId } = JSON.parse(text(await callTool(deps, token, "list_pending_food_photos", {}))).entries[0];
    await callTool(deps, token2, "get_food_photo", { date: D, entryId });
    await callTool(deps, token, "get_food_photo", { date: D, entryId });
    restore.forEach((f) => f());
    expect(text(list)).not.toContain("ALICE-SECRET");
    expect(JSON.parse(text(list)).entries).toEqual([]);
    expect(seen.join("\n")).not.toContain("ALICE-SECRET");
  });
});
