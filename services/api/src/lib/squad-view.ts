import { streakFigures, type SquadMemberSchema, type SquadStats, type WeeklyStreak } from "@calci/shared";
import type { z } from "zod";
import { avatarUrl } from "./views";
import type { AvatarStore } from "./avatar-store";
import { squadSettingsOf, type ProfileItem } from "./profile-repo";

type SquadMember = z.infer<typeof SquadMemberSchema>;

/** FR-003: a member who turned the leaderboard off is hidden from everyone else, never from themselves. */
export const visibleTo = (profile: ProfileItem, viewerId: string) => profile.leaderboardVisible !== false || profile.userId === viewerId;

/** FR-002: the only fields another member may see. */
export async function squadMember(profile: ProfileItem, viewerId: string, avatars: AvatarStore): Promise<SquadMember> {
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    avatarUrl: await avatarUrl(profile, avatars),
    isYou: profile.userId === viewerId,
  };
}

/** The member's weekly streak for their own screens and their AI agent (FR-032). Empty history gives 0 / target. */
export function weeklyStreakOf(profile: ProfileItem, stats: SquadStats | null, today: string): WeeklyStreak {
  return streakFigures(stats?.weeks ?? {}, today, squadSettingsOf(profile).weeklyTarget);
}
