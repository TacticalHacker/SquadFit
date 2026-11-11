import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { secondaryButtonClass } from "@/components/form-bits";
import { signOut } from "@/server/actions/auth";
import { requireProfile } from "@/server/session";

/** The session is read inside <Suspense>, never at the top level of the layout (Cache Components). */
async function Shell({ children }: { children: ReactNode }) {
  const { profile } = await requireProfile();
  const link = "rounded px-2 py-1 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:hover:bg-zinc-800";
  return (
    <>
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <nav aria-label="Main" className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Link href="/" className="mr-2 font-semibold">
            SquadFit
          </Link>
          <Link href="/people" className={link}>
            People
          </Link>
          <Link href="/settings" className={link}>
            Settings
          </Link>
          <span className="ml-auto flex items-center gap-3">
            <Avatar displayName={profile.displayName} avatarUrl={profile.avatarUrl} size={32} />
            <form action={signOut}>
              <button type="submit" className={`${secondaryButtonClass} px-3 py-1 text-sm`}>
                Sign out
              </button>
            </form>
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
