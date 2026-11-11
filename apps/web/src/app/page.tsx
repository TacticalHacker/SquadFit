import { ApiStatus } from "@/components/api-status";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">SquadFit</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Log workouts and meals, compete on your squad&apos;s scoreboard, and keep the streak alive.
      </p>
      <ApiStatus />
    </main>
  );
}
