import {
  NotificationsSchema,
  ReactorsSchema,
  groupReactors,
  pickNotifications,
  unreadCount,
  type NotificationView,
  type Notifications,
  type ReactionType,
  type Reactors,
} from "@calci/shared";
import type { Deps } from "./deps";
import type { ProfileItem } from "./profile-repo";
import { feedId, type FeedKey } from "./squad-repo";
import { squadMember, visibleTo } from "./squad-view";

/**
 * Feature 022: reaction notifications and "who reacted". Never logs ids, names, types or contents (constitution VI).
 */

const nowSec = (deps: Deps) => Math.floor(deps.now().getTime() / 1000);

/** After a reaction is added or removed. Best effort: the reaction already succeeded, so this never throws. */
export async function safeNotify(deps: Deps, owner: FeedKey, reactorId: string, type: ReactionType, on: boolean): Promise<void> {
  try {
    if (on) await deps.squad.notify(owner, reactorId, type, deps.now().toISOString());
    else await deps.squad.unnotify(owner, reactorId, type);
  } catch (err) {
    console.error("notification write failed", err instanceof Error ? err.name : "unknown");
  }
}

/** The header badge (GET /me). Never fails the page: 0 on a read error. */
export async function unreadFor(ownerId: string, deps: Deps): Promise<number> {
  try {
    const { items, seenAt } = await deps.squad.listNotifications(ownerId);
    return unreadCount(items, seenAt, nowSec(deps));
  } catch (err) {
    console.error("notification count failed", err instanceof Error ? err.name : "unknown");
    return 0;
  }
}

/** A reactor is named to `viewerId` only while visible to them (hidden members never are, constitution VI). */
const named = (byId: Map<string, ProfileItem>, viewerId: string) => (id: string) => {
  const p = byId.get(id);
  return p !== undefined && visibleTo(p, viewerId);
};

/** GET /me/notifications: newest first, items whose feed item is gone dropped, described from the feed item. */
export async function notificationsView(ownerId: string, deps: Deps): Promise<Notifications> {
  const { items, seenAt } = await deps.squad.listNotifications(ownerId);
  const picked = pickNotifications(items, nowSec(deps));
  const [feed, community] = await Promise.all([deps.squad.batchGetFeed(picked.map((n) => ({ userId: ownerId, eventId: n.eventId }))), deps.profiles.listCommunity()]);
  const byEvent = new Map(feed.map((f) => [f.eventId, f]));
  const byId = new Map(community.map((p) => [p.userId, p]));
  const isNamed = named(byId, ownerId);

  const views: NotificationView[] = [];
  for (const n of picked) {
    const f = byEvent.get(n.eventId);
    if (!f) continue;
    const p = f.payload;
    views.push({
      id: `${n.eventId}~${n.reactorId}`,
      reactor: isNamed(n.reactorId) ? await squadMember(byId.get(n.reactorId)!, ownerId, deps.avatars) : null,
      types: (["fire", "muscle", "crown"] as const).filter((t) => n.types.includes(t)),
      item: {
        id: feedId(ownerId, n.eventId),
        ownerId,
        kind: f.kind,
        date: f.eventDate,
        exerciseName: f.kind === "pr" ? ((p.exerciseName as string | undefined) ?? null) : null,
        week: f.kind === "streak_week" ? ((p.week as number | undefined) ?? null) : null,
        club: f.kind === "badge" ? ((p.club as NotificationView["item"]["club"] | undefined) ?? null) : null,
      },
      at: n.latestAt,
      unread: seenAt === null || n.latestAt > seenAt,
    });
  }
  return NotificationsSchema.parse({ items: views, unreadCount: views.filter((v) => v.unread).length, latestAt: views[0]?.at ?? null });
}

/** GET /squad/feed/{id}/reactions: who reacted, per type; hidden reactors only counted. */
export async function reactorsView(author: FeedKey, viewerId: string, deps: Deps): Promise<Reactors> {
  const [rx, community] = await Promise.all([deps.squad.listReactors(author), deps.profiles.listCommunity()]);
  const byId = new Map(community.map((p) => [p.userId, p]));
  const groups = groupReactors(rx, viewerId, named(byId, viewerId));
  const one = async (type: ReactionType) => ({
    members: await Promise.all(groups[type].ids.filter((id) => byId.has(id)).map((id) => squadMember(byId.get(id)!, viewerId, deps.avatars))),
    others: groups[type].others + groups[type].ids.filter((id) => !byId.has(id)).length,
  });
  return ReactorsSchema.parse({ fire: await one("fire"), muscle: await one("muscle"), crown: await one("crown") });
}
