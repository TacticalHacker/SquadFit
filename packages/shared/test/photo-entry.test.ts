import { describe, expect, it } from "vitest";
import { canTransition, CAPTION_MAX, CaptionSchema, MAX_PHOTO_BYTES, photoEntryName, sniffImage } from "../src/domain/photo-entry";

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const webp = Uint8Array.from([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);

describe("sniffImage", () => {
  it("recognises JPEG and WebP by magic bytes only", () => {
    expect(sniffImage(jpeg)).toBe("image/jpeg");
    expect(sniffImage(webp)).toBe("image/webp");
    expect(sniffImage(png)).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
    expect(sniffImage(Uint8Array.from([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WAVE")]))).toBeNull();
  });
  it("limits photos to 1.5 MB", () => {
    expect(MAX_PHOTO_BYTES).toBe(1.5 * 1024 * 1024);
  });
});

describe("CaptionSchema", () => {
  it("trims, allows empty and rejects over 200 chars", () => {
    expect(CaptionSchema.parse("  dal and rice  ")).toBe("dal and rice");
    expect(CaptionSchema.parse("")).toBe("");
    expect(CaptionSchema.safeParse("a".repeat(CAPTION_MAX)).success).toBe(true);
    expect(CaptionSchema.safeParse("a".repeat(CAPTION_MAX + 1)).success).toBe(false);
  });
});

describe("photoEntryName", () => {
  it("uses the caption cut to 60 chars, or 'Photo meal'", () => {
    expect(photoEntryName("dal, 2 rotis")).toBe("dal, 2 rotis");
    expect(photoEntryName("x".repeat(100))).toHaveLength(60);
    expect(photoEntryName("")).toBe("Photo meal");
    expect(photoEntryName("   ")).toBe("Photo meal");
  });
});

describe("canTransition", () => {
  it("lets only the agent move pending → ai", () => {
    expect(canTransition("pending", "ai", "agent")).toBe(true);
    expect(canTransition("pending", "ai", "user")).toBe(false);
  });
  it("lets the user fill pending by hand and correct analysed entries", () => {
    expect(canTransition("pending", "manual", "user")).toBe(true);
    expect(canTransition("pending", "manual", "agent")).toBe(false);
    for (const from of ["ai", "manual", "edited"] as const) expect(canTransition(from, "edited", "user")).toBe(true);
  });
  it("never lets the agent touch a non-pending entry or go backwards", () => {
    for (const from of ["ai", "manual", "edited"] as const) {
      expect(canTransition(from, "ai", "agent")).toBe(false);
      expect(canTransition(from, "pending", "user")).toBe(false);
    }
    expect(canTransition("pending", "edited", "user")).toBe(false);
  });
});
