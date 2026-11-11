import { describe, expect, it } from "vitest";
import { HealthResponseSchema } from "../src";

describe("HealthResponseSchema", () => {
  it("accepts a valid payload", () => {
    const parsed = HealthResponseSchema.parse({
      status: "ok",
      stage: "dev",
      time: new Date().toISOString(),
    });
    expect(parsed.status).toBe("ok");
  });

  it("rejects an unknown status", () => {
    expect(() => HealthResponseSchema.parse({ status: "down", stage: "dev", time: "x" })).toThrow();
  });
});
