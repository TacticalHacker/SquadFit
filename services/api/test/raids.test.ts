import { describe, expect, it } from "vitest";
import { handle as createRaid } from "../src/handlers/admin-raid-post";
import { handle as editRaid } from "../src/handlers/admin-raid-put";
import { handle as getCard } from "../src/handlers/squad-raid-get";
import { makeDeps, makeEvent, parse, seedProfile } from "./fakes";
import { gymDelete, gymPut, sets } from "./gym-helpers";

type D = Parameters<typeof createRaid>[1];
const admin = { sub: "user-1", groups: "[admin]", username: "alice" };
const START = "2026-11-30T18:30:00.000Z"; // Mon 1 Dec 00:00 IST
const END = "2026-12-07T18:30:00.000Z"; // Mon 8 Dec 00:00 IST
const raidBody = { name: "Leg Day Siege", startsAt: START, endsAt: END, targetKg: 40_000 };

const post = (deps: D, body: unknown, as: Record<string, string> = admin) => createRaid(makeEvent({ ...as, body }), deps).then(parse);
const put = (deps: D, raidId: string, body: unknown) => editRaid(makeEvent({ ...admin, body, pathParameters: { raidId } }), deps).then(parse);
const card = (deps: D, sub = "user-1") => getCard(makeEvent({ sub }), deps).then(parse);

/** Three members; a raid created on Thu 27 Nov for 1–8 Dec, then the clock moves to Wed 3 Dec 11:30 IST. */
async function liveRaid(over: Record<string, unknown> = {}) {
  const ctx = makeDeps("2026-11-27T06:00:00.000Z");
  await seedProfile(ctx.profiles, "user-1", "Asia/Kolkata", "alice");
  await seedProfile(ctx.profiles, "user-2", "Asia/Kolkata", "bob");
  await seedProfile(ctx.profiles, "user-3", "Asia/Kolkata", "cara");
  const created = await post(ctx.deps, { ...raidBody, ...over });
  expect(created.status).toBe(201);
  ctx.setNow("2026-12-03T06:00:00.000Z");
  return { ...ctx, raidId: created.body.raid.raidId as string };
}

describe("raid counting (feature 021)", () => {
  it("counts ticked sets, reports the toast kg and follows edits", async () => {
    const { deps } = await liveRaid();
    const saved = await gymPut(deps, "2026-12-03", "gx-bench-press", { sets: sets(3, 80, 8, true) }, "user-2");
    expect(saved.body.raidKg).toBe(1920);
    expect((await card(deps, "user-2")).body.card).toMatchObject({ status: "live", totalKg: 1920, you: { kg: 1920, pct: 4, capped: false } });

    // Unticked sets add nothing; a delete takes the kg back out.
    expect((await gymPut(deps, "2026-12-03", "gx-barbell-squat", { sets: sets(3, 100, 5, false) }, "user-2")).body.raidKg).toBe(0);
    await gymDelete(deps, "2026-12-03", "gx-bench-press", "user-2");
    expect((await card(deps, "user-2")).body.card.totalKg).toBe(0);
  });

  it("caps a member at 40% of the target", async () => {
    const { deps } = await liveRaid();
    await gymPut(deps, "2026-12-03", "gx-barbell-squat", { sets: sets(18, 100, 10, true) }, "user-2"); // 18,000 kg raw
    expect((await card(deps, "user-2")).body.card).toMatchObject({ totalKg: 16_000, you: { kg: 16_000, rawKg: 18_000, capped: true } });
  });

  it("splits the bar by member in first-contributed order and merges hidden members", async () => {
    const { deps, profiles, setNow } = await liveRaid();
    await gymPut(deps, "2026-12-03", "gx-bench-press", { sets: sets(1, 100, 5, true) }, "user-3");
    setNow("2026-12-03T07:00:00.000Z");
    await gymPut(deps, "2026-12-03", "gx-bench-press", { sets: sets(1, 100, 10, true) }, "user-2");
    setNow("2026-12-03T08:00:00.000Z");
    await gymPut(deps, "2026-12-03", "gx-barbell-row", { sets: sets(1, 50, 10, true) }, "user-1");

    const split = (await card(deps, "user-1")).body.card.split;
    expect(split.segments.map((s: { userId: string; kg: number; sessions: number; isYou: boolean }) => [s.userId, s.kg, s.sessions, s.isYou])).toEqual([
      ["user-3", 500, 1, false],
      ["user-2", 1000, 1, false],
      ["user-1", 500, 1, true],
    ]);

    profiles.items.set("user-3", { ...profiles.items.get("user-3")!, leaderboardVisible: false });
    const seen = (await card(deps, "user-1")).body.card;
    expect(seen.totalKg).toBe(2000); // the hidden member still counts
    expect(seen.split.othersKg).toBe(500);
    expect(JSON.stringify(seen.split)).not.toContain("user-3");
    expect((await card(deps, "user-3")).body.card.split.segments.some((s: { isYou: boolean }) => s.isYou)).toBe(true);
  });
});

describe("raid win (feature 021)", () => {
  it("wins once, gives every contributor the sticker and stays won", async () => {
    const { deps, raids, raidId } = await liveRaid({ targetKg: 2_000, capPct: 100 });
    await gymPut(deps, "2026-12-03", "gx-bench-press", { sets: sets(1, 100, 10, true) }, "user-2");
    await gymPut(deps, "2026-12-03", "gx-bench-press", { sets: sets(1, 100, 10, true) }, "user-3");
    const wonAt = raids.raids.get(raidId)!.wonAt;
    expect(wonAt).toBeDefined();
    expect([...raids.stickers.keys()].sort()).toEqual([`user-2|${raidId}`, `user-3|${raidId}`]);

    await gymDelete(deps, "2026-12-03", "gx-bench-press", "user-3");
    expect((await card(deps)).body.card).toMatchObject({ status: "won", totalKg: 1000 });
    expect(raids.raids.get(raidId)!.wonAt).toBe(wonAt);

    // A later contributor still gets the sticker.
    await gymPut(deps, "2026-12-03", "gx-barbell-row", { sets: sets(1, 50, 2, true) }, "user-1");
    expect(raids.stickers.has(`user-1|${raidId}`)).toBe(true);
  });

  it("freezes after the 12-hour grace", async () => {
    const { deps, setNow } = await liveRaid();
    setNow("2026-12-08T04:30:00.000Z"); // Mon 8 Dec 10:00 IST: Sunday still counts
    expect((await gymPut(deps, "2026-12-07", "gx-bench-press", { sets: sets(1, 100, 10, true) }, "user-2")).body.raidKg).toBe(1000);
    setNow("2026-12-08T07:30:00.000Z"); // 13:00 IST: frozen
    expect((await gymPut(deps, "2026-12-07", "gx-bench-press", { sets: sets(2, 100, 10, true) }, "user-2")).body.raidKg).toBe(0);
    expect((await card(deps, "user-2")).body.card).toMatchObject({ status: "ended", totalKg: 1000 });
  });
});

describe("raid admin (feature 021)", () => {
  it("is admins only and refuses overlapping dates", async () => {
    const { deps } = await liveRaid();
    expect((await post(deps, raidBody, { sub: "user-2", username: "bob" })).status).toBe(403);
    const clash = await post(deps, { ...raidBody, name: "Push Week", startsAt: "2026-12-04T18:30:00.000Z", endsAt: "2026-12-11T18:30:00.000Z" });
    expect(clash.status).toBe(409);
    expect(clash.body.error).toMatchObject({ code: "RAID_RULE", message: "Dates overlap Leg Day Siege" });
  });

  it("keeps live fairness fields and the target floor, and refuses stale edits", async () => {
    const { deps, raids, raidId } = await liveRaid();
    await gymPut(deps, "2026-12-03", "gx-bench-press", { sets: sets(10, 100, 10, true) }, "user-2");
    const r = raids.raids.get(raidId)!;
    const base = { ...raidBody, expectedUpdatedAt: r.updatedAt };
    expect((await put(deps, raidId, { ...base, targetKg: 5_000 })).body.error.message).toBe("Target can't be below current progress (10,000 kg)");
    expect((await put(deps, raidId, { ...base, capPct: 50 })).body.error.fields).toMatchObject({ capPct: "Locked while the raid is live" });
    expect((await put(deps, raidId, { ...base, name: "Leg Day Siege II" })).status).toBe(200);
    expect((await put(deps, raidId, { ...base, name: "Again" })).body.error.code).toBe("STALE");
  });
});
