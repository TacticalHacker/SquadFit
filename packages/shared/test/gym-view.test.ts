import { describe, expect, it } from "vitest";
import type { StoredEntry } from "../src/domain/day-view";
import { GYM_EXERCISES, buildGymView, filterExercises, type GymExerciseView } from "../src/domain/gym";

const base = { date: "2026-11-11", today: "2026-11-11", timezone: "Asia/Kolkata" };
const gymEntry = (id: string, name: string, group = "legs"): StoredEntry => ({
  workoutId: id, name, rateMinutes: 5, rateCalories: 30, minutes: 8, calories: 45,
  kind: "gym", muscleGroup: group as "legs", exerciseKind: "strength",
  sets: [1, 2, 3].map((n) => ({ setNumber: n, reps: 8, weightKg: 80, completed: true })), volumeKg: 1920,
  createdAt: "c", updatedAt: "u",
});

describe("buildGymView", () => {
  it("lists built-ins in catalog order, then own A→Z", () => {
    const v = buildGymView({ ...base, ownExercises: [{ exerciseId: "gc-2", name: "Zercher", group: "legs" }, { exerciseId: "gc-1", name: "Hip Thrust", group: "legs" }], entries: [], last: {} });
    expect(v.exercises.slice(0, GYM_EXERCISES.length).map((e) => e.exerciseId)).toEqual(GYM_EXERCISES.map((e) => e.id));
    expect(v.exercises.slice(GYM_EXERCISES.length).map((e) => e.name)).toEqual(["Hip Thrust", "Zercher"]);
    expect(v.exercises[GYM_EXERCISES.length]).toMatchObject({ isBuiltIn: false, kind: "strength", group: "legs", entry: null, last: null });
  });

  it("attaches the day's entry, `last`, and the whole-day summary", () => {
    const last = { date: "2026-11-09", sets: [{ setNumber: 1, reps: 8, weightKg: 80, completed: true }], minutes: 3, top: { weightKg: 80, reps: 8 } };
    const v = buildGymView({
      ...base, ownExercises: [],
      entries: [gymEntry("gx-barbell-squat", "Barbell Squat"), { workoutId: "std-running", name: "Running", rateMinutes: 30, rateCalories: 300, minutes: 30, calories: 300 }],
      last: { "gx-barbell-squat": last },
    });
    const squat = v.exercises.find((e) => e.exerciseId === "gx-barbell-squat")!;
    expect(squat.entry).toMatchObject({ volumeKg: 1920, minutes: 8, calories: 45, updatedAt: "u" });
    expect(squat.last).toEqual(last);
    expect(v.summary).toEqual({ totalMinutes: 38, totalCalories: 345 });
    expect(v.editable).toBe(true);
  });

  it("shows a removed own exercise only when it has an entry that day, using the snapshot", () => {
    const v = buildGymView({ ...base, ownExercises: [], entries: [gymEntry("gc-gone", "Hip Thrust")], last: {} });
    expect(v.exercises.find((e) => e.exerciseId === "gc-gone")).toMatchObject({ name: "Hip Thrust", group: "legs", isBuiltIn: false });
  });

  it("is read-only outside the edit window", () => {
    expect(buildGymView({ ...base, date: "2026-11-08", ownExercises: [], entries: [], last: {} }).editable).toBe(false);
  });
});

describe("filterExercises", () => {
  const list = buildGymView({ ...base, ownExercises: [{ exerciseId: "gc-1", name: "Cable Curl Machine", group: "arms" }], entries: [], last: {} }).exercises;
  const names = (xs: GymExerciseView[]) => xs.map((e) => e.name);

  it("filters by group without a query", () => {
    expect(names(filterExercises(list, "legs", ""))).toEqual(["Barbell Squat", "Leg Press", "Romanian Deadlift", "Leg Extension", "Hamstring Curl", "Calf Raises"]);
  });

  it("searches every group, ignoring case and spaces", () => {
    expect(names(filterExercises(list, "chest", "  CURL "))).toEqual(["Hamstring Curl", "Barbell Curl", "Hammer Curl", "Cable Curl Machine"]);
  });
});

describe("GymEntryView.aiNote (feature 007)", () => {
  it("is the stored note, or null", async () => {
    const { toGymEntryView } = await import("../src/domain/gym");
    expect(toGymEntryView({ ...gymEntry("gx-a", "A"), calories: 62, aiNote: "6 MET" })).toMatchObject({ calories: 62, aiNote: "6 MET" });
    expect(toGymEntryView(gymEntry("gx-a", "A")).aiNote).toBeNull();
  });
});
