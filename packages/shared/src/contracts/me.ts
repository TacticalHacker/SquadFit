import { z } from "zod";
import { BodyWeightSchema, CalorieTargetSchema, DisplayNameSchema, ProteinTargetSchema } from "../domain/profile";
import { isValidTimeZone } from "../domain/timezone";

export const ProfileInputSchema = z.object({
  displayName: DisplayNameSchema,
  timezone: z.string().refine(isValidTimeZone, "Unknown timezone"),
  dailyCalorieTarget: CalorieTargetSchema,
  dailyProteinTarget: ProteinTargetSchema.nullish(),
  /** Feature 007: null clears it, absent leaves it unchanged. */
  bodyWeightKg: BodyWeightSchema.nullish(),
});
export type ProfileInput = z.infer<typeof ProfileInputSchema>;

export const OwnProfileSchema = z.object({
  displayName: z.string(),
  timezone: z.string(),
  dailyCalorieTarget: z.number(),
  // default: an API deployed before feature 004 omits the field (rollout skew).
  dailyProteinTarget: z.number().nullable().default(null),
  bodyWeightKg: z.number().nullable().default(null),
  avatarUrl: z.string().nullable(),
  joinedAt: z.iso.datetime(),
});
export type OwnProfile = z.infer<typeof OwnProfileSchema>;

export const MeResponseSchema = z.object({
  username: z.string(),
  profile: OwnProfileSchema.nullable(),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

/** 256×256 WebP, already resized in the browser (research R6). */
export const AvatarUploadSchema = z.object({
  contentType: z.literal("image/webp"),
  dataBase64: z.string().min(1),
});
export type AvatarUpload = z.infer<typeof AvatarUploadSchema>;
