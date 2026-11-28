import { Suspense } from "react";
import { NotificationsSchema } from "@calci/shared";
import { NotificationList } from "@/components/notification-list";
import { NOTIFY_COPY } from "@/lib/plain";
import { apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "Notifications · SquadFit" };

async function NotificationsContent() {
  await requireProfile();
  const data = await apiFetch("/me/notifications", { schema: NotificationsSchema });
  return <NotificationList data={data} now={new Date().toISOString()} />;
}

/** Feature 022: reactions to the member's items, newest first. Opening the page marks them read. */
export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold tracking-[-0.02em]">{NOTIFY_COPY.title}</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <NotificationsContent />
      </Suspense>
    </div>
  );
}
