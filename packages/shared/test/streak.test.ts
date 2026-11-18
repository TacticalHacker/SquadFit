import { describe, expect, it } from "vitest";
import { DAILY_GOAL_MINUTES, goalProgress } from "../src/domain/streak";

describe("goalProgress", () => {
  it("is a 0..1 fraction of the daily goal and flags a met goal", () => {
    expect(DAILY_GOAL_MINUTES).toBe(30);
    expect(goalProgress(0)).toEqual({ fraction: 0, met: false });
    expect(goalProgress(15)).toEqual({ fraction: 0.5, met: false });
    expect(goalProgress(30)).toEqual({ fraction: 1, met: true });
    expect(goalProgress(90)).toEqual({ fraction: 1, met: true });
  });
});
