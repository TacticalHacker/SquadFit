import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DateSchema, DayViewSchema, SummaryRangeResponseSchema, addDays } from "@calci/shared";
import { DayNav } from "@/components/day-nav";
import { DayStrip } from "@/components/day-strip";
import { WorkoutChecklist } from "@/components/workout-checklist";
import { ApiRequestError, apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "Workouts · SquadFit" };

async function WorkoutsContent({ searchParams }: { searchParams: PageProps<"/workouts">["searchParams"] }) {
  await requireProfile();
  const params = await searchParams;
  const raw = Array.isArray(params.date) ? params.date[0] : params.date;
  if (raw !== undefined && !DateSchema.safeParse(raw).success) redirect("/workouts");

  // A future date is rejected by the API (400, from the server's own "today"); fall back to today (FR-016).
  const query = raw ? `?date=${raw}` : "";
  const view = await apiFetch(`/workouts${query}`, { schema: DayViewSchema }).catch((err: unknown) => {
    if (raw && err instanceof ApiRequestError && err.status === 400) redirect("/workouts");
    throw err;
  });
  const strip = await apiFetch(`/workouts/summary?from=${addDays(view.date, -6)}&to=${view.date}`, {
    schema: SummaryRangeResponseSchema,
  });

  return (
    <div className="flex flex-col gap-6">
      <DayNav date={view.date} today={view.today} />
      <DayStrip days={strip.days} current={view.date} today={view.today} />
      <WorkoutChecklist initialView={view} />
      <p className="text-sm">
        <Link href="/workouts/mine" className="text-emerald-700 underline dark:text-emerald-400">
          My workouts
        </Link>
      </p>
    </div>
  );
}

export default function WorkoutsPage(props: PageProps<"/workouts">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <WorkoutsContent searchParams={props.searchParams} />
    </Suspense>
  );
}
