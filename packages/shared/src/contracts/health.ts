import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  stage: z.string(),
  time: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
