import { describe, expect, it } from "vitest";
import { isAdminClaim } from "../src/lib/auth";

describe("isAdminClaim (feature 015)", () => {
  it("reads the authorizer's string form and real arrays", () => {
    expect(isAdminClaim("[admin]")).toBe(true);
    expect(isAdminClaim("[admin other]")).toBe(true);
    expect(isAdminClaim(["admin"])).toBe(true);
    expect(isAdminClaim("[administrator]")).toBe(false);
    expect(isAdminClaim(undefined)).toBe(false);
  });
});
