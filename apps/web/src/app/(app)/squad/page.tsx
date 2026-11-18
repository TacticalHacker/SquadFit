import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DateSchema, PeriodSchema, SquadFeedSchema, SquadLeaderboardFullSchema, TodaySchema, addDays } from "@calci/shared";
import { noticeWarnClass, linkClass, segmentClass, segmentGroupClass } from "@/components/form-bits";
import { NutritionCard } from "@/components/nutrition-card";
import { BOARDS, Board, BoardTabs, PeriodToggle, squadHref, type BoardId, type BoardQuery } from "@/components/squad-boards";
import { SquadFeed } from "@/components/squad-feed";
import { TodayWorkouts } from "@/components/today-workouts";
import { apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "Squad · SquadFit" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const dayName = (d: string) => new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

async function SquadContent({ searchParams }: { searchParams: PageProps<"/squad">["searchParams"] }) {
  await requireProfile();
  const params = await searchParams;
  const boardRaw = first(params.board);
  const dateRaw = DateSchema.safeParse(first(params.date));
  const query: BoardQuery = {
    board: (BOARDS as readonly string[]).includes(boardRaw ?? "") ? (boardRaw as BoardId) : "streaks",
    period: PeriodSchema.catch("week").parse(first(params.period)),
    exercise: first(params.exercise),
    relative: first(params.rel) === "1",
    view: first(params.view) === "today" ? "today" : "boards",
    date: dateRaw.success ? dateRaw.data : undefined,
  };
  // Nutrition and Steps have no all-time view; show "This week" selected instead of nothing.
  if ((query.board === "nutrition" || query.board === "steps") && query.period === "all") query.period = "week";
  const q = new URLSearchParams({ period: query.period });
  if (query.exercise) q.set("exercise", query.exercise);
  if (query.date) q.set("date", query.date);

  const [data, feed, today] = await Promise.all([
    apiFetch(`/squad/leaderboard?${q}`, { schema: SquadLeaderboardFullSchema }),
    // The feed is secondary: a failed fetch must not take the boards down.
    apiFetch("/squad/feed", { schema: SquadFeedSchema }).catch(() => null),
    query.view === "today" ? apiFetch(`/squad/today${query.date ? `?date=${query.date}` : ""}`, { schema: TodaySchema }) : Promise.resolve(null),
  ]);

  const selected = data.date;
  const prev = addDays(selected, -1);
  const canNext = selected < data.today;
  const canPrev = selected > addDays(data.today, -30);
  const link = (date: string) => squadHref(query, { date: date === data.today ? undefined : date });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">Squad</h1>
        <p className="text-sm text-muted">Friendly competition. Weeks, not days.</p>
      </div>
      {data.viewer.nutritionPrompt ? <NutritionCard /> : null}
      {data.viewerHidden ? (
        <p className={noticeWarnClass}>
          You&apos;re hidden from the squad, so others can&apos;t see you. Change it in{" "}
          <Link href="/settings" className={linkClass}>
            Settings
          </Link>
          .
        </p>
      ) : null}
      <nav aria-label="View" className={`${segmentGroupClass} grid-cols-2`}>
        <Link href={squadHref(query, { view: "boards" })} aria-current={query.view === "boards" ? "page" : undefined} className={segmentClass(query.view === "boards")}>
          Boards
        </Link>
        <Link href={squadHref(query, { view: "today" })} aria-current={query.view === "today" ? "page" : undefined} className={segmentClass(query.view === "today")}>
          Today&apos;s workouts
        </Link>
      </nav>
      <nav aria-label="Day" className="flex items-center justify-between gap-2">
        {canPrev ? (
          <Link href={link(prev)} aria-label="Previous day" className="grid min-h-11 min-w-11 place-items-center rounded-md bg-surface-2 text-ink active:bg-line">
            <ChevronLeft aria-hidden size={18} strokeWidth={1.75} />
          </Link>
        ) : (
          <span className="min-w-11" />
        )}
        <p className="text-sm font-medium tabular-nums text-ink">{selected === data.today ? `Today · ${dayName(selected)}` : dayName(selected)}</p>
        {canNext ? (
          <Link href={link(addDays(selected, 1))} aria-label="Next day" className="grid min-h-11 min-w-11 place-items-center rounded-md bg-surface-2 text-ink active:bg-line">
            <ChevronRight aria-hidden size={18} strokeWidth={1.75} />
          </Link>
        ) : (
          <span className="min-w-11" />
        )}
      </nav>
      {query.view === "today" && today ? (
        <TodayWorkouts data={today} />
      ) : (
        <>
          <PeriodToggle query={query} />
          <BoardTabs query={query} />
          <Board data={data} query={query} />
        </>
      )}
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
