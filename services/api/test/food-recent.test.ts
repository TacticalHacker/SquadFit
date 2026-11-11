import { describe, expect, it } from "vitest";
import { handle } from "../src/handlers/food-recent-get";
import { makeDeps, makeEvent, parse, seedProfile } from "./fakes";

const item = (date: string, entryId: string, name: string, calories: number) => ({
  entryId, date, meal: "lunch" as const, source: "typed" as const, name, servings: 1, calories,
  macros: null, rate: { calories, macros: null }, createdAt: "t", updatedAt: "t",
});
const setup = async () => {
  const c = makeDeps("2026-11-11T10:00:00.000Z");
  await seedProfile(c.profiles, "user-1", "UTC");
  return c;
};
const recent = (deps: Parameters<typeof handle>[1], sub = "user-1") => handle(makeEvent({ sub }), deps).then(parse);

describe("GET /food/recent", () => {
  it("is empty for a new user", async () => {
    const { deps } = await setup();
    expect((await recent(deps)).body).toEqual({ foods: [] });
  });

  it("returns one item per name with the latest calories, most recent first", async () => {
    const { deps, food } = await setup();
    await food.putEntry("user-1", item("2026-11-09", "1762600000000-aaaaaa", "Oats", 300));
    await food.putEntry("user-1", item("2026-11-10", "1762700000000-bbbbbb", " oats", 320));
    await food.putEntry("user-1", item("2026-11-10", "1762700500000-cccccc", "Banana", 100));
    const r = await recent(deps);
    expect(r.body.foods).toEqual([
      { name: "Banana", calories: 100, macros: null },
      { name: "oats", calories: 320, macros: null },
    ]);
  });

  it("covers exactly the last 90 days (today-89 included, today-90 excluded)", async () => {
    const { deps, food } = await setup();
    await food.putEntry("user-1", item("2026-08-14", "1755000000000-aaaaaa", "Edge in", 10)); // today-89
    await food.putEntry("user-1", item("2026-08-13", "1754900000000-bbbbbb", "Edge out", 10)); // today-90
    const names = (await recent(deps)).body.foods.map((f: { name: string }) => f.name);
    expect(names).toEqual(["Edge in"]);
  });

  it("only the caller's entries, capped at 20", async () => {
    const { deps, food } = await setup();
    await food.putEntry("user-2", item("2026-11-10", "1762700000000-aaaaaa", "Theirs", 1));
    for (let i = 0; i < 25; i++) await food.putEntry("user-1", item("2026-11-10", `${1762700000000 + i}-aaaaaa`, `Food ${i}`, 10));
    const r = await recent(deps);
    expect(r.body.foods).toHaveLength(20);
    expect(JSON.stringify(r.body)).not.toContain("Theirs");
  });

  it("409 without a profile", async () => {
    const { deps } = makeDeps();
    expect((await recent(deps)).status).toBe(409);
  });
});
