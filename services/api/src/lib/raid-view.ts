import {
  RAID_LIMITS,
  capKg,
  countedKg,
  raidDaysLeft,
  raidPace,
  raidPct,
  raidStatus,
  raidTotal,
  type AdminRaid,
  type Raid,
  type RaidCard,
} from "@calci/shared";
import type { AvatarStore } from "./avatar-store";
import type { ProfileItem } from "./profile-repo";
import type { RaidContribution } from "./raid-repo";
import { visibleTo } from "./squad-view";
import { avatarUrl } from "./views";

export function adminRaid(r: Raid, now: Date): AdminRaid {
  return {
    raidId: r.raidId,
    name: r.name,
    tagline: r.tagline ?? null,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    targetKg: r.targetKg,
    filter: r.filter,
    capPct: r.capPct,
    lateJoiners: r.lateJoiners,
    showContributors: r.showContributors,
    stickerId: r.stickerId,
    draft: r.draft,
    status: raidStatus(r, now),
    totalKg: r.totalKg,
    wonAt: r.wonAt ?? null,
    cancelledAt: r.cancelledAt ?? null,
    cancelReason: r.cancelReason ?? null,
    updatedAt: r.updatedAt,
  };
}

/**
 * The Squad tab card (FR-021–FR-023, FR-029). Other members appear only by name and avatar, only when visible to the
 * viewer and only with "Show contributors" on; kg, % and "capped" are the viewer's own.
 */
export async function buildRaidCard(args: {
  raid: Raid;
  contributions: readonly RaidContribution[];
  viewerId: string;
  profiles: ReadonlyMap<string, ProfileItem>;
  avatars: AvatarStore;
  now: Date;
  hasSticker: boolean;
}): Promise<RaidCard> {
  const { raid, contributions, viewerId, now } = args;
  const status = raidStatus(raid, now);
  const total = raidTotal(contributions.map((c) => c.rawKg), raid);
  const own = contributions.find((c) => c.userId === viewerId);
  const ownKg = countedKg(own?.rawKg ?? 0, raid);

  let contributors: RaidCard["contributors"] = null;
  if (raid.showContributors) {
    const picked = contributions
      .filter((c) => c.setCount > 0)
      .sort((a, b) => (b.lastCountedAt ?? "").localeCompare(a.lastCountedAt ?? ""))
      .flatMap((c) => {
        const p = args.profiles.get(c.userId);
        return p && visibleTo(p, viewerId) ? [p] : [];
      })
      .slice(0, RAID_LIMITS.contributors);
    contributors = await Promise.all(picked.map(async (p) => ({ userId: p.userId, displayName: p.displayName, avatarUrl: await avatarUrl(p, args.avatars) })));
  }

  return {
    raidId: raid.raidId,
    name: raid.name,
    tagline: raid.tagline ?? null,
    status: status === "draft" ? "scheduled" : status,
    startsAt: raid.startsAt,
    endsAt: raid.endsAt,
    targetKg: raid.targetKg,
    totalKg: total,
    pct: raidPct(total, raid.targetKg),
    pace: raidPace(raid, now),
    daysLeft: raidDaysLeft(raid, now),
    cancelReason: raid.cancelReason ?? null,
    you: { kg: ownKg, rawKg: own?.rawKg ?? 0, pct: raidPct(ownKg, raid.targetKg), capped: (own?.rawKg ?? 0) > capKg(raid), sticker: args.hasSticker },
    contributors,
  };
}
