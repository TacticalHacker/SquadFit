import { describe, expect, it } from "vitest";
import { handle as post } from "../src/handlers/custom-post";
import { handle as putC } from "../src/handlers/custom-put";
import { handle as delC } from "../src/handlers/custom-delete";
import { handle as getW } from "../src/handlers/workouts-get";
import { handle as tick } from "../src/handlers/entry-put";
import { makeDeps, makeEvent, parse, seedProfile } from "./fakes";

type D = Parameters<typeof post>[1];
const valid = { name: "Badminton", defaultMinutes: 60, defaultCalories: 400 };
const create = (deps: D, body: unknown, sub = "user-1") => post(makeEvent({ sub, body }), deps).then(parse);
const edit = (deps: D, id: string, body: unknown, sub = "user-1") =>
  putC(makeEvent({ sub, body, pathParameters: { workoutId: id } }), deps).then(parse);
const remove = (deps: D, id: string, sub = "user-1") =>
  delC(makeEvent({ sub, pathParameters: { workoutId: id } }), deps).then(parse);
const setup = async () => {
  const c = makeDeps("2026-11-11T10:00:00.000Z");
  await seedProfile(c.profiles);
  await seedProfile(c.profiles, "user-2", "UTC", "bob");
  return c;
};

describe("POST /workouts/custom", () => {
  it("creates with a c- id and trims the name", async () => {
    const { deps } = await setup();
    const r = await create(deps, { ...valid, name: "  Badminton " });
    expect(r.status).toBe(200);
    expect(r.body.workout).toMatchObject({ name: "Badminton", defaultMinutes: 60, defaultCalories: 400 });
    expect(r.body.workout.workoutId).toMatch(/^c-/);
  });

  it("validates fields with per-field messages", async () => {
    const { deps } = await setup();
    const r = await create(deps, { name: "", defaultMinutes: 0, defaultCalories: 5001 });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.error.fields)).toEqual(expect.arrayContaining(["name", "defaultMinutes", "defaultCalories"]));
  });

  it("409 DUPLICATE_NAME for own repeats, ignoring case/space", async () => {
    const { deps } = await setup();
    await create(deps, valid);
    for (const name of ["badminton ", " BADMINTON", "Bad minton".replace(" ", "")]) {
      const r = await create(deps, { ...valid, name });
      expect(r.status).toBe(409);
      expect(r.body.error.code).toBe("DUPLICATE_NAME");
      expect(r.body.error.message).toBe("You already have a workout with that name");
    }
  });

  it("another user may reuse the name; a removed name is free again", async () => {
    const { deps } = await setup();
    const a = await create(deps, valid);
    expect((await create(deps, valid, "user-2")).status).toBe(200);
    await remove(deps, a.body.workout.workoutId);
    expect((await create(deps, valid)).status).toBe(200);
  });

  it("409 without profile", async () => {
    const { deps } = makeDeps();
    expect((await create(deps, valid)).status).toBe(409);
  });
});

describe("PUT /workouts/custom/{id}", () => {
  it("edits, allowing its own name, and leaves existing entries alone (FR-010)", async () => {
    const { deps, workouts } = await setup();
    const id = (await create(deps, valid)).body.workout.workoutId as string;
    await tick(makeEvent({ pathParameters: { date: "2026-11-11", workoutId: id } }), deps);
    const r = await edit(deps, id, { name: "Badminton", defaultMinutes: 60, defaultCalories: 800 });
    expect(r.status).toBe(200);
    expect(r.body.workout.defaultCalories).toBe(800);
    expect((await workouts.getEntry("user-1", "2026-11-11", id))?.calories).toBe(400);
  });

  it("409 when renamed onto another own name", async () => {
    const { deps } = await setup();
    await create(deps, valid);
    const id = (await create(deps, { ...valid, name: "Squash" })).body.workout.workoutId as string;
    expect((await edit(deps, id, { ...valid, name: "badminton" })).status).toBe(409);
  });

  it("accepts names of the former built-in activities (feature 007, FR-024)", async () => {
    const { deps } = await setup();
    for (const name of ["Running", "Yoga", "Team sport"]) expect((await create(deps, { ...valid, name })).status).toBe(200);
  });

  it("404 for another user's, standard and removed ids", async () => {
    const { deps } = await setup();
    const id = (await create(deps, valid)).body.workout.workoutId as string;
    expect((await edit(deps, id, valid, "user-2")).status).toBe(404);
    expect((await edit(deps, "std-running", valid)).status).toBe(404);
    await remove(deps, id);
    expect((await edit(deps, id, valid)).status).toBe(404);
  });
});

describe("DELETE /workouts/custom/{id}", () => {
  it("hides from checklist but keeps entries as removed rows, still editable in window", async () => {
    const { deps } = await setup();
    const id = (await create(deps, valid)).body.workout.workoutId as string;
    await tick(makeEvent({ pathParameters: { date: "2026-11-11", workoutId: id } }), deps);
    expect((await remove(deps, id)).status).toBe(200);
    const view = parse(await getW(makeEvent({}), deps)).body;
    const row = view.rows.find((x: { workoutId: string }) => x.workoutId === id);
    expect(row).toMatchObject({ removed: true });
    expect(row.entry.calories).toBe(400);
    const edited = await tick(makeEvent({ body: { minutes: 30 }, pathParameters: { date: "2026-11-11", workoutId: id } }), deps).then(parse);
    expect(edited.status).toBe(200);
  });

  it("is idempotent; 404 for others' and standard ids", async () => {
    const { deps } = await setup();
    const id = (await create(deps, valid)).body.workout.workoutId as string;
    expect((await remove(deps, id)).status).toBe(200);
    expect((await remove(deps, id)).status).toBe(200);
    expect((await remove(deps, id, "user-2")).status).toBe(404);
    expect((await remove(deps, "std-running")).status).toBe(404);
  });
});
