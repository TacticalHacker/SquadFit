import { z } from "zod";
import { MuscleGroupSchema } from "../domain/gym";
import { RAID_LIMITS, RAID_STICKERS } from "../domain/raid";

/** Feature 021: squad volume raids. See specs/021-squad-volume-raid/contracts/raids.md. */

const Iso = z.iso.datetime({ offset: true });
export const RaidStatusSchema = z.enum(["draft", "scheduled", "live", "won", "ended", "cancelled"]);
export const RaidFilterSchema = z.strictObject({
  groups: z.array(MuscleGroupSchema.exclude(["cardio"])).max(6),
  exerciseIds: z.array(z.string().min(1).max(80)).max(100),
});

const nameMessage = `Name must be ${RAID_LIMITS.nameMin}–${RAID_LIMITS.nameMax} characters`;
const targetMessage = `Target must be ${RAID_LIMITS.targetMin.toLocaleString("en-US")}–${RAID_LIMITS.targetMax.toLocaleString("en-US")} kg`;
const capMessage = `Cap must be ${RAID_LIMITS.capMin}–${RAID_LIMITS.capMax}%`;

/** Body of POST /admin/raids. `startNow` uses the server clock instead of `startsAt`. */
const RaidFields = z.strictObject({
  name: z.string().trim().min(RAID_LIMITS.nameMin, nameMessage).max(RAID_LIMITS.nameMax, nameMessage),
    tagline: z.string().trim().max(RAID_LIMITS.taglineMax, `Tagline is at most ${RAID_LIMITS.taglineMax} characters`).optional(),
    startNow: z.boolean().optional(),
    startsAt: Iso.optional(),
    endsAt: Iso,
    targetKg: z.number({ error: targetMessage }).int(targetMessage).min(RAID_LIMITS.targetMin, targetMessage).max(RAID_LIMITS.targetMax, targetMessage),
    filter: RaidFilterSchema.nullable().optional(),
    capPct: z.number({ error: capMessage }).int(capMessage).min(RAID_LIMITS.capMin, capMessage).max(RAID_LIMITS.capMax, capMessage).optional(),
    lateJoiners: z.boolean().optional(),
    showContributors: z.boolean().optional(),
    stickerId: z.enum(RAID_STICKERS).optional(),
    draft: z.boolean().optional(),
});
const hasStart = (r: { startNow?: boolean | undefined; startsAt?: string | undefined }) => r.startNow === true || r.startsAt !== undefined;
export const RaidInputSchema = RaidFields.refine(hasStart, { message: "Choose a start", path: ["startsAt"] });
export type RaidInput = z.infer<typeof RaidInputSchema>;

/** Body of PUT /admin/raids/{raidId}: the whole form plus the version it was based on. */
export const RaidUpdateSchema = RaidFields.extend({ expectedUpdatedAt: z.string().min(1) }).refine(hasStart, { message: "Choose a start", path: ["startsAt"] });
export type RaidUpdate = z.infer<typeof RaidUpdateSchema>;

export const RaidCancelSchema = z.strictObject({
  reason: z.string().trim().max(RAID_LIMITS.reasonMax, `Reason is at most ${RAID_LIMITS.reasonMax} characters`).optional(),
  expectedUpdatedAt: z.string().min(1),
});

export const AdminRaidSchema = z.strictObject({
  raidId: z.string(),
  name: z.string(),
  tagline: z.string().nullable(),
  startsAt: Iso,
  endsAt: Iso,
  targetKg: z.number(),
  filter: RaidFilterSchema.nullable(),
  capPct: z.number().int(),
  lateJoiners: z.boolean(),
  showContributors: z.boolean(),
  stickerId: z.enum(RAID_STICKERS),
  draft: z.boolean(),
  status: RaidStatusSchema,
  totalKg: z.number(),
  wonAt: Iso.nullable(),
  cancelledAt: Iso.nullable(),
  cancelReason: z.string().nullable(),
  updatedAt: z.string(),
});
export type AdminRaid = z.infer<typeof AdminRaidSchema>;
export const AdminRaidResponseSchema = z.strictObject({ raid: AdminRaidSchema });
export const AdminRaidsResponseSchema = z.strictObject({ raids: z.array(AdminRaidSchema), timezone: z.string(), defaultStartsAt: Iso });
export type AdminRaidsResponse = z.infer<typeof AdminRaidsResponseSchema>;
export const RaidSuggestResponseSchema = z.strictObject({ suggestedKg: z.number().int().nullable() });

/**
 * One split-bar segment: a visible member's counted kg (after the cap) and sessions. Shares are never ranked: the
 * server orders them by first contribution (constitution VI 2.8.0).
 */
export const RaidSegmentSchema = z.strictObject({
  userId: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  kg: z.number(),
  sessions: z.number().int(),
  isYou: z.boolean(),
});
export type RaidSegment = z.infer<typeof RaidSegmentSchema>;
/** Hidden members' kg merged into one unnamed segment. */
export const RaidSplitSchema = z.strictObject({ segments: z.array(RaidSegmentSchema), othersKg: z.number() });
export type RaidSplit = z.infer<typeof RaidSplitSchema>;

export const RaidCardSchema = z.strictObject({
  raidId: z.string(),
  name: z.string(),
  tagline: z.string().nullable(),
  status: RaidStatusSchema.exclude(["draft"]),
  startsAt: Iso,
  endsAt: Iso,
  targetKg: z.number(),
  totalKg: z.number(),
  /** Whole percent; above 100 after a win. */
  pct: z.number().int(),
  pace: z.number().min(0).max(1).nullable(),
  daysLeft: z.number().int().nullable(),
  cancelReason: z.string().nullable(),
  /** The viewer's own figures; never sent about anyone else. */
  you: z.strictObject({ kg: z.number(), rawKg: z.number(), pct: z.number().int(), capped: z.boolean(), sticker: z.boolean() }),
  /** The split bar; null when "Show contributors" is off (one plain bar). */
  split: RaidSplitSchema.nullable(),
});
export type RaidCard = z.infer<typeof RaidCardSchema>;

export const RaidCardResponseSchema = z.strictObject({
  card: RaidCardSchema.nullable(),
  next: z.strictObject({ raidId: z.string(), name: z.string(), startsAt: Iso }).nullable(),
  canManage: z.boolean(),
  canCreate: z.boolean(),
});
export type RaidCardResponse = z.infer<typeof RaidCardResponseSchema>;

export const RaidHistoryResponseSchema = z.strictObject({
  raids: z.array(
    z.strictObject({
      raidId: z.string(),
      name: z.string(),
      startsAt: Iso,
      endsAt: Iso,
      status: z.enum(["won", "ended", "cancelled"]),
      targetKg: z.number(),
      totalKg: z.number(),
      pct: z.number().int(),
      /** Own counted kg, or null when the viewer had no counting set. */
      youKg: z.number().nullable(),
    }),
  ),
});
export type RaidHistoryResponse = z.infer<typeof RaidHistoryResponseSchema>;
