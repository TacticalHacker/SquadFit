import { describe, expect, it } from "vitest";
import { buildDayCard, buildDayCards, heatmapCells, pageTimeline, type ProfileEntry } from "../src/domain/member-profile";

const gym = (date: string, id: string, sets: [number, number][], extra: Partial<ProfileEntry> = {}): ProfileEntry => ({
  date,
  workoutId: id,
  name: id,
  kind: "gym",
  exerciseKind: "strength",
  rateMinutes: 0,
  rateCalories: 0,
  minutes: 10,
  calories: 50,
  sets: sets.map(([weightKg, reps], i) => ({ setNumber: i + 1, weightKg, reps, completed: true })),
  updatedAt: `${date}T10:00:00.000Z`,
  ...extra,
});
const activity = (date: string, name: string): ProfileEntry => ({
  date,
  workoutId: `gc-${name}`,
  name,
  rateMinutes: 30,
  rateCalories: 200,
  minutes: 30,
  calories: 200,
  updatedAt: `${date}T11:00:00.000Z`,
});

describe("buildDayCard", () => {
  it("lists the gym block and each activity as separate sessions, with volume, top set and PR badge", () => {
    const entries = [gym("2026-11-16", "gx-bench-press", [[100, 5], [80, 8]]), gym("2026-11-16", "gx-squat", [[120, 5]]), activity("2026-11-16", "Run")];
    const card = buildDayCard("2026-11-16", entries, { "gx-bench-press": [{ date: "2026-11-16", weightKg: 100, reps: 5, e1rm: 116.7 }] })!;
    expect(card.sessions.map((s) => s.kind)).toEqual(["gym", "activity"]);
    expect(card.volumeKg).toBe(100 * 5 + 80 * 8 + 120 * 5);
    expect(card.topSet).toEqual({ exerciseName: "gx-squat", weightKg: 120, reps: 5 });
    expect(card.prBadges).toHaveLength(1);
  });

  it("is null for a day without a workout and only carries sets when asked", () => {
    expect(buildDayCard("2026-11-17", [gym("2026-11-16", "gx-a", [[50, 5]])], {})).toBeNull();
    const withSets = buildDayCard("2026-11-16", [gym("2026-11-16", "gx-a", [[50, 5]])], {}, { withSets: true })!;
    expect(withSets.sessions[0]).toMatchObject({ exercises: [{ sets: [{ weightKg: 50, reps: 5 }] }] });
    expect((buildDayCard("2026-11-16", [gym("2026-11-16", "gx-a", [[50, 5]])], {})!.sessions[0] as { exercises: { sets?: unknown }[] }).exercises[0]!.sets).toBeUndefined();
  });
});

describe("pageTimeline", () => {
  const cards = buildDayCards(
    Array.from({ length: 25 }, (_, i) => activity(`2026-10-${String(i + 1).padStart(2, "0")}`, "Walk")),
    {},
  );
  it("returns every day exactly once, newest first, across pages", () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const { page, nextCursor } = pageTimeline(cards, cursor);
      seen.push(...page.map((c) => c.date));
      cursor = nextCursor;
    } while (cursor);
    expect(seen).toEqual(cards.map((c) => c.date));
    expect(new Set(seen).size).toBe(25);
  });
});

describe("heatmapCells", () => {
  it("shades trained days and scales volume to the member's own terciles", () => {
    const entries = [
      gym("2026-11-02", "gx-a", [[50, 5]]),
      gym("2026-11-03", "gx-a", [[100, 5]]),
      gym("2026-11-04", "gx-a", [[200, 5]]),
      activity("2026-11-05", "Run"),
    ];
    const cells = new Map(heatmapCells(entries, "2026-11-18").map((c) => [c.date, c.level]));
    expect([cells.get("2026-11-02"), cells.get("2026-11-03"), cells.get("2026-11-04")]).toEqual([2, 3, 4]);
    expect(cells.get("2026-11-05")).toBe(1);
    expect(cells.get("2026-11-06")).toBe(0);
    expect(cells.size).toBe(7 * 11 + 3); // 12 Monday-aligned weeks up to Wednesday
  });
});
