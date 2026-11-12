import { z } from "zod";

/**
 * Anonymous endpoints for the public landing page (feature 009). Constitution VI allows exactly these
 * two community-wide counts; `.strict()` makes any extra field a parse error on the web side.
 */
export const PulseResponseSchema = z
  .object({
    lifters: z.number().int().min(0),
    workoutsLast7Days: z.number().int().min(0),
    computedAt: z.iso.datetime(),
  })
  .strict();
export type PulseResponse = z.infer<typeof PulseResponseSchema>;

export const WaitlistGoalSchema = z.enum(["build_muscle", "lose_fat", "get_stronger", "stay_consistent"]);
export type WaitlistGoal = z.infer<typeof WaitlistGoalSchema>;

export const WAITLIST_GOAL_LABELS: Record<WaitlistGoal, string> = {
  build_muscle: "Build muscle",
  lose_fat: "Lose fat",
  get_stronger: "Get stronger",
  stay_consistent: "Stay consistent",
};

export const WaitlistRequestSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(60, "Use 60 characters or fewer"),
  email: z.string().trim().toLowerCase().max(254, "That email is too long").pipe(z.email("Enter a valid email")),
  primaryGoal: WaitlistGoalSchema,
  /** Honeypot: hidden from people; anything here means a bot (research R6). */
  website: z.string().max(200).optional(),
});
export type WaitlistRequest = z.infer<typeof WaitlistRequestSchema>;

export const WaitlistResponseSchema = z.object({ status: z.literal("received") });
export type WaitlistResponse = z.infer<typeof WaitlistResponseSchema>;
