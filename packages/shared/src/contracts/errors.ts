import { z } from "zod";

export const ApiErrorCodeSchema = z.enum([
  "VALIDATION_FAILED",
  "PROFILE_REQUIRED",
  "PAYLOAD_TOO_LARGE",
  "UNAUTHORIZED",
  "DAY_LOCKED",
  "DUPLICATE_NAME",
  "NOT_FOUND",
  "RATE_LIMITED",
  "LIMIT_REACHED",
  "MEMBER_PRIVATE",
  // Feature 015 (exercise admin).
  "FORBIDDEN",
  "STALE",
  "CATALOG_FULL",
  "USERNAME_TAKEN",
  // Feature 016 (share a workout day).
  "NOT_A_WORKOUT_DAY",
  "HIDDEN",
  // Feature 014 (bodyweight log).
  "DAY_FULL",
  // Feature 021 (squad volume raid).
  "RAID_RULE",
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
