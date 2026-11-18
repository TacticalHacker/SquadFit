import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DateSchema, FoodDayViewSchema, OwnFoodsResponseSchema, RecentFoodsResponseSchema } from "@calci/shared";
import { DayNav } from "@/components/day-nav";
import { FoodScreen } from "@/components/food-screen";
import { linkClass } from "@/components/form-bits";
import { ApiRequestError, apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "Food · SquadFit" };

async function FoodContent({ searchParams }: { searchParams: PageProps<"/food">["searchParams"] }) {
  await requireProfile();
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
      <DayNav date={view.date} today={view.today} basePath="/food" />
      <FoodScreen initialView={view} own={own.foods} recent={recent.foods} />
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
