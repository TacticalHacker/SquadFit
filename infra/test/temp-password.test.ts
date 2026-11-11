import { describe, expect, it } from "vitest";
import { generateTempPassword, TEMP_PASSWORD_ALPHABET } from "../scripts/temp-password";

describe("generateTempPassword", () => {
  it("is 16 characters from the unambiguous alphabet", () => {
    const pw = generateTempPassword();
    expect(pw).toHaveLength(16);
    for (const ch of pw) expect(TEMP_PASSWORD_ALPHABET).toContain(ch);
  });

  it("never contains look-alike characters", () => {
    for (const ch of "0O1lI") expect(TEMP_PASSWORD_ALPHABET).not.toContain(ch);
  });

  it("differs between calls", () => {
    expect(generateTempPassword()).not.toBe(generateTempPassword());
  });
});
