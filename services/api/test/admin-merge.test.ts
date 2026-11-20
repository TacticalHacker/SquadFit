import { describe, expect, it } from "vitest";
import { handle as merge } from "../src/handlers/admin-exercise-merge-post";
import { handle as list } from "../src/handlers/admin-exercises-get";
import { makeDeps, makeEvent, parse, seedProfile } from "./fakes";
import { gymPut, sets } from "./gym-helpers";

type D = Parameters<typeof merge>[1];
const run = (deps: D, id: string, groups = "[admin]") => merge(makeEvent({ groups, pathParameters: { exerciseId: id } }), deps).then(parse);

describe("POST /admin/exercises/{id}/merge (feature 015)", () => {
  it("moves own-exercise days onto the library exercise, leaving conflicting days; repeat moves nothing", async () => {
    const { deps, profiles, gym, catalog, workouts } = makeDeps("2026-11-11T10:00:00.000Z");
    await seedProfile(profiles);
    catalog.seed("gx-cable-kickback", "Cable Kickback");
    await gym.putOwnExercise("user-1", { exerciseId: "gc-1", name: "cable kickback", group: "arms", createdAt: "t", updatedAt: "t" });
    await gymPut(deps, "2026-11-10", "gc-1", { sets: sets(3, 10, 12, true) });
    await gymPut(deps, "2026-11-11", "gc-1", { sets: sets(2, 10, 12, true) });
    await gymPut(deps, "2026-11-11", "gx-cable-kickback", { sets: sets(1, 12, 10, true) });

    expect((await list(makeEvent({ groups: "[admin]" }), deps).then(parse)).body.ownMatches).toEqual({ "gx-cable-kickback": 1 });
    const r = await run(deps, "gx-cable-kickback");
    expect(r.body).toEqual({ members: 1, moved: 1, skipped: 1, removed: 0 });
    const moved = await workouts.getEntry("user-1", "2026-11-10", "gx-cable-kickback");
    expect(moved).toMatchObject({ name: "Cable Kickback", volumeKg: 360 });
    expect(moved?.sets).toHaveLength(3);
    expect((await run(deps, "gx-cable-kickback")).body.moved).toBe(0);
    expect((await run(deps, "gx-cable-kickback", "")).status).toBe(403);
  });
});
