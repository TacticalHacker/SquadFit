import { describe, expect, it } from "vitest";
import { handle as list } from "../src/handlers/admin-exercises-get";
import { handle as post } from "../src/handlers/admin-exercise-post";
import { handle as put } from "../src/handlers/admin-exercise-put";
import { handle as ownPost } from "../src/handlers/gym-exercise-post";
import { makeDeps, makeEvent, parse, seedProfile } from "./fakes";
import { exercise, gymGet, gymPut, sets } from "./gym-helpers";

type D = Parameters<typeof post>[1];
const admin = { groups: "[admin]", username: "roshan" };
const add = (deps: D, body: unknown, as = admin) => post(makeEvent({ ...as, body }), deps).then(parse);
const edit = (deps: D, id: string, body: unknown, as = admin) => put(makeEvent({ ...as, body, pathParameters: { exerciseId: id } }), deps).then(parse);

const setup = async () => {
  const ctx = makeDeps("2026-11-11T10:00:00.000Z");
  await seedProfile(ctx.profiles);
  return ctx;
};

describe("admin exercises (feature 015)", () => {
  it("admins add an exercise; duplicates of built-ins are refused; members get 403", async () => {
    const { deps } = await setup();
    const r = await add(deps, { name: "Cable  Kickback", group: "arms" });
    expect(r.status).toBe(201);
    expect(r.body.exercise).toMatchObject({ exerciseId: "gx-cable-kickback", name: "Cable Kickback", status: "active", createdBy: "roshan" });
    expect((await add(deps, { name: "bench  press", group: "chest" })).body.error.code).toBe("DUPLICATE_NAME");
    expect((await add(deps, { name: "Zottman Curl", group: "arms" }, { groups: "", username: "alice" })).status).toBe(403);
    expect((await list(makeEvent({}), deps).then(parse)).status).toBe(403);
    expect((await list(makeEvent(admin), deps).then(parse)).body.catalog).toHaveLength(1);
  });

  it("members see, log and cannot copy a catalog exercise", async () => {
    const { deps } = await setup();
    await add(deps, { name: "Cable Kickback", group: "arms" });
    expect(exercise(await gymGet(deps, "2026-11-11"), "gx-cable-kickback")).toMatchObject({ isBuiltIn: true, group: "arms" });
    expect((await gymPut(deps, "2026-11-11", "gx-cable-kickback", { sets: sets(3, 10, 12, true) })).status).toBe(200);
    const own = await ownPost(makeEvent({ body: { name: "cable kickback", group: "arms" } }), deps).then(parse);
    expect(own.body.error.code).toBe("DUPLICATE_NAME");
  });

  it("renames with the current updatedAt; stale writes and built-ins are refused", async () => {
    const { deps, setNow } = await setup();
    const created = (await add(deps, { name: "Cable Kickback", group: "arms" })).body.exercise;
    setNow("2026-11-11T10:05:00.000Z");
    const r = await edit(deps, "gx-cable-kickback", { updatedAt: created.updatedAt, name: "Cable Kick-Back" });
    expect(r.status).toBe(200);
    expect(exercise(await gymGet(deps, "2026-11-11"), "gx-cable-kickback")?.name).toBe("Cable Kick-Back");
    expect((await edit(deps, "gx-cable-kickback", { updatedAt: created.updatedAt, group: "back" })).body.error.code).toBe("STALE");
    expect((await edit(deps, "gx-bench-press", { updatedAt: "t", name: "X" })).status).toBe(404);
    expect((await edit(deps, "gx-cable-kickback", { updatedAt: "t", name: "X" }, { groups: "", username: "alice" })).status).toBe(403);
  });

  it("a retired exercise keeps logged days editable but leaves the picker", async () => {
    const { deps } = await setup();
    const created = (await add(deps, { name: "Cable Kickback", group: "arms" })).body.exercise;
    await gymPut(deps, "2026-11-10", "gx-cable-kickback", { sets: sets(2, 10, 12, true) });
    expect((await edit(deps, "gx-cable-kickback", { updatedAt: created.updatedAt, status: "retired" })).status).toBe(200);
    expect((await gymPut(deps, "2026-11-10", "gx-cable-kickback", { sets: sets(3, 10, 12, true) })).status).toBe(200);
    expect((await gymPut(deps, "2026-11-11", "gx-cable-kickback", { sets: sets(3, 10, 12, true) })).status).toBe(404);
    expect(exercise(await gymGet(deps, "2026-11-11"), "gx-cable-kickback")).toBeUndefined();
  });
});
