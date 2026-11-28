import type { ReactionType } from "../contracts/squad-boards";

/** Feature 022: reaction notifications (data model: specs/022-reaction-notifications/data-model.md). Pure. */

export const NOTIFICATION_TTL_DAYS = 30;
export const NOTIFICATION_LIMIT = 50;

/** One per (item, reactor) on the owner's partition. */
export interface StoredNotification {
  eventId: string;
  reactorId: string;
  /** Reaction types the reactor currently has on the item (never empty). */
  types: ReactionType[];
  /** ISO time of the latest added reaction. */
  latestAt: string;
  /** Expiry, epoch seconds (latestAt + 30 days). */
  ttl: number;
}

export const notificationTtl = (latestAtIso: string) => Math.floor(Date.parse(latestAtIso) / 1000) + NOTIFICATION_TTL_DAYS * 86_400;

const live = (n: StoredNotification, nowSec: number) => n.ttl > nowSec;

/** Unread = newer than the time the owner last opened the list (no marker: all unread). */
export function unreadCount(items: readonly StoredNotification[], seenAt: string | null, nowSec: number): number {
  return items.filter((n) => live(n, nowSec) && (seenAt === null || n.latestAt > seenAt)).length;
}

/** Not expired, newest first, at most `limit`. */
export function pickNotifications(items: readonly StoredNotification[], nowSec: number, limit = NOTIFICATION_LIMIT): StoredNotification[] {
  return items
    .filter((n) => live(n, nowSec))
    .sort((a, b) => b.latestAt.localeCompare(a.latestAt))
    .slice(0, limit);
}

export interface ReactionRecord {
  type: ReactionType;
  reactorId: string;
  createdAt: string;
}

/**
 * "Who reacted" per type: the viewer first, then in reaction order. Reactors `isNamed` rejects (hidden members,
 * constitution VI) are only counted in `others`. The viewer is always named to themself.
 */
export function groupReactors(
  rx: readonly ReactionRecord[],
  viewerId: string,
  isNamed: (reactorId: string) => boolean,
): Record<ReactionType, { ids: string[]; others: number }> {
  const out: Record<ReactionType, { ids: string[]; others: number }> = { fire: { ids: [], others: 0 }, muscle: { ids: [], others: 0 }, crown: { ids: [], others: 0 } };
  const sorted = [...rx].sort((a, b) => (a.reactorId === viewerId ? -1 : b.reactorId === viewerId ? 1 : a.createdAt.localeCompare(b.createdAt)));
  for (const r of sorted) {
    if (r.reactorId === viewerId || isNamed(r.reactorId)) out[r.type].ids.push(r.reactorId);
    else out[r.type].others += 1;
  }
  return out;
}
