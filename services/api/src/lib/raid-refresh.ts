import { SQUAD_ID, countedKg, isCounting, raidContribution, raidTotal, type Raid, type RaidEntry } from "@calci/shared";
import type { Deps } from "./deps";
import type { ProfileItem } from "./profile-repo";

export type RaidDeps = Pick<Deps, "raids" | "squad" | "now">;

/**
 * Feature 021 (research R2–R5): recompute one member's contribution to every raid still counting, from the entries the
 * stats rebuild just read. Returns the counted kg this rebuild added (the save toast). Never log kg or entries.
 */
export async function refreshRaids(
  args: { userId: string; profile: Pick<ProfileItem, "createdAt">; entries: readonly RaidEntry[]; held: Readonly<Record<string, readonly number[]>>; statsVersion: number },
  deps: RaidDeps,
): Promise<number> {
  const now = deps.now();
  const raids = (await deps.raids.listRaids(SQUAD_ID)).filter((r) => isCounting(r, now));
  if (raids.length === 0) return 0;
  const timezone = (await deps.squad.getSquadSettings(SQUAD_ID)).timezone;
  const nowIso = now.toISOString();
  let added = 0;
  for (const raid of raids) {
    const prev = await deps.raids.getContribution(raid.raidId, args.userId);
    const next = raidContribution(args.entries, raid, { timezone, held: args.held, memberCreatedAt: args.profile.createdAt });
    if (!prev && next.setCount === 0) continue;
    if (prev && prev.rawKg === next.rawKg && prev.setCount === next.setCount) {
      // Nothing changed, but a won raid may still owe this contributor a sticker (best effort repair).
      if (raid.wonAt && next.setCount > 0) await awardSticker(raid, args.userId, deps, nowIso);
      continue;
    }
    const grew = next.rawKg > (prev?.rawKg ?? 0) || next.setCount > (prev?.setCount ?? 0);
    const put = await deps.raids.putContribution({
      raidId: raid.raidId,
      userId: args.userId,
      rawKg: next.rawKg,
      setCount: next.setCount,
      lastCountedAt: grew ? nowIso : (prev?.lastCountedAt ?? null),
      statsVersion: args.statsVersion,
      updatedAt: nowIso,
    });
    if (put === "stale") continue;
    added += Math.max(0, countedKg(next.rawKg, raid) - countedKg(prev?.rawKg ?? 0, raid));
    await settleRaid(raid, deps, nowIso, next.setCount > 0 ? args.userId : null);
  }
  return Math.round(added * 10) / 10;
}

/**
 * Sum every contribution, cache the total and record the win exactly once (FR-003, FR-019). On the win every
 * contributor gets the sticker; on an already won raid only `contributorId` (if any) is checked.
 */
export async function settleRaid(raid: Raid, deps: Pick<Deps, "raids">, nowIso: string, contributorId: string | null): Promise<number> {
  const contributions = await deps.raids.listContributions(raid.raidId);
  const total = raidTotal(contributions.map((c) => c.rawKg), raid);
  await deps.raids.setTotal(raid.raidId, total);
  if (raid.cancelledAt) return total;
  if (!raid.wonAt && total >= raid.targetKg && (await deps.raids.markWon(raid.raidId, nowIso))) {
    for (const c of contributions) if (c.setCount > 0) await awardSticker(raid, c.userId, deps, nowIso);
  } else if (raid.wonAt && contributorId) {
    await awardSticker(raid, contributorId, deps, nowIso);
  }
  return total;
}

export const awardSticker = (raid: Raid, userId: string, deps: Pick<Deps, "raids">, nowIso: string) =>
  deps.raids.putSticker(userId, { raidId: raid.raidId, stickerId: raid.stickerId, awardedAt: nowIso });
