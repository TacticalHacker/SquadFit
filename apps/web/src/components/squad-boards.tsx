import Link from "next/link";
import type { SquadLeaderboardFull } from "@calci/shared";
import { segmentClass, segmentGroupClass, secondaryButtonClass, inputClass } from "./form-bits";
import { BoardList, BoardRow, EmptyBoard } from "./board-row";

export const BOARDS = ["streaks", "prs", "consistency", "lifts", "nutrition"] as const;
export type BoardId = (typeof BOARDS)[number];
const LABELS: Record<BoardId, string> = { streaks: "Streaks", prs: "PRs", consistency: "Consistency", lifts: "Lifts", nutrition: "Nutrition" };

const nf = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const shortDate = (d: string) =>
  new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const PERIOD_WORDS = { week: "this week", "30d": "in the last 30 days", all: "yet" } as const;

export interface BoardQuery {
  board: BoardId;
  period: SquadLeaderboardFull["period"];
  exercise: string | undefined;
  relative: boolean;
  /** "today" = everyone's full workout for the day as cards (feature 011). */
  view: "boards" | "today";
  /** The selected day (YYYY-MM-DD); undefined = today. */
  date: string | undefined;
}

/** Keeps the other choices when one changes (tabs, period, exercise are all plain links, so no client state). */
export function squadHref(q: BoardQuery, change: Partial<BoardQuery>): string {
  const n = { ...q, ...change };
  const p = new URLSearchParams();
  if (n.board !== "streaks") p.set("board", n.board);
  if (n.period !== "week") p.set("period", n.period);
  if (n.exercise) p.set("exercise", n.exercise);
  if (n.relative) p.set("rel", "1");
  if (n.view === "today") p.set("view", "today");
  if (n.date) p.set("date", n.date);
  const s = p.toString();
  return s ? `/squad?${s}` : "/squad";
}

export function PeriodToggle({ query }: { query: BoardQuery }) {
  const all = [
    ["week", "This week"],
    ["30d", "Last 30 days"],
    ["all", "All time"],
  ] as const;
  // The Nutrition board has no all-time view (feature 011, FR-036).
  const items = query.board === "nutrition" ? all.slice(0, 2) : all;
  return (
    <nav aria-label="Period" className={`${segmentGroupClass} ${items.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
      {items.map(([id, label]) => (
        <Link key={id} href={squadHref(query, { period: id })} aria-current={query.period === id ? "true" : undefined} className={segmentClass(query.period === id)}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function BoardTabs({ query }: { query: BoardQuery }) {
  return (
    <nav aria-label="Boards" className={`${segmentGroupClass} grid-cols-2 sm:grid-cols-4`}>
      {BOARDS.map((id) => (
        <Link key={id} href={squadHref(query, { board: id })} aria-current={query.board === id ? "page" : undefined} className={segmentClass(query.board === id)}>
          {LABELS[id]}
        </Link>
      ))}
    </nav>
  );
}

/** The selected board. Streaks and Consistency do not depend on the period, and say so. */
export function Board({ data, query }: { data: SquadLeaderboardFull; query: BoardQuery }) {
  if (query.board === "nutrition") return <NutritionBoard data={data} />;
  if (query.board === "streaks") return <Streaks data={data} />;
  if (query.board === "prs") return <Prs data={data} query={query} />;
  if (query.board === "consistency") return <Consistency data={data} />;
  return <Lifts data={data} query={query} />;
}

const Note = ({ children }: { children: string }) => <p className="text-xs text-muted">{children}</p>;

/** Expansion data for a row: the selected day, whether the member trained and their compact nutrition line. */
const dayFor = (data: SquadLeaderboardFull, userId: string) => {
  const nutrition = data.nutritionToday.find((n) => n.userId === userId)?.nutrition;
  return { date: data.date, trained: data.trainedOn.includes(userId), isToday: data.date === data.today, ...(nutrition ? { nutrition } : {}) };
};

function Streaks({ data }: { data: SquadLeaderboardFull }) {
  if (data.streaks.length === 0) return <EmptyBoard>No workouts logged yet. The first session starts the streak.</EmptyBoard>;
  return (
    <div className="flex flex-col gap-2">
      <Note>Big number: workout days this week against the weekly target. A streak is how many weeks in a row someone hit that target; “best” is their longest run ever. Ranked by streak, then best, then days this week. Not affected by the period.</Note>
      <BoardList label="Streaks">
        {data.streaks.map((r) => {
          const pct = Math.min(100, Math.round((r.week.days / Math.max(1, r.week.target)) * 100));
          return (
            <BoardRow
              key={r.member.userId}
              rank={r.rank}
              member={r.member}
              main={r.week.days}
              unit={`/ ${r.week.target} days`}
              secondary={`${r.current}-week streak · best ${r.best}`}
              day={dayFor(data, r.member.userId)}
              below={
                <div
                  role="img"
                  aria-label={`${r.week.days} of ${r.week.target} workouts this week`}
                  className="mt-1.5 h-1 overflow-hidden rounded-full bg-line"
                >
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              }
            />
          );
        })}
      </BoardList>
    </div>
  );
}

function Prs({ data, query }: { data: SquadLeaderboardFull; query: BoardQuery }) {
  if (data.prs.length === 0) return <EmptyBoard>No PRs {PERIOD_WORDS[query.period]}. Go lift something heavy.</EmptyBoard>;
  return (
    <div className="flex flex-col gap-2">
      <Note>A PR (personal record) is a lift that beats your own previous best on that exercise. Tap a row to see them.</Note>
    <BoardList label="Personal records">
      {data.prs.map((r) => (
        <BoardRow
          key={r.member.userId}
          rank={r.rank}
          member={r.member}
          main={r.count}
          unit={r.count === 1 ? "PR" : "PRs"}
          secondary={r.lifts[0] ? `${r.lifts[0].exerciseName} ${nf.format(r.lifts[0].weightKg)} kg × ${r.lifts[0].reps}` : undefined}
          day={dayFor(data, r.member.userId)}
          expand={
            <ul className="flex flex-col gap-1.5 text-sm">
              {r.lifts.map((l) => (
                <li key={`${l.exerciseName}-${l.date}`} className="flex flex-wrap justify-between gap-x-3 text-muted">
                  <span className="text-ink">{l.exerciseName}</span>
                  <span className="tabular-nums">
                    {nf.format(l.weightKg)} kg × {l.reps}
                    {l.e1rm !== null ? ` · e1RM ${nf.format(l.e1rm)} kg` : ""} · {shortDate(l.date)}
                  </span>
                </li>
              ))}
            </ul>
          }
        />
      ))}
    </BoardList>
    </div>
  );
}

function Consistency({ data }: { data: SquadLeaderboardFull }) {
  if (data.consistency.every((r) => r.percent === null)) {
    return <EmptyBoard>Consistency shows after your first full week.</EmptyBoard>;
  }
  return (
    <div className="flex flex-col gap-2">
      <Note>Share of the last 4 full weeks that reached the weekly workout target. “kg lifted” is weight × reps added up for this week. Not affected by the period.</Note>
      <BoardList label="Consistency">
        {data.consistency.map((r) => (
          <BoardRow
            key={r.member.userId}
            rank={r.percent === null ? null : r.rank}
            member={r.member}
            main={r.percent === null ? "—" : r.percent}
            unit={r.percent === null ? undefined : "%"}
            secondary={`${r.weekDays}/${r.target} this week · ${nf.format(r.weekVolumeKg)} kg lifted`}
            day={dayFor(data, r.member.userId)}
          />
        ))}
      </BoardList>
    </div>
  );
}

function Lifts({ data, query }: { data: SquadLeaderboardFull; query: BoardQuery }) {
  const { lift } = data;
  const rows = query.relative
    ? [...lift.rows].sort((a, b) => (a.relativeRank ?? 1e9) - (b.relativeRank ?? 1e9) || a.member.displayName.localeCompare(b.member.displayName))
    : lift.rows;
  return (
    <div className="flex flex-col gap-3">
      <form method="get" action="/squad" className="flex items-center gap-2">
        <input type="hidden" name="board" value="lifts" />
        {query.period !== "week" ? <input type="hidden" name="period" value={query.period} /> : null}
        {query.relative ? <input type="hidden" name="rel" value="1" /> : null}
        <label htmlFor="lift-exercise" className="sr-only">
          Exercise
        </label>
        <select id="lift-exercise" name="exercise" defaultValue={lift.exerciseId} className={`${inputClass} min-w-0 flex-1`}>
          {lift.options.map((o) => (
            <option key={o.exerciseId} value={o.exerciseId}>
              {o.name}
            </option>
          ))}
        </select>
        <button type="submit" className={secondaryButtonClass}>
          Show
        </button>
      </form>

      <nav aria-label="Lift measure" className={`${segmentGroupClass} grid-cols-2`}>
        <Link href={squadHref(query, { relative: false })} aria-current={!query.relative ? "true" : undefined} className={segmentClass(!query.relative)}>
          Absolute
        </Link>
        <Link href={squadHref(query, { relative: true })} aria-current={query.relative ? "true" : undefined} className={segmentClass(query.relative)}>
          Relative
        </Link>
      </nav>
      {query.relative ? (
        <Note>
          Estimated 1-rep max (e1RM) ÷ body weight. 1.0× means lifting your own body weight once; higher is stronger for your size. Only members who share
          their body weight are ranked.
        </Note>
      ) : (
        <Note>
          e1RM = estimated 1-rep max: the heaviest weight you could lift once, worked out from a set of 1–10 reps. It lets 60 kg × 8 be compared fairly with
          80 kg × 3.
        </Note>
      )}

      {rows.length === 0 ? (
        <EmptyBoard>
          Nobody has logged {lift.exerciseName} {query.period === "all" ? "yet" : PERIOD_WORDS[query.period]}.
        </EmptyBoard>
      ) : (
        <BoardList label={`${lift.exerciseName} estimated one-rep max`}>
          {rows.map((r) =>
            query.relative ? (
              <BoardRow
                key={r.member.userId}
                rank={r.relativeRank}
                member={r.member}
                main={r.relative === null ? "—" : r.relative.toFixed(2)}
                unit={r.relative === null ? undefined : "×"}
                secondary={r.relative === null ? "Not sharing body weight" : `e1RM ${nf.format(r.e1rm)} kg`}
                day={dayFor(data, r.member.userId)}
              />
            ) : (
              <BoardRow
                key={r.member.userId}
                rank={r.rank}
                member={r.member}
                main={nf.format(r.e1rm)}
                unit="kg"
                secondary={`${nf.format(r.weightKg)} kg × ${r.reps}`}
                day={dayFor(data, r.member.userId)}
              />
            ),
          )}
        </BoardList>
      )}
    </div>
  );
}

/** Ranked only on days the member hit their own protein target. Calories in and burned are information, never a rank. */
function NutritionBoard({ data }: { data: SquadLeaderboardFull }) {
  const { rows, viewer } = data.nutrition;
  return (
    <div className="flex flex-col gap-2">
      <Note>Ranked on how many days each member hit their own protein target. Everyone has a different target, so this is fair. Only members who share their nutrition appear.</Note>
      {viewer.level !== "off" && viewer.needsTarget ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-ink">
          Set a protein target in{" "}
          <Link href="/settings" className="text-accent underline underline-offset-4">
            Settings
          </Link>{" "}
          to be ranked.
        </p>
      ) : null}
      {viewer.level === "off" ? (
        <p className="rounded-md border border-line bg-surface-2 px-4 py-2 text-sm text-muted">
          You&apos;re not sharing your nutrition, so you&apos;re not on this board.{" "}
          <Link href="/settings#squad" className="text-accent underline underline-offset-4">
            Sharing settings
          </Link>
        </p>
      ) : null}
      {rows.length === 0 ? (
        <EmptyBoard>Nobody has shared their nutrition and set a protein target yet.</EmptyBoard>
      ) : (
        <BoardList label="Protein target days">
          {rows.map((r) => (
            <BoardRow
              key={r.member.userId}
              rank={r.rank}
              member={r.member}
              main={r.hitDays}
              unit={`/ ${r.periodDays} days`}
              secondary={`Hit their protein target · logged ${r.daysLogged} ${r.daysLogged === 1 ? "day" : "days"}`}
            />
          ))}
        </BoardList>
      )}
    </div>
  );
}
