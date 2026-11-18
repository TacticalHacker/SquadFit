import Link from "next/link";
import { Suspense } from "react";
import { DayViewSchema } from "@calci/shared";
import { CustomWorkoutForm } from "@/components/custom-workout-form";
import { ChevronLeft } from "lucide-react";
import { linkClass } from "@/components/form-bits";
import { apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "My workouts · SquadFit" };

async function Mine() {
  await requireProfile();
  const view = await apiFetch("/workouts", { schema: DayViewSchema });
  const mine = view.rows.filter((r) => !r.removed);
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="add-h">
        <h2 id="add-h" className="mb-3 text-lg font-semibold">
          Add a workout
        </h2>
        <CustomWorkoutForm />
      </section>
      <section aria-labelledby="list-h">
        <h2 id="list-h" className="mb-3 text-lg font-semibold">
          Your workouts
        </h2>
        {mine.length === 0 ? (
          <p className="text-sm text-muted">You haven&apos;t added any yet. The standard workouts can&apos;t be changed.</p>
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
      <p className="mb-3 text-sm">
        <Link href="/workouts" className={`inline-flex items-center gap-1 ${linkClass}`}>
          <ChevronLeft aria-hidden size={16} strokeWidth={1.75} />
          Back to workouts
        </Link>
      </p>
      <h1 className="mb-6 text-3xl font-semibold tracking-[-0.02em]">My workouts</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <Mine />
      </Suspense>
    </>
  );
}
