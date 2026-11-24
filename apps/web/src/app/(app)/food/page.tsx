import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DateSchema, FoodDayViewSchema, OwnFoodsResponseSchema, RecentFoodsResponseSchema, WeightViewSchema } from "@calci/shared";
import { BodyweightCard } from "@/components/bodyweight-card";
import { DayNav } from "@/components/day-nav";
import { FoodScreen } from "@/components/food-screen";
import { linkClass } from "@/components/form-bits";
import { TargetsPrompt } from "@/components/targets-prompt";
import { ApiRequestError, apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "Food · SquadFit" };

/** Feature 014: the member's own weigh-ins (ranges always end today, whatever day the page shows). */
async function BodyweightSection() {
  const { profile } = await requireProfile();
  const view = await apiFetch("/me/weight?range=M", { schema: WeightViewSchema });
  return <BodyweightCard initialView={view} timezone={profile.timezone} />;
}

async function FoodContent({ searchParams }: { searchParams: PageProps<"/food">["searchParams"] }) {
  const { profile } = await requireProfile();
  const params = await searchParams;
  const raw = Array.isArray(params.date) ? params.date[0] : params.date;
  if (raw !== undefined && !DateSchema.safeParse(raw).success) redirect("/food");

  // A future date is rejected by the API (400, from the server's own "today"); fall back to today (FR-016).
  const query = raw ? `?date=${raw}` : "";
  const view = await apiFetch(`/food${query}`, { schema: FoodDayViewSchema }).catch((err: unknown) => {
    if (raw && err instanceof ApiRequestError && err.status === 400) redirect("/food");
    throw err;
  });
  // Lists are only needed to add food, which read-only days do not allow.
  const [recent, own] = view.editable
    ? await Promise.all([
        apiFetch("/food/recent", { schema: RecentFoodsResponseSchema }),
        apiFetch("/food/foods", { schema: OwnFoodsResponseSchema }),
      ])
    : [{ foods: [] }, { foods: [] }];

  return (
    <div className="flex flex-col gap-6">
      {!profile.targetsConfirmed && !profile.targetsPromptDismissed ? (
        <TargetsPrompt calories={profile.dailyCalorieTarget} protein={profile.dailyProteinTarget} />
      ) : null}
      <DayNav date={view.date} today={view.today} basePath="/food" />
      <FoodScreen
        initialView={view}
        own={own.foods}
        recent={recent.foods}
        afterLedger={
          <Suspense fallback={<p className="text-sm text-muted">Loading bodyweight…</p>}>
            <BodyweightSection />
          </Suspense>
        }
      />
      <p className="text-sm">
        <Link href="/food/mine" className={linkClass}>
          My foods
        </Link>
      </p>
    </div>
  );
}

export default function FoodPage(props: PageProps<"/food">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <FoodContent searchParams={props.searchParams} />
    </Suspense>
  );
}
