import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { AdminRaidsResponseSchema, RaidHistoryResponseSchema } from "@calci/shared";
import { cardClass, linkClass, secondaryButtonClass } from "@/components/form-bits";
import { RAID_COPY, kg, raidDates, raidStatusLabel } from "@/lib/plain";
import { apiFetch } from "@/server/api";
import { getMe, requireProfile } from "@/server/session";

export const metadata = { title: "Raid history · SquadFit" };

/** Feature 021, Story 5: finished raids (own kg only). Admins also see drafts, scheduled and live raids to manage. */
async function Raids() {
  const [{ profile }, me] = await Promise.all([requireProfile(), getMe()]);
  const [history, admin] = await Promise.all([
    apiFetch("/squad/raids", { schema: RaidHistoryResponseSchema }),
    me.isAdmin ? apiFetch("/admin/raids", { schema: AdminRaidsResponseSchema }) : Promise.resolve(null),
  ]);
  const open = admin?.raids.filter((r) => r.status === "draft" || r.status === "scheduled" || r.status === "live") ?? [];
  const tz = admin?.timezone ?? profile.timezone;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/squad" className={`${linkClass} inline-flex min-h-11 items-center gap-1 self-start text-sm`}>
        <ChevronLeft aria-hidden size={16} strokeWidth={1.75} />
        Squad
      </Link>
      <h1 className="text-3xl font-semibold tracking-[-0.02em]">{RAID_COPY.history}</h1>

      {admin ? (
        <section aria-labelledby="manage-heading" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h2 id="manage-heading" className="text-xl font-semibold">
              Upcoming
            </h2>
            <Link href="/squad/raids/new" className={`${secondaryButtonClass} text-sm`}>
              <Plus aria-hidden size={16} strokeWidth={1.75} />
              {RAID_COPY.newRaid}
            </Link>
          </div>
          {open.length === 0 ? <p className="text-sm text-muted">No drafts or scheduled raids.</p> : null}
          <ul className="flex flex-col gap-2">
            {open.map((r) => (
              <li key={r.raidId}>
                <Link href={`/squad/raids/${r.raidId}`} className={`${cardClass} flex min-h-11 items-center justify-between gap-3 p-3`}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.name}</span>
                    <span className="text-sm text-muted">{raidDates(r.startsAt, r.endsAt, tz)}</span>
                  </span>
                  <span className="text-sm text-ink-2">{raidStatusLabel[r.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="past-heading" className="flex flex-col gap-2">
        <h2 id="past-heading" className="text-xl font-semibold">
          Past raids
        </h2>
        {history.raids.length === 0 ? <p className="text-sm text-muted">{RAID_COPY.noHistory}</p> : null}
        <ul className="flex flex-col gap-2">
          {history.raids.map((r) => (
            <li key={r.raidId} className={`${cardClass} flex flex-col gap-1 p-3`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-medium">{r.name}</span>
                <span className={`text-sm ${r.status === "won" ? "text-accent" : "text-ink-2"}`}>{raidStatusLabel[r.status]} · {r.pct}%</span>
              </div>
              <p className="text-sm text-muted">
                {raidDates(r.startsAt, r.endsAt, tz)} · {kg(r.totalKg)} of {kg(r.targetKg)}
              </p>
              <p className="text-sm text-ink-2">{r.youKg !== null ? `You: ${kg(r.youKg)}` : "You didn't take part"}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function RaidsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <Raids />
    </Suspense>
  );
}
