import { describe, expect, it } from "vitest";
import { handle as post } from "../src/handlers/weight-post";
import { handle as del } from "../src/handlers/weight-delete";
import { handle as putProfile } from "../src/handlers/me-profile-put";
import { makeDeps, makeEvent, parse, seedProfile, validProfile } from "./fakes";

// 07:30 in Asia/Kolkata on Tue 24 Nov 2026.
const NOW = "2026-11-24T02:00:00.000Z";
const today = "2026-11-24";

async function setup() {
  const t = makeDeps(NOW);
  await seedProfile(t.profiles);
  const log = async (weightKg: number, date?: string, sub = "user-1") =>
    parse(await post(makeEvent({ sub, body: { weightKg, ...(date ? { date } : {}) }, queryStringParameters: { range: "W" } }), t.deps));
  return { ...t, log };
}

describe("POST /me/weight", () => {
  it("stores today's entry in the member's timezone, keeps several a day, and the profile follows the latest", async () => {
    const t = await setup();
    let r = await t.log(78.4);
    expect(r.status).toBe(200);
    expect(r.body.editableDays[0]).toMatchObject({ date: today, entries: [{ weightKg: 78.4 }] });
    t.setNow("2026-11-24T13:00:00.000Z");
    r = await t.log(79.1);
    expect(r.body.editableDays[0].entries.map((e: { weightKg: number }) => e.weightKg)).toEqual([79.1, 78.4]);
    expect(r.body.latest.weightKg).toBe(79.1);
    expect((await t.profiles.get("user-1"))?.bodyWeightKg).toBe(79.1);
  });

  it("a backfill for yesterday, saved later, never replaces today's weight", async () => {
    const t = await setup();
    await t.log(78.0);
    t.setNow("2026-11-24T05:00:00.000Z");
    const r = await t.log(79.5, "2026-11-23");
    expect(r.body.latest.weightKg).toBe(78.0);
    expect((await t.profiles.get("user-1"))?.bodyWeightKg).toBe(78.0);
  });

  it("refuses days outside the edit window and the 11th entry of a day", async () => {
    const t = await setup();
    expect((await t.log(78, "2026-11-21")).body.error.code).toBe("DAY_LOCKED");
    for (let i = 0; i < 10; i++) {
      t.setNow(new Date(Date.parse(NOW) + i * 1000).toISOString());
      expect((await t.log(78 + i / 10)).status).toBe(200);
    }
    const r = await t.log(80);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("DAY_FULL");
  });
});

describe("DELETE /me/weight/{date}/{entryId}", () => {
  const remove = (t: Awaited<ReturnType<typeof setup>>, date: string, entryId: string, sub = "user-1") =>
    del(makeEvent({ sub, pathParameters: { date, entryId }, queryStringParameters: { range: "W" } }), t.deps).then(parse);

  it("deleting the latest re-syncs the profile; deleting the last leaves it as it was", async () => {
    const t = await setup();
    await t.log(78.4);
    t.setNow("2026-11-24T03:00:00.000Z");
    const r = await t.log(87.4);
    const [typo, good] = r.body.editableDays[0].entries;
    let d = await remove(t, today, typo.id);
    expect(d.body.latest.weightKg).toBe(78.4);
    expect((await t.profiles.get("user-1"))?.bodyWeightKg).toBe(78.4);
    d = await remove(t, today, good.id);
    expect(d.body.latest).toBeNull();
    expect((await t.profiles.get("user-1"))?.bodyWeightKg).toBe(78.4);
  });

  it("never touches another member's entry and refuses locked days", async () => {
    const t = await setup();
    await seedProfile(t.profiles, "user-2", "Asia/Kolkata", "bob");
    const theirs = (await t.log(90, undefined, "user-2")).body.editableDays[0].entries[0];
    const d = await remove(t, today, theirs.id);
    expect(d.status).toBe(200);
    expect(await t.weights.countDay("user-2", today)).toBe(1);
    expect((await remove(t, "2026-11-20", theirs.id)).body.error.code).toBe("DAY_LOCKED");
  });
});

describe("PUT /me/profile body weight (feature 014)", () => {
  it("a changed weight records an entry for today; an unchanged save records none", async () => {
    const t = makeDeps(NOW);
    await putProfile(makeEvent({ body: { ...validProfile, bodyWeightKg: 80 } }), t.deps);
    await putProfile(makeEvent({ body: { ...validProfile, bodyWeightKg: 80 } }), t.deps);
    expect(await t.weights.countDay("user-1", today)).toBe(1);
    t.setNow("2026-11-24T03:00:00.000Z");
    await putProfile(makeEvent({ body: { ...validProfile, bodyWeightKg: 79.5 } }), t.deps);
    expect(await t.weights.countDay("user-1", today)).toBe(2);
    expect((await t.profiles.get("user-1"))?.bodyWeightKg).toBe(79.5);
  });
});
