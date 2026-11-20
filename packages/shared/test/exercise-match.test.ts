import { describe, expect, it } from "vitest";
import { GYM_EXERCISES } from "../src/domain/gym";
import { suggestLibraryMatch } from "../src/domain/exercise-match";

const id = (name: string) => suggestLibraryMatch(name, GYM_EXERCISES)?.id ?? null;

describe("suggestLibraryMatch (feature 015, Story 6)", () => {
  it("expands abbreviations, plurals and equipment", () => {
    expect(id("DB Bench")).toBe("gx-flat-dumbbell-press");
    expect(id("EZ Bar Curls")).toBe("gx-ez-bar-curl");
    expect(id("Shoulder Press")).toBe("gx-seated-dumbbell-shoulder-press");
  });
  it("suggests nothing for a genuinely new exercise, an equipment clash or a tie", () => {
    expect(id("Bulgarian Split Squat")).toBeNull();
    expect(id("Smith Machine shoulder press")).toBeNull();
    expect(id("Bicep Curl")).toBeNull(); // barbell, hammer, wrist… all equally close
  });
});
