import { describe, expect, it } from "vitest";
import { handle } from "../src/handlers/coach-note-get";
import type { FoodEntryItem } from "../src/lib/food-repo";
import { makeDeps, makeEvent, parse, seedProfile, seedWorkoutEntry } from "./fakes";

const note = {
  date: "2026-11-11",
  headline: "On track",
  status: "on_track" as const,
  highlights: ["Good day"],
  actionItems: ["Walk"],
};

function typed(entryId: string, calories: number, protein: number, extra: Partial<FoodEntryItem> = {}): FoodEntryItem {
  const macros = { protein, carbs: 0, fat: 0 };
  return {
    entryId, date: "2026-11-11", meal: "lunch", source: "typed", name: "x", servings: 1, calories, macros,
    rate: { calories, macros }, createdAt: "t", updatedAt: "t", ...extra,
  };
}

describe("GET /coach-note (feature 007 pulse)", () => {
  it("returns nulls when there is no note", async () => {
    const { deps, profiles } = makeDeps();
    await seedProfile(profiles);
    expect(parse(await handle(makeEvent({}), deps)).body).toEqual({ note: null, metrics: null });
  });

  it("treats a legacy markdown note as no note", async () => {
    const { deps, profiles, coach } = makeDeps();
    await seedProfile(profiles);
    coach.seedLegacy("user-1", "2026-11-11");
    expect(parse(await handle(makeEvent({}), deps)).body).toEqual({ note: null, metrics: null });
  });

  it("returns the note and live metrics for the day", async () => {
    const { deps, profiles, coach, food, workouts, gym } = makeDeps();
    await seedProfile(profiles);
    await coach.put("user-1", note, "2026-11-11T05:00:00.000Z");
    await food.putEntry("user-1", typed("0000000000001-aaaaaa", 600, 40));
    await food.putEntry(
      "user-1",
      typed("0000000000002-bbbbbb", 0, 0, { source: "photo", photo: { status: "pending", caption: "" }, macros: null }),
    );
    await seedWorkoutEntry(workouts, "user-1", "2026-11-11", 200, "c-padel");
    await gym.putGymEntry("user-1", {
      date: "2026-11-11", workoutId: "gx-bench-press", name: "Bench", kind: "gym", muscleGroup: "chest",
      exerciseKind: "strength", rateMinutes: 1, rateCalories: 1, minutes: 8, calories: 45, volumeKg: 1440,
      sets: [], createdAt: "t", updatedAt: "t",
    });
    const r = parse(await handle(makeEvent({ queryStringParameters: { date: "2026-11-11" } }), deps));
    expect(r.status).toBe(200);
    expect(r.body.note).toEqual({
      date: "2026-11-11",
      headline: "On track",
      status: "on_track",
      highlights: ["Good day"],
      actions: [{ text: "Walk", done: false }],
      generatedBy: "AI",
      updatedAt: "2026-11-11T05:00:00.000Z",
    });
    expect(r.body.metrics).toEqual({ netCalories: 600 - 245, proteinG: 40, gymVolumeKg: 1440 });
  });

  it("never returns another member's note", async () => {
    const { deps, profiles, coach } = makeDeps();
    await seedProfile(profiles);
    await coach.put("user-2", note, "t");
    expect(parse(await handle(makeEvent({}), deps)).body).toEqual({ note: null, metrics: null });
  });

  it("400 for a future date, 409 without profile", async () => {
    const { deps, profiles } = makeDeps();
    expect(parse(await handle(makeEvent({}), deps)).status).toBe(409);
    await seedProfile(profiles);
    expect(parse(await handle(makeEvent({ queryStringParameters: { date: "2026-11-12" } }), deps)).status).toBe(400);
  });
});
