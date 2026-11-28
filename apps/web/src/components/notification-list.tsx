"use client";

import Link from "next/link";
import { useEffect } from "react";
import { UserRound } from "lucide-react";
import type { Notifications } from "@calci/shared";
import { markNotificationsSeen } from "@/server/actions/notifications";
import { NOTIFY_COPY, notificationHref, notificationLine, timeAgo } from "@/lib/plain";
import { Avatar } from "./avatar";

/**
 * Feature 022: "Asha reacted 💪 to your Bench press PR · 2 h ago". Unread rows carry a dot until the next visit;
 * opening the list marks everything shown as read (the header badge clears through `refresh()`).
 */
export function NotificationList({ data, now }: { data: Notifications; now: string }) {
  useEffect(() => {
    if (data.unreadCount > 0 && data.latestAt) void markNotificationsSeen(data.latestAt);
  }, [data.unreadCount, data.latestAt]);

  if (data.items.length === 0) {
    return <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">{NOTIFY_COPY.empty}</p>;
  }
  const at = new Date(now);
  return (
    <ul aria-label={NOTIFY_COPY.title} className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-card">
      {data.items.map((n) => (
        <li key={n.id}>
          <Link
            href={notificationHref(n.item)}
            className={`flex min-h-14 items-center gap-3 px-3 py-3 transition-colors duration-150 hover:bg-surface-2 active:bg-line active:duration-0`}
          >
            {n.reactor ? (
              <Avatar displayName={n.reactor.displayName} avatarUrl={n.reactor.avatarUrl} size={36} />
            ) : (
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
                <UserRound size={18} strokeWidth={1.75} />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink">
                <span className="font-medium">{n.reactor?.displayName ?? NOTIFY_COPY.someone}</span>
                {notificationLine(n)}
              </span>
              <span className="block text-xs text-muted">{timeAgo(n.at, at)}</span>
            </span>
            {n.unread ? (
              <span className="size-2 shrink-0 rounded-full bg-accent">
                <span className="sr-only">{NOTIFY_COPY.unread}</span>
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
