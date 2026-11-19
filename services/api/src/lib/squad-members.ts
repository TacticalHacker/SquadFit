import { SQUAD_ID, localDate, squadMonth, type SquadBoardMember } from "@calci/shared";
import type { Deps } from "./deps";
import { squadSettingsOf, type ProfileItem } from "./profile-repo";
import { visibleTo } from "./squad-view";
import { avatarUrl } from "./views";

/**
 * Feature 013: everything the boards and the Hall of Fame start from. Members hidden from the viewer are dropped here,
 * on the server, before any ranking (feature 010 FR-003); the viewer is kept so a hidden viewer still sees their row.
 */
export async function loadSquadMembers(viewerId: string, deps: Deps) {
  const profiles = (await deps.profiles.listCommunity()).filter((p) => visibleTo(p, viewerId));
  const [stats, settings] = await Promise.all([deps.squad.batchGetStats(profiles.map((p) => p.userId)), deps.squad.getSquadSettings(SQUAD_ID)]);
  const now = deps.now();
  const members: (SquadBoardMember & { profile: ProfileItem })[] = await Promise.all(
    profiles.map(async (p) => ({
      userId: p.userId,
      displayName: p.displayName,
      avatarUrl: await avatarUrl(p, deps.avatars),
      today: localDate(now, p.timezone),
      weeklyTarget: squadSettingsOf(p).weeklyTarget,
      visible: squadSettingsOf(p).leaderboardVisible,
      stats: stats.get(p.userId) ?? null,
      profile: p,
    })),
  );
  return { members, month: squadMonth(now, settings.timezone) };
}
