import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { HallOfFameSchema, SquadBoardsSchema, SquadFeedSchema, WeightViewSchema } from "@calci/shared";
import { BoardCard } from "@/components/board-card";
import { BodyweightSquadCard } from "@/components/bodyweight-squad-card";
import { linkClass, noticeWarnClass } from "@/components/form-bits";
import { HallOfFame } from "@/components/hall-of-fame";
import { NutritionCard } from "@/components/nutrition-card";
import { SegmentLinks } from "@/components/segment-links";
import { SquadFeed } from "@/components/squad-feed";
import { TargetsPrompt } from "@/components/targets-prompt";
import { BOARD_GROUPS, monthName } from "@/lib/plain";
import { apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "Squad · SquadFit" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Feature 013: feed first, then one control ("This month | Hall of Fame"), then scannable board cards. No date picker,
 * period row, tab row or explanation paragraphs; Today's workouts and the full feed have their own pages.
 */
async function SquadContent({ searchParams }: { searchParams: PageProps<"/squad">["searchParams"] }) {
  const { profile } = await requireProfile();
  const fame = first((await searchParams).view) === "fame";

  const [data, feed, records, weight] = await Promise.all([
    apiFetch("/squad/boards", { schema: SquadBoardsSchema }),
    // The feed is secondary: a failed fetch must not take the boards down.
    apiFetch("/squad/feed?limit=5", { schema: SquadFeedSchema }).catch(() => null),
    fame ? apiFetch("/squad/hall-of-fame", { schema: HallOfFameSchema }) : Promise.resolve(null),
    // Feature 017: your own weigh-ins for the compact card; optional like the feed.
    apiFetch("/me/weight?range=M", { schema: WeightViewSchema }).catch(() => null),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-semibold tracking-[-0.02em]">Squad</h1>
      {data.viewer.targetsPrompt ? <TargetsPrompt calories={profile.dailyCalorieTarget} protein={profile.dailyProteinTarget} /> : null}
      {data.viewer.nutritionPrompt ? <NutritionCard /> : null}
      {data.viewer.hidden ? (
        <p className={noticeWarnClass}>
          You&apos;re hidden from the squad, so others can&apos;t see you. Change it in{" "}
          <Link href="/settings#squad" className={linkClass}>
            Settings
          </Link>
          .
        </p>
      ) : null}

      <section aria-labelledby="activity-heading" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="activity-heading" className="text-xl font-semibold">
            Latest
          </h2>
          <Link href="/squad/feed" className={`${linkClass} text-sm`}>
            See all
          </Link>
        </div>
        {feed ? <SquadFeed items={feed.items} /> : <p className="text-sm text-muted">Activity is unavailable right now.</p>}
        <Link href="/squad/today" className={`${linkClass} inline-flex min-h-11 items-center gap-1.5 self-start text-sm`}>
          See today&apos;s workouts
          <ArrowRight aria-hidden size={16} strokeWidth={1.75} />
        </Link>
      </section>

      {weight ? <BodyweightSquadCard initialView={weight} timezone={profile.timezone} /> : null}

      <SegmentLinks
        label="Boards view"
        options={[
          { label: "This month", href: "/squad", current: !fame },
          { label: "Hall of Fame", href: "/squad?view=fame", current: fame },
        ]}
      />

      {fame && records ? (
        <HallOfFame data={records} />
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted">{monthName(data.month)} · resets on the 1st</p>
          {BOARD_GROUPS.map((g) => {
            const boards = data.boards.filter((b) => (g.boards as readonly string[]).includes(b.id));
            if (boards.length === 0) return null;
            return (
              <section key={g.id} aria-labelledby={`group-${g.id}`} className="flex flex-col gap-3">
                <h2 id={`group-${g.id}`} className="text-xl font-semibold">
                  {g.title}
                </h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {boards.map((b) => (
                    <BoardCard key={b.id} board={b} hidden={data.viewer.hidden} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
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
