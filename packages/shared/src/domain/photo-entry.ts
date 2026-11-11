import { z } from "zod";

/** Photo food entries (feature 005): pending → ai | manual → edited. See specs/005-photo-food-log/data-model.md. */
export const PHOTO_STATUSES = ["pending", "ai", "manual", "edited"] as const;
export type PhotoStatus = (typeof PHOTO_STATUSES)[number];
export const PhotoStatusSchema = z.enum(PHOTO_STATUSES);

export const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
export const CAPTION_MAX = 200;
export const PHOTO_CONTENT_TYPES = ["image/jpeg", "image/webp"] as const;
export const PhotoContentTypeSchema = z.enum(PHOTO_CONTENT_TYPES);

export const CaptionSchema = z.string().trim().max(CAPTION_MAX, `Caption must be at most ${CAPTION_MAX} characters`);

/** Real image type from the bytes themselves; the client's declared type is never trusted. */
export function sniffImage(bytes: Uint8Array): (typeof PHOTO_CONTENT_TYPES)[number] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/** Entry name shown in lists and history: the caption (cut to the 60-char food-name limit) or "Photo meal". */
export function photoEntryName(caption: string): string {
  const c = caption.trim().replace(/\s+/g, " ");
  return c ? Array.from(c).slice(0, 60).join("") : "Photo meal";
}

export type PhotoActor = "agent" | "user";

export function canTransition(from: PhotoStatus, to: PhotoStatus, actor: PhotoActor): boolean {
  if (from === "pending" && to === "ai") return actor === "agent";
  if (from === "pending" && to === "manual") return actor === "user";
  if (to === "edited") return actor === "user" && from !== "pending";
  return false;
}
