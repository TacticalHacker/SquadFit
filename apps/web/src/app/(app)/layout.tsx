import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Bell } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { NavLinks } from "@/components/nav-links";
import { secondaryButtonClass } from "@/components/form-bits";
import { signOut } from "@/server/actions/auth";
import { NOTIFY_COPY, badgeCount } from "@/lib/plain";
import { getMe, requireProfile } from "@/server/session";
import type { OwnProfile } from "@calci/shared";

/** Header avatar: opens the member's own squad profile (history, PRs, timeline). */
function ProfileLink({ userId, profile }: { userId: string; profile: OwnProfile }) {
  const avatar = <Avatar displayName={profile.displayName} avatarUrl={profile.avatarUrl} size={32} />;
  if (!userId) return avatar;
  return (
    <Link href={`/squad/${userId}`} aria-label="Your profile" className="flex min-h-11 min-w-11 items-center justify-center rounded-full">
      {avatar}
    </Link>
  );
}

/** Feature 022: reactions to your items; the badge is the unread count from GET /me. */
function NotificationsLink({ unread }: { unread: number }) {
  return (
    <Link
      href="/notifications"
      aria-label={NOTIFY_COPY.bell(unread)}
      className="relative grid min-h-11 min-w-11 place-items-center rounded-md text-muted transition-colors duration-150 hover:text-ink active:bg-surface-2 active:duration-0"
    >
      <Bell aria-hidden size={20} strokeWidth={1.75} />
      {unread > 0 ? (
        <span aria-hidden className="absolute right-1 top-1 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 tabular-nums text-paper">
          {badgeCount(unread)}
        </span>
      ) : null}
    </Link>
  );
}

function SignOut() {
  return (
    <form action={signOut}>
      <button type="submit" className={`${secondaryButtonClass} px-3 text-sm`}>
        Sign out
      </button>
    </form>
  );
}

/** The session is read inside <Suspense>, never at the top level of the layout (Cache Components). */
async function Shell({ children }: { children: ReactNode }) {
  const { userId, profile } = await requireProfile();
  const { unreadNotifications } = await getMe();
  return (
    <>
      <header className="border-b border-line bg-paper">
        <nav aria-label="Main" className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/workouts/gym" className="text-lg font-semibold tracking-[-0.015em]">
              SquadFit
            </Link>
            <span className="flex items-center gap-3 sm:hidden">
              <NotificationsLink unread={unreadNotifications} />
              <ProfileLink userId={userId} profile={profile} />
              <SignOut />
            </span>
          </div>
          <NavLinks />
          <span className="ml-auto hidden items-center gap-3 sm:flex">
            <NotificationsLink unread={unreadNotifications} />
            <ProfileLink userId={userId} profile={profile} />
            <SignOut />
          </span>
        </nav>
      </header>
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">{children}</div>
    </>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted">Loading…</p>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
