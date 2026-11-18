import type { APIGatewayProxyResultV2 } from "aws-lambda";
import type { NutritionLevel } from "@calci/shared";
import type { Deps } from "./deps";
import { apiError } from "./http";
import { squadSettingsOf, stepSettingsOf, type ProfileItem } from "./profile-repo";
import { visibleTo } from "./squad-view";

export type MemberAccess =
  | { ok: true; profile: ProfileItem; isYou: boolean; level: NutritionLevel }
  | { ok: false; response: APIGatewayProxyResultV2 };

const ID = /^[A-Za-z0-9-]{1,64}$/;

/** One body for every refusal, so a hidden member cannot be told apart from a missing one (research R7). */
export const privateResponse = () => apiError(403, "MEMBER_PRIVATE", "This member keeps their log private");

/**
 * The single gate for everything about another member (feature 011). Missing, malformed and hidden members all get the
 * same 403. The returned `level` is what nutrition the viewer may see: the owner's own choice, `off` if they are
 * hidden, and `meals` (everything) for the owner looking at themselves.
 */
export async function resolveMember(viewerId: string, memberId: string | undefined, deps: Deps): Promise<MemberAccess> {
  if (!memberId || !ID.test(memberId)) return { ok: false, response: privateResponse() };
  const profile = await deps.profiles.get(memberId);
  if (!profile || !visibleTo(profile, viewerId)) return { ok: false, response: privateResponse() };
  const isYou = profile.userId === viewerId;
  const level: NutritionLevel = isYou ? "meals" : squadSettingsOf(profile).leaderboardVisible ? squadSettingsOf(profile).nutritionSharing : "off";
  return { ok: true, profile, isYou, level };
}

/** The level other members get for a profile, without the owner special case (leaderboard rows). */
export const sharedLevel = (p: ProfileItem): NutritionLevel => (squadSettingsOf(p).leaderboardVisible ? squadSettingsOf(p).nutritionSharing : "off");

/**
 * Feature 012, the one gate for steps (constitution VI 2.5.0): other members see a member's steps only while that
 * member is visible on the leaderboard and has "Share my steps" on. The owner always sees their own.
 */
export const stepsShared = (p: ProfileItem): boolean => squadSettingsOf(p).leaderboardVisible && stepSettingsOf(p).shareSteps;
export const stepsVisibleTo = (p: ProfileItem, viewerId: string): boolean => p.userId === viewerId || stepsShared(p);
