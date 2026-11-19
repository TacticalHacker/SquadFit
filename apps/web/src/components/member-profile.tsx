import Link from "next/link";
import { Settings } from "lucide-react";
import type { MemberProfile as Profile } from "@calci/shared";
import { INFO, bestWeeks, estMax, heaviestLift, kg, weekCompare, weeksInARow, workoutsThisWeek } from "@/lib/plain";
import { Avatar } from "./avatar";
import { ClubBadge } from "./club-badge";
import { InfoTip } from "./info-tip";
import { cardClass, linkClass } from "./form-bits";
import { Heatmap } from "./heatmap";
import { StepsChart } from "./steps-chart";

const shortDate = (d: string) =>
  new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col">
    <dt className="text-xs text-muted">{label}</dt>
    <dd className="text-lg font-semibold tabular-nums text-ink">{value}</dd>
  </div>
);

/** Header, PR board and heatmap of one member (feature 011). The timeline is rendered by the page. */
export function MemberProfileView({ profile }: { profile: Profile }) {
  const { member } = profile;
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar displayName={member.displayName} avatarUrl={member.avatarUrl} size={56} />
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-[-0.02em]">{member.displayName}</h1>
            <p className="text-sm text-muted">Member since {shortDate(profile.memberSince)}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-4">
          <Stat label="This week" value={workoutsThisWeek(profile.week.days, profile.week.target)} />
          {profile.streak.current > 0 ? <Stat label="Streak" value={weeksInARow(profile.streak.current)} /> : null}
          {profile.streak.best > 0 ? <Stat label="Longest streak" value={bestWeeks(profile.streak.best).replace("Best: ", "")} /> : null}
        </dl>
        {profile.weightLifted.thisWeek > 0 || profile.weightLifted.lastWeek > 0 ? (
          <div className="flex flex-col">
            <p className="flex items-center gap-0.5 text-xs text-muted">
              Total weight lifted this week
              <InfoTip title="Total weight lifted" text={INFO.totalLifted} />
            </p>
            <p className="text-lg font-semibold tabular-nums text-ink">{kg(profile.weightLifted.thisWeek)}</p>
            <p className="text-sm text-muted">
              {weekCompare(profile.weightLifted.thisWeek, profile.weightLifted.lastWeek) ?? "Nothing lifted last week to compare with"}
            </p>
          </div>
        ) : null}
        {profile.badges.length > 0 ? (
          <ul aria-label="Club badges" className="flex flex-wrap gap-1.5">
            {profile.badges.map((b) => (
              <li key={b.club}>
                <ClubBadge club={b.club} full />
              </li>
            ))}
          </ul>
        ) : null}
        {profile.isYou ? (
          <Link href="/settings#squad" className={`${linkClass} inline-flex min-h-11 items-center gap-1.5 text-sm`}>
            <Settings aria-hidden size={16} strokeWidth={1.75} />
            Edit sharing settings
          </Link>
        ) : null}
      </header>

      <section aria-labelledby="pr-heading" className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <h2 id="pr-heading" className="text-xl font-semibold">
            PRs (personal bests)
          </h2>
          <InfoTip title="Estimated max" text={INFO.estMax} />
        </div>
        {profile.prs.length === 0 ? (
          <p className="text-sm text-muted">No lifts logged yet.</p>
        ) : (
          <ul className={`${cardClass} divide-y divide-line`}>
            {profile.prs.map((p) => (
              <li key={p.exerciseId} className="flex flex-col gap-0.5 px-3 py-2.5 text-sm">
                <span className="font-medium text-ink">{p.exerciseName}</span>
                <span className="flex flex-col tabular-nums text-muted">
                  {p.bestE1rm ? (
                    <span>
                      {estMax(p.bestE1rm.e1rm ?? 0)} · {shortDate(p.bestE1rm.date)}
                    </span>
                  ) : null}
                  {p.best ? (
                    <span>
                      {heaviestLift(null, p.best.weightKg, p.best.reps)} · {shortDate(p.best.date)}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="heat-heading" className="flex flex-col gap-2">
        <h2 id="heat-heading" className="text-xl font-semibold">
          Last 12 weeks
        </h2>
        <div className={`${cardClass} p-3`}>
          <Heatmap cells={profile.heatmap.cells} />
        </div>
      </section>

      {profile.steps ? (
        <section aria-labelledby="steps-heading" className="flex flex-col gap-2">
          <h2 id="steps-heading" className="text-xl font-semibold">
            Steps · last 30 days
          </h2>
          {profile.isYou && !profile.steps.shared ? (
            <p className="text-sm text-muted">
              Only you can see your steps.{" "}
              <Link href="/settings#health" className={linkClass}>
                Change in Settings
              </Link>
            </p>
          ) : null}
          <div className={`${cardClass} p-3`}>
            <StepsChart days={profile.steps.days} goal={profile.steps.goal} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
