import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { NavLinks } from "@/components/nav-links";
import { secondaryButtonClass } from "@/components/form-bits";
import { signOut } from "@/server/actions/auth";
import { requireProfile } from "@/server/session";

function SignOut() {
  return (
    <form action={signOut}>
      <button type="submit" className={`${secondaryButtonClass} px-3 py-1 text-sm`}>
        Sign out
      </button>
    </form>
  );
}

/** The session is read inside <Suspense>, never at the top level of the layout (Cache Components). */
async function Shell({ children }: { children: ReactNode }) {
  const { profile } = await requireProfile();
  return (
    <>
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <nav aria-label="Main" className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/workouts/gym" className="text-lg font-bold tracking-tight">
              SquadFit
            </Link>
            <span className="flex items-center gap-3 sm:hidden">
              <Avatar displayName={profile.displayName} avatarUrl={profile.avatarUrl} size={32} />
              <SignOut />
            </span>
          </div>
          <NavLinks />
          <span className="ml-auto hidden items-center gap-3 sm:flex">
            <Avatar displayName={profile.displayName} avatarUrl={profile.avatarUrl} size={32} />
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
    <Suspense fallback={<p className="p-4 text-sm text-zinc-500">Loading…</p>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
