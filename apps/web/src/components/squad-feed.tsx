import Link from "next/link";
import { Trophy } from "lucide-react";
import type { FeedWorkout, SquadFeedItem } from "@calci/shared";
import { NEW_PB, exercisesCount, feedLine, liftsImproved, minutes, moreRows, sharePrValue, shareRowValue, shortDate } from "@/lib/plain";
import { Avatar } from "./avatar";
import { Reactions } from "./reactions";

/** Feature 016: a workout day a member posted, figures computed on read (no steps, streak or calories). */
function WorkoutPost({ w }: { w: FeedWorkout }) {
  const headline = [w.durationMin > 0 ? minutes(w.durationMin) : null, exercisesCount(w.exerciseCount), w.liftsImproved > 0 ? liftsImproved(w.liftsImproved) : null].filter(Boolean).join(" · ");
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-line bg-paper p-3">
      {w.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived presigned S3 URL; next/image can't optimise it
        <img src={w.photoUrl} alt="Workout photo" className="max-h-80 w-full rounded-md object-cover" />
      ) : null}
      {w.label ? <p className="text-sm font-semibold text-ink">{w.label}</p> : null}
      <p className="text-sm tabular-nums text-muted">{headline}</p>
      <ul className="flex flex-col gap-1 text-sm">
        {w.rows.map((r, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="min-w-0 truncate text-ink">{r.name}</span>
            <span className="shrink-0 tabular-nums text-muted">{shareRowValue(r)}</span>
          </li>
        ))}
        {w.moreCount > 0 ? <li className="text-xs text-muted">{moreRows(w.moreCount)}</li> : null}
      </ul>
      {w.prs.length ? (
        <ul aria-label={NEW_PB} className="flex flex-col gap-1 text-sm">
          {w.prs.map((p) => (
            <li key={p.exerciseId} className="flex items-center gap-1.5 text-accent">
              <Trophy aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />
              <span className="min-w-0 truncate">
                {NEW_PB} · {p.name} {sharePrValue(p)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

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
              {i.workout ? <WorkoutPost w={i.workout} /> : null}
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
