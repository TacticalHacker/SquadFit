import { describe, expect, it } from "vitest";
import { project, rubberband, stepSpring } from "./spring";

describe("spring", () => {
  it("critically damped spring settles on target without overshoot", () => {
    let s = { value: 400, velocity: 0 };
    let min = Infinity;
    for (let i = 0; i < 240; i++) {
      s = stepSpring(s, 0, { damping: 1, response: 0.35 }, 1 / 240);
      min = Math.min(min, s.value);
    }
    for (let i = 0; i < 480; i++) s = stepSpring(s, 0, { damping: 1, response: 0.35 }, 1 / 240);
    expect(min).toBeGreaterThanOrEqual(0);
    expect(Math.abs(s.value)).toBeLessThan(0.5);
  });

  it("projects a flick forward and resists past the edge", () => {
    expect(project(1000)).toBeCloseTo(499, 0);
    expect(rubberband(100, 400)).toBeLessThan(100);
  });
});
