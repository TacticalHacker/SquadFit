import { cacheLife } from "next/cache";
import { connection } from "next/server";
import { PulseResponseSchema, type PulseResponse } from "@calci/shared";
import { publicFetch } from "@/server/public-api";

/** Two anonymous counts (constitution VI, feature 009). Up to 10 minutes stale (FR-014); errors hide the strip. */
async function getPulse(): Promise<PulseResponse | null> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
  try {
    return await publicFetch("/public/pulse", { schema: PulseResponseSchema });
  } catch {
    return null;
  }
}

const fmt = new Intl.NumberFormat("en");

export async function PulseStrip() {
  // Request time only: keeps the API out of `next build` (research R2).
  await connection();
  const pulse = await getPulse();
  if (!pulse || pulse.lifters === 0) return null;
  const workouts = pulse.workoutsLast7Days;
  return (
    <section aria-label="Squad pulse" className="mx-auto w-full max-w-5xl px-4">
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl border border-white/10 bg-[#161920] px-4 py-3 text-center text-sm text-zinc-300">
        <span className="flex items-center gap-2">
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-emerald-400" />
          <span>
            Active squad: <strong className="text-white">{fmt.format(pulse.lifters)}</strong>{" "}
            {pulse.lifters === 1 ? "lifter" : "lifters"}
          </span>
        </span>
        <span aria-hidden className="text-zinc-600">
          •
        </span>
        <span>
          <strong className="text-white">{fmt.format(workouts)}</strong> {workouts === 1 ? "workout" : "workouts"} logged
          this week
        </span>
      </p>
    </section>
  );
}
