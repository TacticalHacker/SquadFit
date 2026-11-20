import { describe, expect, it } from "vitest";
import { buildShareSummary, type ShareEntry } from "../src/domain/share-card";
import { buildMemberStats, type SquadStats } from "../src/domain/squad";
import type { MuscleGroup } from "../src/domain/gym";

const DATE = "2026-11-18";
let clock = 0;
const at = () => `2026-11-18T10:${String(clock++).padStart(2, "0")}:00.000Z`;

const lift = (id: string, group: MuscleGroup, sets: [number, number, boolean?][], date = DATE): ShareEntry => ({
  date,
  workoutId: id,
  name: id,
  kind: "gym",
  exerciseKind: "strength",
  muscleGroup: group,
  minutes: sets.length * 2.5,
  sets: sets.map(([weightKg, reps, completed], i) => ({ setNumber: i + 1, weightKg, reps, completed: completed ?? true })),
  createdAt: at(),
});
const cardio = (id: string, minutes: number): ShareEntry => ({ date: DATE, workoutId: id, name: id, kind: "gym", exerciseKind: "cardio", muscleGroup: "cardio", minutes, createdAt: at() });
const activity = (name: string, minutes: number): ShareEntry => ({ date: DATE, workoutId: `c-${name}`, name, minutes, createdAt: at() });

const build = (entries: ShareEntry[], stats: SquadStats | null = null, steps: number | null = null) =>
  buildShareSummary({ date: DATE, entries, stats, weeklyTarget: 3, steps });

describe("buildShareSummary", () => {
  it("picks each exercise's top set and working-set volume", () => {
    const s = build([lift("gx-bench-press", "chest", [[60, 10], [70, 5], [70, 6], [80, 1, false]]), lift("gx-pull-ups", "back", [[0, 12], [0, 10]])]);
    expect(s.rows[0]).toEqual({ kind: "strength", exerciseId: "gx-bench-press", name: "gx-bench-press", top: { weightKg: 70, reps: 6 }, volumeKg: 1370 });
    // Bodyweight sets still give a top set (0 kg) but no volume.
    expect(s.rows[1]).toMatchObject({ top: { weightKg: 0, reps: 12 }, volumeKg: 0 });
  });

  it("labels the session by its two biggest muscle groups and counts every workout entry", () => {
    const s = build([
      lift("gx-shoulder-press", "shoulders", [[40, 10]]),
      lift("gx-bench-press", "chest", [[60, 10], [60, 10]]),
      lift("gx-curl", "arms", [[10, 10]]),
      lift("gx-skipped", "legs", [[100, 5, false]]), // no completed set: not a workout entry
      cardio("gx-incline-treadmill-walk", 5),
      activity("Football", 30),
    ]);
    expect(s.label).toBe("Chest · Shoulders");
    expect(s.exerciseCount).toBe(5);
    expect(s.durationMin).toBe(2.5 + 5 + 2.5 + 5 + 30);
    expect(s.rows.at(-1)).toEqual({ kind: "minutes", name: "Football", minutes: 30 });
    expect(build([activity("Run", 20)]).label).toBeNull();
  });

  it("shows at most five rows, in logged order, and counts the rest", () => {
    const entries = Array.from({ length: 10 }, (_, i) => lift(`gx-ex-${i}`, "chest", [[20, 10]]));
    const s = build([...entries].reverse());
    expect(s.rows.map((r) => (r.kind === "strength" ? r.exerciseId : r.name))).toEqual(["gx-ex-0", "gx-ex-1", "gx-ex-2", "gx-ex-3", "gx-ex-4"]);
    expect(s.moreCount).toBe(5);
  });

  it("counts lifts improved and lists PRs from the squad stats for that day only", () => {
    const history = [lift("gx-bench-press", "chest", [[80, 5]], "2026-11-11"), lift("gx-barbell-squat", "legs", [[100, 5]], "2026-11-11")];
    const today = [lift("gx-bench-press", "chest", [[82.5, 5]]), lift("gx-barbell-squat", "legs", [[100, 4]])];
    const { stats } = buildMemberStats([...history, ...today], null, { weeklyTarget: 3, today: DATE, nowIso: "2026-11-18T12:00:00.000Z" });
    const s = build(today, stats);
    expect(s.liftsImproved).toBe(1);
    expect(s.prs).toHaveLength(1);
    expect(s.prs[0]).toMatchObject({ exerciseId: "gx-bench-press", weightKg: 82.5, reps: 5, gainKg: expect.any(Number) });
    // Stats written before improvedDays existed read as none.
    const old = structuredClone(stats);
    for (const l of Object.values(old.lifts)) delete l.improvedDays;
    expect(build(today, old).liftsImproved).toBe(0);
  });

  it("gives the streak at that date and passes steps through", () => {
    const s = build([activity("Run", 20)], null, 8412);
    expect(s.streak).toEqual({ weeks: 0, weekDays: 0, target: 3 });
    expect(s.steps).toBe(8412);
  });
});
