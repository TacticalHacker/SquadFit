import { describe, expect, it } from "vitest";
import { handle as shareGet } from "../src/handlers/me-share-get";
import { handle as postPut } from "../src/handlers/squad-post-put";
import { handle as postDelete } from "../src/handlers/squad-post-delete";
import { handle as feedGet } from "../src/handlers/squad-feed-get";
import { handle as rxPut } from "../src/handlers/squad-reaction-put";
import { handle as squadPut } from "../src/handlers/me-squad-put";
import { handle as timelineGet } from "../src/handlers/squad-member-timeline-get";
import { makeDeps, makeEvent, parse, seedProfile, webpBytes } from "./fakes";
import { gymDelete, gymPut, sets } from "./gym-helpers";

const TODAY = "2026-11-11"; // makeDeps clock, Asia/Kolkata

async function setup() {
  const ctx = makeDeps();
  await seedProfile(ctx.profiles, "user-1", "Asia/Kolkata", "alice");
  await seedProfile(ctx.profiles, "user-2", "Asia/Kolkata", "bob");
  await gymPut(ctx.deps, TODAY, "gx-bench-press", { sets: sets(3, 60, 8, true) });
  return ctx;
}
type D = Awaited<ReturnType<typeof setup>>["deps"];
const share = (d: D, date: string, sub = "user-1") => shareGet(makeEvent({ sub, pathParameters: { date } }), d).then(parse);
const post = (d: D, date: string, photo: unknown, sub = "user-1") => postPut(makeEvent({ sub, pathParameters: { date }, body: { photo } }), d).then(parse);
const unpost = (d: D, date: string) => postDelete(makeEvent({ sub: "user-1", pathParameters: { date } }), d).then(parse);
const feed = (d: D) => feedGet(makeEvent({ sub: "user-2" }), d).then(parse).then((r) => r.body.items as { id: string; kind: string; createdAt: string; workout: Record<string, unknown> | null }[]);
const hide = (d: D) => squadPut(makeEvent({ sub: "user-1", body: { weeklyTarget: 3, leaderboardVisible: false, shareBodyWeight: false } }), d);
const DAY_ID = `user-1~day#${TODAY}`;

describe("GET /me/share/{date}", () => {
  it("returns the caller's own figures, without calories or body weight, even when hidden", async () => {
    const { deps } = await setup();
    await hide(deps);
    const r = await share(deps, TODAY);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ date: TODAY, label: "Chest", exerciseCount: 1, rows: [{ kind: "strength", top: { weightKg: 60, reps: 8 } }], post: { posted: false, canPost: false } });
    expect(JSON.stringify(r.body)).not.toMatch(/calorie|bodyWeight|kcal/i);
  });

  it("refuses a future date and a day with nothing logged", async () => {
    const { deps } = await setup();
    expect((await share(deps, "2026-11-12")).status).toBe(400);
    expect((await share(deps, "2026-11-10")).body.error.code).toBe("NOT_A_WORKOUT_DAY");
  });
});

describe("posting a workout day to the squad feed", () => {
  it("lists one item with the workout figures, never duplicates, and unposting keeps the profile reactions", async () => {
    const { deps } = await setup();
    expect((await post(deps, TODAY, "remove")).body.post).toEqual({ posted: true, hasPhoto: false, canPost: true });
    const first = await feed(deps);
    const item = first.find((i) => i.id === DAY_ID)!;
    expect(item).toMatchObject({ kind: "workout_day", workout: { exerciseCount: 1, label: "Chest", photoUrl: null } });
    expect(JSON.stringify(item)).not.toMatch(/steps|streak|calorie/i);

    await rxPut(makeEvent({ sub: "user-2", pathParameters: { id: encodeURIComponent(DAY_ID), type: "fire" } }), deps);
    await post(deps, TODAY, "keep");
    const again = (await feed(deps)).filter((i) => i.id === DAY_ID);
    expect(again).toHaveLength(1);
    expect(again[0]!.createdAt).toBe(item.createdAt);

    await unpost(deps, TODAY);
    expect((await feed(deps)).some((i) => i.id === DAY_ID)).toBe(false);
    const timeline = await timelineGet(makeEvent({ sub: "user-2", pathParameters: { memberId: "user-1" } }), deps).then(parse);
    const card = timeline.body.items.find((i: { type: string; card?: { id: string } }) => i.card?.id === DAY_ID);
    expect(card.card.reactions.fire.count).toBe(1);
  });

  it("stores an opted-in photo, refuses non-images, and refuses hidden members and rest days", async () => {
    const { deps, sharePhotos } = await setup();
    expect((await post(deps, TODAY, { data: Buffer.from("not an image").toString("base64") })).status).toBe(400);
    expect((await post(deps, TODAY, { data: webpBytes().toString("base64") })).body.post.hasPhoto).toBe(true);
    expect([...sharePhotos.objects.keys()]).toEqual([`share-photos/user-1/${TODAY}.webp`]);
    expect((await feed(deps)).find((i) => i.id === DAY_ID)?.workout?.photoUrl).toMatch(/share-photos/);
    expect((await post(deps, "2026-11-10", "remove")).status).toBe(404);
    await hide(deps);
    expect((await post(deps, TODAY, "keep")).body.error.code).toBe("HIDDEN");
  });

  it("disappears with its photo when the day stops being a workout day", async () => {
    const { deps, sharePhotos, squad } = await setup();
    await post(deps, TODAY, { data: webpBytes().toString("base64") });
    await gymDelete(deps, TODAY, "gx-bench-press");
    expect(await squad.getFeed("user-1", `day#${TODAY}`)).toBeNull();
    expect(sharePhotos.objects.size).toBe(0);
  });
});
