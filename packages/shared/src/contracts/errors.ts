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
