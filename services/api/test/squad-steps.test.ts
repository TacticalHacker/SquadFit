import { describe, expect, it } from "vitest";
import { handle as boardGet } from "../src/handlers/squad-leaderboard-get";
import { handle as memberGet } from "../src/handlers/squad-member-get";
import { handle as squadPut } from "../src/handlers/me-squad-put";
import { handle as stepsPut } from "../src/handlers/me-steps-put";
import { handle as todayGet } from "../src/handlers/squad-today-get";
import { makeDeps, makeEvent, parse, validProfile } from "./fakes";

// makeDeps' clock: 2026-11-11 (a Wednesday) in Asia/Kolkata, so "This week" is 9–11 Nov.
async function setup() {
  const ctx = makeDeps();
  const members = [["user-1", "Alice"], ["user-2", "Bob"], ["user-3", "Cy"], ["user-4", "Dee"], ["user-5", "Eve"]] as const;
  for (const [sub, name] of members) await ctx.profiles.upsert(sub, name.toLowerCase(), { ...validProfile, displayName: name }, "2026-01-02T00:00:00.000Z");
  const day = (date: string, steps: number) => ({ date, steps, activeKcal: 400, distanceKm: 5 });
  await ctx.activity.putDays("user-2", [day("2026-11-09", 9000), day("2026-11-11", 5000)], "shortcut", "2026-11-11T09:00:00.000Z");
  await ctx.activity.putDays("user-4", [day("2026-11-11", 20000)], "shortcut", "2026-11-11T09:00:00.000Z");
  await ctx.activity.putDays("user-5", [day("2026-11-11", 30000)], "shortcut", "2026-11-11T09:00:00.000Z");
  // Dee keeps workouts visible but steps private; Eve is hidden from the leaderboard.
  await stepsPut(makeEvent({ sub: "user-4", body: { dailyStepGoal: 8000, shareSteps: false } }), ctx.deps);
  await squadPut(makeEvent({ sub: "user-5", body: { weeklyTarget: 3, leaderboardVisible: false, shareBodyWeight: false } }), ctx.deps);
  return ctx;
}

describe("steps privacy and the Steps board", () => {
  it("ranks only sharing members with synced days, averaging over synced days", async () => {
    const { deps } = await setup();
    const r = parse(await boardGet(makeEvent({ sub: "user-1", queryStringParameters: { board: "steps", period: "week" } }), deps));
    expect(r.status).toBe(200);
    expect(r.body.stepsBoard.rows).toEqual([
      expect.objectContaining({ member: expect.objectContaining({ displayName: "Bob" }), rank: 1, avgSteps: 7000, hitDays: 1, periodDays: 3, syncedDays: 2 }),
    ]);
    expect(r.body.stepsToday).toEqual([{ userId: "user-2", steps: 5000, goalHit: false }]);
    expect(JSON.stringify(r.body)).not.toMatch(/20000|30000|activeKcal|distanceKm/);
  });

  it("shows steps and rest days only for sharing members, and active kcal only on the profile", async () => {
    const { deps } = await setup();
    const today = parse(await todayGet(makeEvent({ sub: "user-1" }), deps)).body;
    expect(today.restDays).toEqual([{ member: expect.objectContaining({ displayName: "Bob" }), steps: { steps: 5000, goalHit: false } }]);

    const bob = parse(await memberGet(makeEvent({ sub: "user-1", pathParameters: { memberId: "user-2" } }), deps)).body;
    expect(bob.steps.days).toHaveLength(30);
    expect(bob.steps.days.at(-1)).toEqual({ date: "2026-11-11", steps: 5000, activeKcal: 400, distanceKm: 5 });
    expect(bob.steps.days.at(-2).steps).toBeNull();

    const dee = parse(await memberGet(makeEvent({ sub: "user-1", pathParameters: { memberId: "user-4" } }), deps)).body;
    expect(dee).not.toHaveProperty("steps");
    // The owner still sees their own, flagged as not shared.
    const own = parse(await memberGet(makeEvent({ sub: "user-4", pathParameters: { memberId: "user-4" } }), deps)).body;
    expect(own.steps).toMatchObject({ shared: false });
  });
});
