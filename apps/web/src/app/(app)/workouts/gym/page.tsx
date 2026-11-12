import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DateSchema, GymViewSchema, SummaryRangeResponseSchema, addDays, currentStreak } from "@calci/shared";
import { DayNav } from "@/components/day-nav";
import { DayStrip } from "@/components/day-strip";
import { GymScreen } from "@/components/gym-screen";
import { WorkoutsTabs } from "@/components/workouts-tabs";
import { ApiRequestError, apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "Gym · SquadFit" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function GymContent({ searchParams }: { searchParams: PageProps<"/workouts/gym">["searchParams"] }) {
  const { username } = await requireProfile();
  const params = await searchParams;
  const raw = first(params.date);
  const open = first(params.open) ?? null;
  if (raw !== undefined && !DateSchema.safeParse(raw).success) redirect("/workouts/gym");

  // A future date is rejected by the API (400, from the server's own "today"); fall back to today.
  const view = await apiFetch(`/workouts/gym${raw ? `?date=${raw}` : ""}`, { schema: GymViewSchema }).catch((err: unknown) => {
    if (raw && err instanceof ApiRequestError && err.status === 400) redirect("/workouts/gym");
    throw err;
  });
  // Same strip and streak as the Activities tab (FR-021).
  const range = (from: string, to: string) => apiFetch(`/workouts/summary?from=${from}&to=${to}`, { schema: SummaryRangeResponseSchema });
  const streakFrom = addDays(view.today, -61);
  const stripFrom = addDays(view.date, -6);
  const [history, stripOnly] = await Promise.all([
    range(streakFrom, view.today),
    stripFrom < streakFrom ? range(stripFrom, view.date) : Promise.resolve(null),
  ]);
  const strip = stripOnly ?? { days: history.days.filter((d) => d.date >= stripFrom && d.date <= view.date) };
  const streak = currentStreak(history.days, view.today);

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-[#0F172A] p-4 text-slate-100 sm:p-6">
      <DayNav date={view.date} today={view.today} basePath="/workouts/gym" streak={streak} />
      <DayStrip days={strip.days} current={view.date} today={view.today} basePath="/workouts/gym" />
      <WorkoutsTabs active="gym" date={view.date} today={view.today} />
      <GymScreen initialView={view} username={username} openId={open} />
    </div>
  );
}

export default function GymPage(props: PageProps<"/workouts/gym">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <GymContent searchParams={props.searchParams} />
    </Suspense>
  );
}
