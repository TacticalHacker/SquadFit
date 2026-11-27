import { randomBytes } from "node:crypto";
import { RAID_LIMITS, SQUAD_ID, type Raid, type RaidInput, type RaidIssue } from "@calci/shared";
import type { Deps } from "./deps";
import { apiError } from "./http";
import { safeRefresh } from "./squad-stats";

/** `rd-<yyyyMMdd>-<6 base36>` (data-model.md). */
export function newRaidId(now: Date): string {
  const n = randomBytes(4).readUInt32BE(0).toString(36).padStart(6, "0").slice(-6);
  return `rd-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${n}`;
}

/** The form's fields as stored raid fields, with defaults (FR-007). */
export function raidFields(input: RaidInput, now: Date) {
  return {
    name: input.name,
    ...(input.tagline ? { tagline: input.tagline } : {}),
    startsAt: input.startNow ? now.toISOString() : new Date(input.startsAt!).toISOString(),
    endsAt: new Date(input.endsAt).toISOString(),
    targetKg: input.targetKg,
    filter: input.filter && (input.filter.groups.length || input.filter.exerciseIds.length) ? input.filter : null,
    capPct: input.capPct ?? RAID_LIMITS.capDefault,
    lateJoiners: input.lateJoiners ?? true,
    showContributors: input.showContributors ?? true,
    stickerId: input.stickerId ?? "raid_cleared",
    draft: input.draft ?? false,
  } satisfies Partial<Raid>;
}

export const ruleError = (issues: readonly RaidIssue[]) =>
  apiError(409, "RAID_RULE", issues[0]!.message, Object.fromEntries(issues.map((i) => [i.field, i.message])));

export const STALE_RAID = "Someone else changed this raid; reload";

/**
 * A raid that starts now counts the whole start day (spec edge case), so every member's sets logged earlier that day
 * are counted at once by the normal rebuild. Scheduled raids start at 00:00, so they need no recount.
 */
export async function recountMembers(deps: Deps): Promise<void> {
  const members = await deps.profiles.listCommunity();
  for (const p of members) await safeRefresh(p.userId, deps);
}

export const listSquadRaids = (deps: Pick<Deps, "raids">) => deps.raids.listRaids(SQUAD_ID);
