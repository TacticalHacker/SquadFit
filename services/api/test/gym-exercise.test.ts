import { describe, expect, it } from "vitest";
import { handle as post } from "../src/handlers/gym-exercise-post";
import { handle as put } from "../src/handlers/gym-exercise-put";
import { handle as del } from "../src/handlers/gym-exercise-delete";
import { makeDeps, makeEvent, parse, seedProfile } from "./fakes";
import { exercise, gymGet, gymPut, sets } from "./gym-helpers";

type D = Parameters<typeof post>[1];
const create = (deps: D, body: unknown, sub = "user-1") => post(makeEvent({ sub, body }), deps).then(parse);
const update = (deps: D, id: string, body: unknown, sub = "user-1") => put(makeEvent({ sub, body, pathParameters: { exerciseId: id } }), deps).then(parse);
const remove = (deps: D, id: string, sub = "user-1") => del(makeEvent({ sub, pathParameters: { exerciseId: id } }), deps).then(parse);

const setup = async () => {
  const ctx = makeDeps("2026-11-11T10:00:00.000Z");
  await seedProfile(ctx.profiles);
  await seedProfile(ctx.profiles, "user-2", "Asia/Kolkata", "bob");
  return ctx;
};

describe("own exercises", () => {
  it("creates a trimmed strength exercise with a gc- id", async () => {
    const { deps } = await setup();
    const r = await create(deps, { name: "  Hip   Thrust ", group: "legs" });
    expect(r.status).toBe(201);
    expect(r.body.exercise).toMatchObject({ name: "Hip Thrust", group: "legs", kind: "strength", isBuiltIn: false });
    expect(r.body.exercise.exerciseId).toMatch(/^gc-/);
  });

  it("400 for Cardio or a bad name", async () => {
    const { deps } = await setup();
    expect((await create(deps, { name: "Rower", group: "cardio" })).status).toBe(400);
    expect((await create(deps, { name: "", group: "legs" })).status).toBe(400);
    expect((await create(deps, { name: "x".repeat(41), group: "legs" })).status).toBe(400);
  });

  it("409 DUPLICATE_NAME against built-ins and own names", async () => {
    const { deps } = await setup();
    expect((await create(deps, { name: "bench  PRESS", group: "chest" })).body.error.code).toBe("DUPLICATE_NAME");
    await create(deps, { name: "Hip Thrust", group: "legs" });
    expect((await create(deps, { name: "hip thrust", group: "legs" })).body.error.code).toBe("DUPLICATE_NAME");
    expect((await create(deps, { name: "hip thrust", group: "legs" }, "user-2")).status).toBe(201);
  });

  it("409 LIMIT_REACHED on the 51st; removed ones don't count", async () => {
    const { deps } = await setup();
    for (let i = 0; i < 50; i++) expect((await create(deps, { name: `Ex ${i}`, group: "arms" })).status).toBe(201);
    const r = await create(deps, { name: "One more", group: "arms" });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("LIMIT_REACHED");
    const first = (await gymGet(deps)).body.exercises.find((e: { name: string }) => e.name === "Ex 0");
    await remove(deps, first.exerciseId);
    expect((await create(deps, { name: "One more", group: "arms" })).status).toBe(201);
  });

  it("renames and regroups; past entries keep their snapshot", async () => {
    const { deps } = await setup();
    const id = (await create(deps, { name: "Hip Thrust", group: "legs" })).body.exercise.exerciseId;
    await gymPut(deps, "2026-11-10", id, { sets: sets(3, 60, 10) });
    const r = await update(deps, id, { name: "Glute Bridge", group: "core" });
    expect(r.status).toBe(200);
    expect(r.body.exercise).toMatchObject({ name: "Glute Bridge", group: "core" });
    const past = exercise(await gymGet(deps, "2026-11-10"), id)!;
    expect(past.name).toBe("Glute Bridge");
    expect(past.entry).toMatchObject({ name: "Hip Thrust", muscleGroup: "legs" });
    expect((await update(deps, id, { name: "Deadlift", group: "back" })).body.error.code).toBe("DUPLICATE_NAME");
    expect((await update(deps, id, { name: "Glute Bridge", group: "legs" })).status).toBe(200);
  });

  it("404 when updating or removing others', removed or built-in exercises", async () => {
    const { deps } = await setup();
    const id = (await create(deps, { name: "Hip Thrust", group: "legs" })).body.exercise.exerciseId;
    expect((await update(deps, id, { name: "Mine now", group: "legs" }, "user-2")).status).toBe(404);
    expect((await remove(deps, id, "user-2")).status).toBe(404);
    expect((await update(deps, "gx-deadlift", { name: "Deadlifts", group: "back" })).status).toBe(404);
    expect((await remove(deps, "gx-deadlift")).status).toBe(404);
    expect(await remove(deps, id)).toEqual({ status: 200, body: { ok: true } });
    expect((await remove(deps, id)).status).toBe(200);
    expect((await update(deps, id, { name: "Back again", group: "legs" })).status).toBe(404);
    expect(exercise(await gymGet(deps), id)).toBeUndefined();
  });
});
