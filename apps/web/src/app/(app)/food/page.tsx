import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CoachNoteResponseSchema, DateSchema, FoodDayViewSchema, OwnFoodsResponseSchema, RecentFoodsResponseSchema } from "@calci/shared";
import { CoachCard } from "@/components/coach-card";
import { DayNav } from "@/components/day-nav";
import { FoodScreen } from "@/components/food-screen";
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
  // The coach note is optional decoration: a failed fetch must never break the day screen.
  const notePromise = apiFetch(`/coach-note${query}`, { schema: CoachNoteResponseSchema }).catch(() => ({ note: null }));
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

  const { note } = await notePromise;

  return (
    <div className="flex flex-col gap-5 rounded-3xl bg-[#0F172A] p-4 text-slate-100 sm:p-6">
      <DayNav date={view.date} today={view.today} basePath="/food" />
      {note ? <CoachCard note={note} /> : null}
      <FoodScreen initialView={view} own={own.foods} recent={recent.foods} />
      <p className="text-sm">
        <Link href="/food/mine" className="text-lime-300 underline">
          My foods
        </Link>
      </p>
    </div>
  );
}

export default function FoodPage(props: PageProps<"/food">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <FoodContent searchParams={props.searchParams} />
    </Suspense>
  );
}
