import { describe, expect, it } from "vitest";
import { handle as squadPut } from "../src/handlers/me-squad-put";
import { handle as dayGet } from "../src/handlers/squad-member-day-get";
import { handle as memberGet } from "../src/handlers/squad-member-get";
import { handle as timelineGet } from "../src/handlers/squad-member-timeline-get";
import { handle as todayGet } from "../src/handlers/squad-today-get";
import { makeDeps, makeEvent, parse, seedProfile, seedWorkoutEntry, validProfile } from "./fakes";
import { gymPut, sets } from "./gym-helpers";

// Fixed clock 2026-11-11T10:00Z → Asia/Kolkata today = 2026-11-11.
async function setup() {
  const ctx = makeDeps();
  await seedProfile(ctx.profiles, "user-1", "Asia/Kolkata", "alice");
  await seedProfile(ctx.profiles, "user-2", "Asia/Kolkata", "bob");
  await ctx.profiles.upsert("user-2", "bob", { ...validProfile, displayName: "Bob" }, "2026-01-02T00:00:00.000Z");
  return ctx;
}
type D = Awaited<ReturnType<typeof setup>>["deps"];

const ev = (sub: string, memberId: string, extra: Record<string, unknown> = {}) => makeEvent({ sub, pathParameters: { memberId, ...(extra.path as object) }, ...(extra.q ? { queryStringParameters: extra.q as Record<string, string> } : {}) });
const profile = (d: D, sub: string, id: string) => memberGet(ev(sub, id), d).then(parse);
const timeline = (d: D, sub: string, id: string, cursor?: string) => timelineGet(ev(sub, id, cursor ? { q: { cursor } } : {}), d).then(parse);
const day = (d: D, sub: string, id: string, date: string) => dayGet(ev(sub, id, { path: { date } }), d).then(parse);
const bench = (d: D, sub: string, date: string, w: number, r: number) => gymPut(d, date, "gx-bench-press", { sets: sets(3, w, r, true) }, sub);

describe("member profile", () => {
  it("shows header, PRs and heatmap, and a full set-by-set day log", async () => {
    const { deps } = await setup();
    await bench(deps, "user-2", "2026-11-09", 60, 8);
    await bench(deps, "user-2", "2026-11-10", 65, 8);
    const p = (await profile(deps, "user-1", "user-2")).body;
    expect(p).toMatchObject({ isYou: false, member: { displayName: "Bob" }, memberSince: "2026-01-01", week: { days: 2, target: 3 } });
    expect(p.prs[0]).toMatchObject({ exerciseId: "gx-bench-press", best: { weightKg: 65 } });
    expect(p.heatmap.cells.at(-1).date).toBe("2026-11-11");
    expect(p.nutritionLevel).toBe("off");

    const log = (await day(deps, "user-1", "user-2", "2026-11-10")).body;
    expect(log.rest).toBe(false);
    expect(log.sessions[0].exercises[0].sets).toHaveLength(3);
    expect(log.prBadges).toHaveLength(1);
    expect((await day(deps, "user-1", "user-2", "2026-11-05")).body).toEqual({ date: "2026-11-05", rest: true, isToday: false });
    expect((await day(deps, "user-1", "user-2", "2026-11-12")).status).toBe(400);
  });

  it("shows total weight lifted this week against last week (clock: Wed 11 Nov)", async () => {
    const { deps, setNow } = await setup();
    setNow("2026-11-04T10:00:00.000Z"); // log last week's session inside its edit window
    await bench(deps, "user-2", "2026-11-04", 50, 10); // last week: 3 × 10 × 50
    setNow("2026-11-11T10:00:00.000Z");
    await bench(deps, "user-2", "2026-11-10", 60, 10); // this week: 3 × 10 × 60
    expect((await profile(deps, "user-1", "user-2")).body.weightLifted).toEqual({ thisWeek: 1800, lastWeek: 1500 });
  });

  it("pages the timeline newest first with every day exactly once", async () => {
    const { deps, workouts } = await setup();
    for (let d = 1; d <= 12; d++) await seedWorkoutEntry(workouts, "user-2", `2026-10-${String(d).padStart(2, "0")}`, 100);
    const first = (await timeline(deps, "user-1", "user-2")).body;
    expect(first.items.filter((i: { type: string }) => i.type === "day")).toHaveLength(10);
    expect(first.nextCursor).toBe("2026-10-03");
    const second = (await timeline(deps, "user-1", "user-2", first.nextCursor)).body;
    const dates = [...first.items, ...second.items].filter((i: { type: string }) => i.type === "day").map((i: { card: { date: string } }) => i.card.date);
    expect(dates).toEqual(Array.from({ length: 12 }, (_, i) => `2026-10-${String(12 - i).padStart(2, "0")}`));
    expect(second.nextCursor).toBeNull();
    expect((await timeline(deps, "user-1", "user-2", "nope")).status).toBe(400);
  });

  it("lists each activity as its own session inside the day card", async () => {
    const { deps, workouts } = await setup();
    await bench(deps, "user-2", "2026-11-10", 60, 8);
    await seedWorkoutEntry(workouts, "user-2", "2026-11-10", 200, "c-run");
    const card = (await timeline(deps, "user-1", "user-2")).body.items[0].card;
    expect(card.sessions.map((s: { kind: string }) => s.kind)).toEqual(["gym", "activity"]);
  });
});

describe("private members", () => {
  it("returns the same 403 for hidden, unknown and malformed members, on every endpoint, and still works for the owner", async () => {
    const { deps } = await setup();
    await bench(deps, "user-2", "2026-11-11", 60, 8);
    await squadPut(makeEvent({ sub: "user-2", body: { weeklyTarget: 3, leaderboardVisible: false, shareBodyWeight: false } }), deps);

    const bodies = await Promise.all([
      profile(deps, "user-1", "user-2"),
      timeline(deps, "user-1", "user-2"),
      day(deps, "user-1", "user-2", "2026-11-11"),
      profile(deps, "user-1", "nobody"),
      profile(deps, "user-1", "a/b"),
    ]);
    for (const r of bodies) expect(r).toEqual({ status: 403, body: { error: { code: "MEMBER_PRIVATE", message: "This member keeps their log private" } } });
    expect((await profile(deps, "user-2", "user-2")).status).toBe(200);

    const today = (await todayGet(makeEvent({ sub: "user-1" }), deps).then(parse)).body;
    expect(today.cards).toEqual([]);
  });

  it("never returns email, username, timezone, calorie target or body weight", async () => {
    const { deps } = await setup();
    await bench(deps, "user-2", "2026-11-11", 60, 8);
    const text = JSON.stringify([(await profile(deps, "user-1", "user-2")).body, (await timeline(deps, "user-1", "user-2")).body]);
    for (const leak of ["bodyWeight", "timezone", "username", "dailyCalorie", "email", "2200", "Asia/Kolkata", "bob"]) expect(text).not.toContain(leak);
  });
});

describe("today's workouts", () => {
  it("lists visible members who trained, most recently updated first", async () => {
    const { deps, workouts } = await setup();
    await seedWorkoutEntry(workouts, "user-1", "2026-11-11", 100);
    await seedWorkoutEntry(workouts, "user-2", "2026-11-11", 100);
    await workouts.putEntryIfAbsent("user-2", { date: "2026-11-11", workoutId: "c-yoga", name: "Yoga", rateMinutes: 30, rateCalories: 90, minutes: 30, calories: 90, createdAt: "t", updatedAt: "z" });
    const r = (await todayGet(makeEvent({ sub: "user-1" }), deps).then(parse)).body;
    expect(r.cards.map((c: { member: { userId: string } }) => c.member.userId)).toEqual(["user-2", "user-1"]);
    expect(r.cards[0].nutrition).toBeUndefined();
  });
});
