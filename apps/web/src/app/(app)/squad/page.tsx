import Link from "next/link";
import { Suspense } from "react";
import { PeriodSchema, SquadFeedSchema, SquadLeaderboardSchema } from "@calci/shared";
import { noticeWarnClass, linkClass } from "@/components/form-bits";
import { BOARDS, Board, BoardTabs, PeriodToggle, type BoardId, type BoardQuery } from "@/components/squad-boards";
import { SquadFeed } from "@/components/squad-feed";
import { apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "Squad · SquadFit" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function SquadContent({ searchParams }: { searchParams: PageProps<"/squad">["searchParams"] }) {
  await requireProfile();
  const params = await searchParams;
  const boardRaw = first(params.board);
  const query: BoardQuery = {
    board: (BOARDS as readonly string[]).includes(boardRaw ?? "") ? (boardRaw as BoardId) : "streaks",
    period: PeriodSchema.catch("week").parse(first(params.period)),
    exercise: first(params.exercise),
    relative: first(params.rel) === "1",
  };
  const q = new URLSearchParams({ period: query.period });
  if (query.exercise) q.set("exercise", query.exercise);

  const [data, feed] = await Promise.all([
    apiFetch(`/squad/leaderboard?${q}`, { schema: SquadLeaderboardSchema }),
    // The feed is secondary: a failed fetch must not take the boards down.
    apiFetch("/squad/feed", { schema: SquadFeedSchema }).catch(() => null),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">Squad</h1>
        <p className="text-sm text-muted">Friendly competition. Weeks, not days.</p>
      </div>
      {data.viewerHidden ? (
        <p className={noticeWarnClass}>
          You&apos;re hidden from the squad, so others can&apos;t see you. Change it in{" "}
          <Link href="/settings" className={linkClass}>
            Settings
          </Link>
          .
        </p>
      ) : null}
      <PeriodToggle query={query} />
      <BoardTabs query={query} />
      <Board data={data} query={query} />
      <section aria-labelledby="activity-heading" className="flex flex-col gap-3">
        <h2 id="activity-heading" className="text-xl font-semibold">
          Activity
        </h2>
        {feed ? <SquadFeed items={feed.items} /> : <p className="text-sm text-muted">Activity is unavailable right now.</p>}
      </section>
    </div>
  );
}

export default function SquadPage(props: PageProps<"/squad">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <SquadContent searchParams={props.searchParams} />
    </Suspense>
  );
}
