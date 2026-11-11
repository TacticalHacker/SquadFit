import { describe, expect, it } from "vitest";
import { UsernameSchema } from "../src/domain/username";

describe("UsernameSchema", () => {
  it.each(["abc", "Alice_01", "a".repeat(20), "A_B"])("accepts %s", (v) => {
    expect(UsernameSchema.safeParse(v).success).toBe(true);
  });

  it.each(["ab", "a".repeat(21), "a-b", "a b", "", "émile", "a@b"])("rejects %j", (v) => {
    expect(UsernameSchema.safeParse(v).success).toBe(false);
  });
});
