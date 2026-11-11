import { Suspense } from "react";
import { requireProfile } from "@/server/session";

async function Welcome() {
  const { profile } = await requireProfile();
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Welcome, {profile.displayName}</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        Workout and meal logging arrive next. For now, see who else has joined on the People page.
      </p>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <Welcome />
    </Suspense>
  );
}
