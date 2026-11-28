"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  GYM_EXERCISES,
  MUSCLE_GROUP_LABELS,
  RAID_DEFAULT_NAME,
  RAID_LIMITS,
  addDays,
  localDate,
  raidPct,
  zonedInstant,
  type AdminRaid,
  type RaidCard,
  type RaidFilter,
} from "@calci/shared";
import { RAID_COPY, raidStatusLabel } from "@/lib/plain";
import { cancelRaid, createRaid, deleteRaid, suggestRaidTarget, updateRaid, type RaidResult } from "@/server/actions/raids";
import { buttonClass, cardClass, chipClass, dangerLinkClass, describedBy, Field, FormMessage, inputClass, secondaryButtonClass } from "./form-bits";
import { RaidCardBody } from "./raid-card";

type Group = RaidFilter["groups"][number];
const GROUPS: Group[] = ["chest", "back", "legs", "shoulders", "arms", "core"];
const STRENGTH = GYM_EXERCISES.filter((e) => e.kind === "strength");
const DAY_MS = 86_400_000;

/**
 * Feature 021: create or edit a raid (FR-007, FR-009) with a live preview of the card. Dates are whole days in the
 * squad timezone; "Start now" starts at once. Locked fields are disabled while the raid is live; the API enforces it too.
 */
export function RaidForm({ timezone, defaultStartsAt, raid }: { timezone: string; defaultStartsAt: string; raid?: AdminRaid }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const status = raid?.status ?? "draft";
  const live = status === "live";
  const readOnly = status === "won" || status === "ended" || status === "cancelled";

  const initialStart = localDate(new Date(raid?.startsAt ?? defaultStartsAt), timezone);
  const [name, setName] = useState(raid?.name ?? RAID_DEFAULT_NAME);
  const [tagline, setTagline] = useState(raid?.tagline ?? "");
  const [startNow, setStartNow] = useState(false);
  const [startDate, setStartDate] = useState(initialStart);
  const [lastDay, setLastDay] = useState(raid ? localDate(new Date(Date.parse(raid.endsAt) - 1), timezone) : addDays(initialStart, 6));
  const [target, setTarget] = useState(raid ? String(raid.targetKg) : "");
  const [groups, setGroups] = useState<Group[]>(raid?.filter?.groups ?? []);
  const [exerciseIds, setExerciseIds] = useState<string[]>(raid?.filter?.exerciseIds ?? []);
  const [capPct, setCapPct] = useState(String(raid?.capPct ?? RAID_LIMITS.capDefault));
  const [lateJoiners, setLateJoiners] = useState(raid?.lateJoiners ?? true);
  const [showContributors, setShowContributors] = useState(raid?.showContributors ?? true);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<RaidResult | null>(null);
  const fields = result && !result.ok ? (result.fields ?? {}) : {};

  // "Start now" uses the server clock on save; the preview only needs roughly now.
  const [openedAt] = useState(() => new Date().toISOString());
  const startsAt = live && raid ? raid.startsAt : startNow ? openedAt : zonedInstant(startDate, "00:00", timezone);
  const endsAt = zonedInstant(addDays(lastDay, 1), "00:00", timezone);
  const filter = groups.length || exerciseIds.length ? { groups, exerciseIds } : null;

  // Suggested target (FR-008) for a new raid; refreshed when dates or the filter change, until the admin types one.
  const [typed, setTyped] = useState(Boolean(raid));
  const suggestKey = `${startsAt.slice(0, 10)}|${endsAt}|${groups.join()}|${exerciseIds.join()}`;
  useEffect(() => {
    if (typed) return;
    let stale = false;
    void suggestRaidTarget({ start: startsAt, end: endsAt, groups, exercises: exerciseIds }).then((kg) => {
      if (!stale && kg !== null) setTarget(String(kg));
    });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- suggestKey captures the inputs that matter
  }, [suggestKey, typed]);

  const preview: RaidCard = useMemo(() => {
    const t = Number(target) || 0;
    const total = raid?.totalKg ?? 0;
    const days = Math.max(1, Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / DAY_MS));
    return {
      raidId: raid?.raidId ?? "preview",
      name: name.trim() || RAID_DEFAULT_NAME,
      tagline: tagline.trim() || null,
      status: "live",
      startsAt,
      endsAt,
      targetKg: t,
      totalKg: total,
      pct: raidPct(total, t),
      pace: 0,
      daysLeft: days,
      cancelReason: null,
      you: { kg: 0, rawKg: 0, pct: 0, capped: false, sticker: false },
      split: showContributors ? { segments: [], othersKg: 0 } : null,
    };
  }, [name, tagline, startsAt, endsAt, target, showContributors, raid]);

  const body = (draft: boolean) => ({
    name,
    ...(tagline.trim() ? { tagline } : {}),
    ...(startNow && !live ? { startNow: true } : { startsAt }),
    endsAt,
    targetKg: Number(target),
    filter,
    capPct: Number(capPct),
    lateJoiners,
    showContributors,
    stickerId: "raid_cleared" as const,
    draft,
  });

  const run = (fn: () => Promise<RaidResult>) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) router.push("/squad");
    });
  const save = (draft: boolean) =>
    run(() => (raid ? updateRaid(raid.raidId, { ...body(draft), expectedUpdatedAt: raid.updatedAt }) : createRaid(body(draft))));

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const lockedHint = live ? RAID_COPY.lockedHint : undefined;

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Preview" className={`${cardClass} p-4`}>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Preview</p>
        <RaidCardBody card={preview} timezone={timezone} headingId="raid-preview-heading" preview />
      </section>

      {raid ? <p className="text-sm text-muted">Status: {raidStatusLabel[status]}</p> : null}

      <fieldset disabled={readOnly || pending} className="flex flex-col gap-4">
        <Field id="raid-name" label="Name" error={fields.name}>
          <input id="raid-name" className={inputClass} value={name} maxLength={RAID_LIMITS.nameMax} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(fields.name)} aria-describedby={describedBy("raid-name", fields.name)} />
        </Field>
        <Field id="raid-tagline" label="Tagline (optional)" error={fields.tagline}>
          <input id="raid-tagline" className={inputClass} value={tagline} maxLength={RAID_LIMITS.taglineMax} onChange={(e) => setTagline(e.target.value)} aria-invalid={Boolean(fields.tagline)} />
        </Field>

        {!live ? (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={startNow} onChange={(e) => setStartNow(e.target.checked)} />
            Start now
          </label>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="raid-start" label="First day" error={fields.startsAt} {...(lockedHint ? { hint: lockedHint } : {})}>
            <input id="raid-start" type="date" className={inputClass} value={startDate} disabled={startNow || live} onChange={(e) => setStartDate(e.target.value)} aria-invalid={Boolean(fields.startsAt)} aria-describedby={describedBy("raid-start", fields.startsAt, lockedHint)} />
          </Field>
          <Field id="raid-end" label="Last day" error={fields.endsAt} hint="Ends at midnight after this day">
            <input id="raid-end" type="date" className={inputClass} value={lastDay} onChange={(e) => setLastDay(e.target.value)} aria-invalid={Boolean(fields.endsAt)} aria-describedby={describedBy("raid-end", fields.endsAt, "Ends at midnight after this day")} />
          </Field>
        </div>

        <Field id="raid-target" label="Target (kg)" error={fields.targetKg} hint={typed ? "Total weight × reps the squad needs" : "Suggested from the last 4 weeks, + 10%"}>
          <input
            id="raid-target"
            className={inputClass}
            inputMode="numeric"
            value={target}
            onChange={(e) => {
              setTyped(true);
              setTarget(e.target.value.replace(/[^\d]/g, ""));
            }}
            aria-invalid={Boolean(fields.targetKg)}
          />
        </Field>

        <fieldset disabled={live} className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Counting exercises</legend>
          <p className="text-sm text-muted">{groups.length || exerciseIds.length ? "Only these count." : "All exercises count."}{live ? ` ${RAID_COPY.lockedHint}` : ""}</p>
          <div className="flex flex-wrap gap-2">
            {GROUPS.map((g) => (
              <button key={g} type="button" aria-pressed={groups.includes(g)} className={chipClass(groups.includes(g))} onClick={() => setGroups(toggle(groups, g))}>
                {MUSCLE_GROUP_LABELS[g]}
              </button>
            ))}
          </div>
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-2 text-ink-2">Pick specific exercises{exerciseIds.length ? ` (${exerciseIds.length})` : ""}</summary>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {STRENGTH.map((e) => (
                <li key={e.id}>
                  <label className="flex min-h-11 items-center gap-2">
                    <input type="checkbox" checked={exerciseIds.includes(e.id)} onChange={() => setExerciseIds(toggle(exerciseIds, e.id))} />
                    {e.name}
                  </label>
                </li>
              ))}
            </ul>
          </details>
        </fieldset>

        <Field id="raid-cap" label="Per-member cap (% of target)" error={fields.capPct} hint={live ? RAID_COPY.lockedHint : "Volume above the cap doesn't fill the bar"}>
          <input id="raid-cap" className={inputClass} inputMode="numeric" value={capPct} disabled={live} onChange={(e) => setCapPct(e.target.value.replace(/[^\d]/g, ""))} aria-invalid={Boolean(fields.capPct)} />
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={lateJoiners} disabled={live} onChange={(e) => setLateJoiners(e.target.checked)} />
          Late joiners count
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={showContributors} onChange={(e) => setShowContributors(e.target.checked)} />
          Show contributors
        </label>
        <Field id="raid-sticker" label="Reward sticker">
          <select id="raid-sticker" className={inputClass} value="raid_cleared" disabled={live} onChange={() => undefined}>
            <option value="raid_cleared">{RAID_COPY.sticker}</option>
          </select>
        </Field>

        <FormMessage error={result && !result.ok ? result.error : undefined} />

        {!readOnly ? (
          <div className="flex flex-wrap gap-2">
            {status === "draft" ? (
              <button type="button" className={secondaryButtonClass} onClick={() => save(true)}>
                Save draft
              </button>
            ) : null}
            <button type="button" className={buttonClass} onClick={() => save(false)}>
              {raid && status !== "draft" ? "Save changes" : startNow ? "Start raid" : "Schedule raid"}
            </button>
          </div>
        ) : null}
      </fieldset>

      {raid && !readOnly ? (
        <section aria-labelledby="raid-cancel-heading" className="flex flex-col gap-3 border-t border-line pt-4">
          <h2 id="raid-cancel-heading" className="font-semibold">
            Cancel or delete
          </h2>
          <Field id="raid-reason" label="Reason (optional, shown on the card)">
            <input id="raid-reason" className={inputClass} value={reason} maxLength={RAID_LIMITS.reasonMax} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={dangerLinkClass} disabled={pending} onClick={() => run(() => cancelRaid(raid.raidId, { ...(reason.trim() ? { reason } : {}), expectedUpdatedAt: raid.updatedAt }))}>
              Cancel raid
            </button>
            {status === "draft" || status === "scheduled" ? (
              <button type="button" className={dangerLinkClass} disabled={pending} onClick={() => run(() => deleteRaid(raid.raidId))}>
                Delete raid
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
