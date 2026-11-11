import Link from "next/link";
import { Suspense } from "react";
import { DayViewSchema } from "@calci/shared";
import { CustomWorkoutForm } from "@/components/custom-workout-form";
import { apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "My workouts · SquadFit" };

async function Mine() {
  await requireProfile();
  const view = await apiFetch("/workouts", { schema: DayViewSchema });
  const mine = view.rows.filter((r) => !r.isStandard && !r.removed);
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="add-h">
        <h2 id="add-h" className="mb-2 text-lg font-medium">
          Add a workout
        </h2>
        <CustomWorkoutForm />
      </section>
      <section aria-labelledby="list-h">
        <h2 id="list-h" className="mb-2 text-lg font-medium">
          Your workouts
        </h2>
        {mine.length === 0 ? (
          <p className="text-sm text-zinc-500">You haven&apos;t added any yet. The standard workouts can&apos;t be changed.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {mine.map((w) => (
              <li key={w.workoutId}>
                <CustomWorkoutForm
                  workout={{
                    workoutId: w.workoutId,
                    name: w.name,
                    defaultMinutes: w.defaultMinutes,
                    defaultCalories: w.defaultCalories,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function MinePage() {
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/workouts" className="text-emerald-700 underline dark:text-emerald-400">
          ← Back to workouts
        </Link>
      </p>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">My workouts</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Mine />
      </Suspense>
    </>
  );
}
