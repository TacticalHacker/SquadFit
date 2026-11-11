import { Suspense } from "react";
import { PeopleResponseSchema } from "@calci/shared";
import { Avatar } from "@/components/avatar";
import { apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "People · SquadFit" };

async function PeopleList() {
  await requireProfile(); // signed in + profile complete, otherwise redirects
  const { members } = await apiFetch("/people", { schema: PeopleResponseSchema });
  const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {members.map((m) => (
        <li key={m.userId} className="flex items-center gap-3 px-4 py-3">
          <Avatar displayName={m.displayName} avatarUrl={m.avatarUrl} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {m.displayName}
              {m.isYou ? (
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
                  You
                </span>
              ) : null}
            </p>
            <p className="text-sm text-zinc-500">Joined {fmt.format(new Date(m.joinedAt))}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function PeoplePage() {
  return (
    <>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">People</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <PeopleList />
      </Suspense>
    </>
  );
}
