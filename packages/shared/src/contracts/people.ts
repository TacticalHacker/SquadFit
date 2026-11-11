import { z } from "zod";

/** What other members may see. Deliberately has no calorie target, timezone or username (FR-018). */
export const PublicMemberSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  joinedAt: z.iso.datetime(),
  isYou: z.boolean(),
});
export type PublicMember = z.infer<typeof PublicMemberSchema>;

export const PeopleResponseSchema = z.object({ members: z.array(PublicMemberSchema) });
export type PeopleResponse = z.infer<typeof PeopleResponseSchema>;
