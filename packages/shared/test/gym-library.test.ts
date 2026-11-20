import { describe, expect, it } from "vitest";
import {
  GYM_EXERCISES,
  buildLibrary,
  catalogId,
  isExerciseNameTaken,
  isLibraryNameTaken,
  type CatalogExercise,
} from "../src/domain/gym";

const item = (exerciseId: string, name: string, status: "active" | "retired" = "active"): CatalogExercise => ({
  exerciseId, name, group: "arms", kind: "strength", status,
  createdAt: "t", createdBy: "roshan", updatedAt: "t", updatedBy: "roshan",
});

describe("buildLibrary (feature 015)", () => {
  it("lists built-ins first, then active catalog items by name; retired are left out", () => {
    const lib = buildLibrary([item("gx-zottman-curl", "Zottman Curl"), item("gx-cable-kickback", "Cable Kickback"), item("gx-old", "Old", "retired")]);
    expect(lib.slice(0, GYM_EXERCISES.length)).toEqual(GYM_EXERCISES);
    expect(lib.slice(GYM_EXERCISES.length)).toEqual([
      { id: "gx-cable-kickback", name: "Cable Kickback", group: "arms", kind: "strength", source: "catalog" },
      { id: "gx-zottman-curl", name: "Zottman Curl", group: "arms", kind: "strength", source: "catalog" },
    ]);
  });
});

describe("catalogId", () => {
  it("slugs the name and adds a suffix when taken (built-ins always count)", () => {
    expect(catalogId("Cable Kickback", [])).toBe("gx-cable-kickback");
    expect(catalogId("Bench Press!", [])).toBe("gx-bench-press-2");
    expect(catalogId("Bench Press", ["gx-bench-press-2"])).toBe("gx-bench-press-3");
  });
});

describe("library names", () => {
  it("built-ins and every catalog row (retired too) reserve a name", () => {
    expect(isLibraryNameTaken("bench  PRESS", [])).toBe(true);
    expect(isLibraryNameTaken("Cable Kickback", [item("gx-cable-kickback", "cable kickback", "retired")])).toBe(true);
    expect(isLibraryNameTaken("Cable Kickback", [])).toBe(false);
  });
  it("a member's own name clashes with an active catalog exercise", () => {
    const lib = buildLibrary([item("gx-cable-kickback", "Cable Kickback")]);
    expect(isExerciseNameTaken("cable  kickback", [], lib)).toBe(true);
    expect(isExerciseNameTaken("cable kickback", [], GYM_EXERCISES)).toBe(false);
    // Punctuation is ignored too: "EZ Bar Curl" is the built-in "EZ-Bar Curl".
    expect(isExerciseNameTaken("EZ Bar Curl", [], GYM_EXERCISES)).toBe(true);
  });
});
