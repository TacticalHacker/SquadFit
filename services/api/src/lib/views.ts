import type { OwnProfile, PublicMember } from "@calci/shared";
import type { AvatarStore } from "./avatar-store";
import type { ProfileItem } from "./profile-repo";

export async function avatarUrl(item: ProfileItem, avatars: AvatarStore): Promise<string | null> {
  return item.avatarKey ? avatars.urlFor(item.avatarKey) : null;
}

export async function toOwnProfile(item: ProfileItem, avatars: AvatarStore): Promise<OwnProfile> {
  return {
    displayName: item.displayName,
    timezone: item.timezone,
    dailyCalorieTarget: item.dailyCalorieTarget,
    dailyProteinTarget: item.dailyProteinTarget ?? null,
    bodyWeightKg: item.bodyWeightKg ?? null,
    avatarUrl: await avatarUrl(item, avatars),
    joinedAt: item.createdAt,
  };
}

/** Public view: no calorie target, timezone or username (spec FR-018). */
export async function toPublicMember(
  item: ProfileItem,
  callerId: string,
  avatars: AvatarStore,
): Promise<PublicMember> {
  return {
    userId: item.userId,
    displayName: item.displayName,
    avatarUrl: await avatarUrl(item, avatars),
    joinedAt: item.createdAt,
    isYou: item.userId === callerId,
  };
}
