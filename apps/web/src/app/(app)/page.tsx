import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireProfile } from "@/server/session";

async function ToWorkouts(): Promise<null> {
  await requireProfile();
  // Gym is the default Workouts tab: most members log lifts (feature 006).
  redirect("/workouts/gym");
}

export default function Home() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <ToWorkouts />
    </Suspense>
  );
}
