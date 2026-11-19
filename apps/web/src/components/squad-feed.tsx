import Link from "next/link";
import type { SquadFeedItem } from "@calci/shared";
import { feedLine, shortDate } from "@/lib/plain";
import { Avatar } from "./avatar";
import { Reactions } from "./reactions";

/** Squad activity in plain words, each with 🔥 💪 👑 reactions (feature 010; 013). */
export function SquadFeed({ items }: { items: SquadFeedItem[] }) {
  if (items.length === 0) {
    return <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">Nothing yet. Log a workout to get things going.</p>;
  }
  return (
    <ul aria-label="Squad activity" className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-card">
      {items.map((i) => (
        <li key={i.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Link href={`/squad/${i.member.userId}`} aria-label={`${i.member.displayName}'s profile`} className="shrink-0">
              <Avatar displayName={i.member.displayName} avatarUrl={i.member.avatarUrl} size={36} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">
                <Link href={`/squad/${i.member.userId}`} className="font-medium underline-offset-4 hover:underline">
                  {i.member.displayName}
                </Link>
                {feedLine(i)}
              </p>
              <p className="text-xs text-muted">{shortDate(i.date)}</p>
            </div>
          </div>
          <div className="flex justify-end pl-12 sm:pl-0">
            <Reactions id={i.id} reactions={i.reactions} canReact={i.canReact} />
          </div>
        </li>
      ))}
    </ul>
  );
}
