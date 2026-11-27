import { describe, expect, it } from "vitest";
import { makeDeps, seedProfile } from "./fakes";
import { exercise, gymGet, gymPut, sets } from "./gym-helpers";

// Feature 019: the drawer's bests and the save result's PR count.
describe("PR badge data", () => {
  it("returns bests before the day, then counts the PR on save", async () => {
    const { deps, profiles } = makeDeps("2026-11-11T10:00:00.000Z");
    await seedProfile(profiles);
    await gymPut(deps, "2026-11-09", "gx-bench-press", { sets: sets(1, 80, 8, true) });

    const view = await gymGet(deps, "2026-11-11");
    expect(exercise(view, "gx-bench-press")).toMatchObject({ bests: { sessions: 1, bestWeight: { weightKg: 80, reps: 8 } } });
    expect(exercise(view, "gx-deadlift")).toMatchObject({ bests: { sessions: 0 } });
    expect(exercise(view, "gx-incline-treadmill-walk")).toMatchObject({ bests: null });

    const saved = await gymPut(deps, "2026-11-11", "gx-bench-press", { sets: sets(1, 82.5, 5, true) });
    expect(saved.body).toMatchObject({ prs: 1 });
    const again = await gymPut(deps, "2026-11-11", "gx-bench-press", { sets: sets(1, 80, 8, true) });
    expect(again.body).toMatchObject({ prs: 0 });
  });
});
