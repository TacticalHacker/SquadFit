import { localDate } from "./day";
import type { MuscleGroup } from "./gym";

/**
 * Feature 021 (squad volume raid). Pure rules; see specs/021-squad-volume-raid/research.md.
 * Status is derived from the clock (R1); counting runs in the stats rebuild (R2); totals are summed from contributions (R4).
 */

const DAY_MS = 86_400_000;
export const RAID_GRACE_MS = 12 * 3_600_000;
export const RAID_LIMITS = {
  nameMin: 3,
  nameMax: 40,
  taglineMax: 120,
  reasonMax: 120,
  targetMin: 1_000,
  targetMax: 10_000_000,
  capMin: 10,
  capMax: 100,
  capDefault: 40,
  maxDays: 31,
  leadDays: 90,
  maxScheduled: 3,
} as const;
/** How long a finished raid stays on the Squad tab card (FR-021). */
export const RAID_CARD_DAYS = 3;
export const RAID_CANCEL_CARD_DAYS = 1;
export const RAID_STICKERS = ["raid_cleared"] as const;
export type RaidStickerId = (typeof RAID_STICKERS)[number];
export const RAID_DEFAULT_NAME = "Squad Volume Raid";

export interface RaidFilter {
  groups: Exclude<MuscleGroup, "cardio">[];
  exerciseIds: string[];
}

export interface Raid {
  raidId: string;
  squadId: string;
  name: string;
  tagline?: string;
  startsAt: string;
  endsAt: string;
  targetKg: number;
  metric: "volume_kg";
  /** null = every strength exercise. */
  filter: RaidFilter | null;
  capPct: number;
  lateJoiners: boolean;
  showContributors: boolean;
  stickerId: RaidStickerId;
  draft: boolean;
  wonAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  /** Cache of the last summed total (history only; the card always sums contributions). */
  totalKg: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export type RaidStatus = "draft" | "scheduled" | "live" | "won" | "ended" | "cancelled";
export const FINAL_RAID_STATUSES: readonly RaidStatus[] = ["won", "ended", "cancelled"];

const ms = (iso: string) => Date.parse(iso);

export function raidStatus(r: Pick<Raid, "draft" | "startsAt" | "endsAt" | "wonAt" | "cancelledAt">, now: Date): RaidStatus {
  if (r.cancelledAt) return "cancelled";
  if (r.draft) return "draft";
  if (r.wonAt) return "won";
  const t = now.getTime();
  if (t < ms(r.startsAt)) return "scheduled";
  if (t < ms(r.endsAt)) return "live";
  return "ended";
}

/** Between the start and the end (won raids keep filling until the end). */
export const isInProgress = (r: Raid, now: Date) => !r.draft && !r.cancelledAt && now.getTime() >= ms(r.startsAt) && now.getTime() < ms(r.endsAt);

/** Contributions still change: started, not draft or cancelled, before end + 12 h (FR-004, research R3). */
export const isCounting = (r: Pick<Raid, "draft" | "cancelledAt" | "startsAt" | "endsAt">, now: Date) =>
  !r.draft && !r.cancelledAt && now.getTime() >= ms(r.startsAt) && now.getTime() < ms(r.endsAt) + RAID_GRACE_MS;

/** The raid's calendar days in the squad timezone: start date to the day before the end, inclusive. */
export function raidDays(r: Pick<Raid, "startsAt" | "endsAt">, timezone: string): { from: string; to: string } {
  return { from: localDate(new Date(r.startsAt), timezone), to: localDate(new Date(ms(r.endsAt) - 1), timezone) };
}

/** Wall-clock `date` + `time` ("HH:mm") in `timezone` as an ISO instant. */
export function zonedInstant(date: string, time: string, timezone: string): string {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const wall = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h, m);
  const offset = (t: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
        .formatToParts(new Date(t))
        .map((x) => [x.type, x.value]),
    );
    return Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!) - t;
  };
  let t = wall - offset(wall);
  t = wall - offset(t);
  return new Date(t).toISOString();
}

/** The form's default start: next Monday 00:00 in the squad timezone. */
export function nextMondayStart(now: Date, timezone: string): string {
  const today = localDate(now, timezone);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const add = ((8 - dow) % 7) || 7;
  const d = new Date(Date.parse(`${today}T00:00:00Z`) + add * DAY_MS).toISOString().slice(0, 10);
  return zonedInstant(d, "00:00", timezone);
}

// ---------------------------------------------------------------- counting

export interface RaidEntry {
  date: string;
  workoutId: string;
  kind?: "gym";
  exerciseKind?: "strength" | "cardio";
  muscleGroup?: MuscleGroup;
  sets?: readonly { reps: number; weightKg: number; completed: boolean }[];
}

export function inRaidFilter(filter: RaidFilter | null, e: Pick<RaidEntry, "workoutId" | "muscleGroup">): boolean {
  if (!filter) return true;
  return filter.exerciseIds.includes(e.workoutId) || (e.muscleGroup !== undefined && (filter.groups as readonly MuscleGroup[]).includes(e.muscleGroup));
}

/** Key of `held` (sets waiting for "Looks right"): `<date>|<exerciseId>` → set indexes. */
export const heldKey = (date: string, exerciseId: string) => `${date}|${exerciseId}`;

/**
 * FR-012–FR-014: Σ weight × reps of ticked strength sets with reps ≥ 1 on raid days that match the filter, minus sets
 * held as an unusual jump. 0 kg sets add 0 kg but still make the member a contributor.
 */
export function raidContribution(
  entries: readonly RaidEntry[],
  raid: Pick<Raid, "startsAt" | "endsAt" | "filter" | "lateJoiners">,
  ctx: { timezone: string; held: Readonly<Record<string, readonly number[]>>; memberCreatedAt: string },
): { rawKg: number; setCount: number; sessions: number } {
  if (!raid.lateJoiners && ms(ctx.memberCreatedAt) > ms(raid.startsAt)) return { rawKg: 0, setCount: 0, sessions: 0 };
  const { from, to } = raidDays(raid, ctx.timezone);
  let tenths = 0;
  let setCount = 0;
  const days = new Set<string>();
  for (const e of entries) {
    if (e.kind !== "gym" || e.exerciseKind === "cardio" || e.date < from || e.date > to || !inRaidFilter(raid.filter, e)) continue;
    const held = ctx.held[heldKey(e.date, e.workoutId)] ?? [];
    (e.sets ?? []).forEach((s, i) => {
      if (!s.completed || s.reps < 1 || held.includes(i)) return;
      tenths += s.reps * Math.round(s.weightKg * 10);
      setCount++;
      days.add(e.date);
    });
  }
  return { rawKg: tenths / 10, setCount, sessions: days.size };
}

export const capKg = (r: Pick<Raid, "targetKg" | "capPct">) => (r.targetKg * r.capPct) / 100;
export const countedKg = (rawKg: number, r: Pick<Raid, "targetKg" | "capPct">) => Math.min(rawKg, capKg(r));
export const raidTotal = (raws: readonly number[], r: Pick<Raid, "targetKg" | "capPct">) =>
  Math.round(raws.reduce((t, raw) => t + countedKg(raw, r), 0) * 10) / 10;
/**
 * The split bar: one segment per contributor with counted kg, in the order they first contributed (never by size, so
 * there is no #1). Members the viewer may not see merge into one trailing "others" segment. Capped kg is left out,
 * matching the total.
 */
export function raidSplit<C extends { userId: string; rawKg: number; setCount: number; sessions: number; firstCountedAt: string | null }>(
  contributions: readonly C[],
  raid: Pick<Raid, "targetKg" | "capPct">,
  isVisible: (userId: string) => boolean,
): { members: { contribution: C; kg: number }[]; othersKg: number } {
  const counted = contributions
    .filter((c) => c.setCount > 0 && c.rawKg > 0)
    .sort((a, b) => (a.firstCountedAt ?? "\uffff").localeCompare(b.firstCountedAt ?? "\uffff") || a.userId.localeCompare(b.userId));
  const members: { contribution: C; kg: number }[] = [];
  let others = 0;
  for (const c of counted) {
    const kg = countedKg(c.rawKg, raid);
    if (isVisible(c.userId)) members.push({ contribution: c, kg });
    else others += kg;
  }
  return { members, othersKg: Math.round(others * 10) / 10 };
}

/** Whole percent, floored so the bar never reads 100% before the win; may exceed 100. */
export const raidPct = (kg: number, targetKg: number) => (targetKg > 0 ? Math.floor((kg / targetKg) * 100) : 0);

/** Share of the raid's time passed (the pace tick), while it is in progress. */
export function raidPace(r: Raid, now: Date): number | null {
  if (!isInProgress(r, now)) return null;
  return Math.min(1, Math.max(0, (now.getTime() - ms(r.startsAt)) / (ms(r.endsAt) - ms(r.startsAt))));
}
export function raidDaysLeft(r: Raid, now: Date): number | null {
  return isInProgress(r, now) ? Math.ceil((ms(r.endsAt) - now.getTime()) / DAY_MS) : null;
}

// ---------------------------------------------------------------- card

/** R9: the raid on the Squad tab card, and the next scheduled one when the card shows another. */
export function pickRaidCard(raids: readonly Raid[], now: Date): { card: Raid | null; next: Raid | null } {
  const t = now.getTime();
  const visible = raids.filter((r) => !r.draft);
  const scheduled = visible.filter((r) => raidStatus(r, now) === "scheduled").sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const nextUp = scheduled[0] ?? null;
  const current = visible.find((r) => isInProgress(r, now));
  if (current) return { card: current, next: nextUp };
  const until = (r: Raid) => (r.cancelledAt ? ms(r.cancelledAt) + RAID_CANCEL_CARD_DAYS * DAY_MS : ms(r.endsAt) + RAID_CARD_DAYS * DAY_MS);
  const recent = visible
    .filter((r) => FINAL_RAID_STATUSES.includes(raidStatus(r, now)) && t < until(r))
    .sort((a, b) => until(b) - until(a))[0];
  if (recent) return { card: recent, next: nextUp };
  return { card: nextUp, next: null };
}

// ---------------------------------------------------------------- admin rules

export interface RaidIssue {
  field: string;
  message: string;
}

const kgText = (kg: number) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(kg)} kg`;

/**
 * FR-005, FR-007: date and slot rules for a create or an edit (`others` excludes the raid being edited).
 * Drafts hold no slot, so only their length is checked. Field limits are the schema's job.
 */
export function validateRaid(
  input: Pick<Raid, "name" | "startsAt" | "endsAt" | "draft">,
  others: readonly Raid[],
  now: Date,
  opts: { startLocked?: boolean } = {},
): RaidIssue[] {
  const s = ms(input.startsAt);
  const e = ms(input.endsAt);
  const t = now.getTime();
  if (!(e - s >= DAY_MS)) return [{ field: "endsAt", message: "A raid lasts at least 1 day" }];
  if (e - s > RAID_LIMITS.maxDays * DAY_MS) return [{ field: "endsAt", message: `A raid can last at most ${RAID_LIMITS.maxDays} days` }];
  if (!opts.startLocked) {
    if (s < t - 5 * 60_000) return [{ field: "startsAt", message: "Start can't be in the past" }];
    if (s > t + RAID_LIMITS.leadDays * DAY_MS) return [{ field: "startsAt", message: `Start can be at most ${RAID_LIMITS.leadDays} days ahead` }];
  }
  if (input.draft) return [];

  const active = others.filter((r) => !r.draft && !r.cancelledAt && t < ms(r.endsAt));
  if (s <= t) {
    const live = active.find((r) => isInProgress(r, now));
    if (live) return [{ field: "startsAt", message: `Another raid is live (${live.name})` }];
  }
  const clash = active.find((r) => s < ms(r.endsAt) && ms(r.startsAt) < e);
  if (clash) return [{ field: "startsAt", message: `Dates overlap ${clash.name}` }];
  if (s > t && active.filter((r) => raidStatus(r, now) === "scheduled").length >= RAID_LIMITS.maxScheduled) {
    return [{ field: "startsAt", message: `At most ${RAID_LIMITS.maxScheduled} raids can be scheduled` }];
  }
  return [];
}

const LOCKED_WHILE_LIVE = ["startsAt", "filter", "capPct", "lateJoiners", "stickerId", "draft"] as const;

/** FR-009: what an edit may change in the raid's current state. `totalKg` is the current counted total. */
export function lockedChanges(current: Raid, next: Raid, now: Date, totalKg: number): RaidIssue[] {
  const status = raidStatus(current, now);
  if (FINAL_RAID_STATUSES.includes(status)) return [{ field: "form", message: "This raid is finished and can't be changed" }];
  if (status !== "live") return [];
  const issues: RaidIssue[] = [];
  for (const f of LOCKED_WHILE_LIVE) {
    if (JSON.stringify(current[f] ?? null) !== JSON.stringify(next[f] ?? null)) issues.push({ field: f, message: "Locked while the raid is live" });
  }
  if (ms(next.endsAt) < now.getTime()) issues.push({ field: "endsAt", message: "End can't be earlier than now" });
  if (next.targetKg < totalKg) issues.push({ field: "targetKg", message: `Target can't be below current progress (${kgText(totalKg)})` });
  return issues;
}

/**
 * FR-008: average weekly volume over the history window, scaled to the raid's length, + 10%, rounded to 500 kg.
 * `historyDays` = days with history inside the 4-week window; null when the squad has no volume yet.
 */
export function suggestTarget(totalKg: number, historyDays: number, raidLengthDays: number): number | null {
  if (totalKg <= 0) return null;
  const weekly = totalKg / Math.max(1, Math.ceil(historyDays / 7));
  const v = Math.round((weekly * (raidLengthDays / 7) * 1.1) / 500) * 500;
  return Math.min(RAID_LIMITS.targetMax, Math.max(RAID_LIMITS.targetMin, v));
}
