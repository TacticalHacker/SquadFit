"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { Plus, Settings2, Swords, Trophy } from "lucide-react";
import type { RaidCard as RaidCardData, RaidCardResponse } from "@calci/shared";
import { prHaptic } from "@/lib/haptics";
import {
  RAID_COPY,
  raidCancelled,
  raidDaysLeft,
  raidEnded,
  raidNext,
  raidTotalLine,
  raidYou,
  raidYouShare,
} from "@/lib/plain";
import { cardClass, linkClass, secondaryButtonClass } from "./form-bits";
import { InfoTip } from "./info-tip";
import { RaidSplitBar } from "./raid-split-bar";

const STAMP_KEY = (raidId: string) => `sf:raidstamp:v1:${raidId}`;

/**
 * Feature 021: the raid card at the top of the Squad tab (FR-021–FR-026). Data comes from one `GET /squad/raid`.
 * With "Show contributors" on, the bar is split by member (`RaidSplitBar`); otherwise one plain bar.
 */
export function RaidCard({ data, timezone }: { data: RaidCardResponse; timezone: string }) {
  const { card, next, canManage, canCreate } = data;
  if (!card) {
    if (!canManage && !next) return null;
    return (
      <section aria-label="Squad raid" className={`${cardClass} flex flex-wrap items-center justify-between gap-3 p-4`}>
        <p className="text-sm text-ink-2">{next ? raidNext(next.name, next.startsAt, timezone) : "No raid on right now."}</p>
        {canCreate ? <NewRaidLink /> : null}
      </section>
    );
  }
  return (
    <section aria-labelledby="raid-heading" className={`${cardClass} flex flex-col gap-3 p-4`}>
      <RaidCardBody card={card} timezone={timezone} headingId="raid-heading" />
      {next && card.status !== "scheduled" ? <p className="text-sm text-muted">{raidNext(next.name, next.startsAt, timezone)}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/squad/raids" className={`${linkClass} inline-flex min-h-11 items-center text-sm`}>
          {RAID_COPY.history}
        </Link>
        {canManage ? (
          <div className="flex gap-2">
            <Link href={`/squad/raids/${card.raidId}`} className={`${secondaryButtonClass} text-sm`}>
              <Settings2 aria-hidden size={16} strokeWidth={1.75} />
              {RAID_COPY.manage}
            </Link>
            {canCreate ? <NewRaidLink /> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function NewRaidLink() {
  return (
    <Link href="/squad/raids/new" className={`${secondaryButtonClass} text-sm`}>
      <Plus aria-hidden size={16} strokeWidth={1.75} />
      {RAID_COPY.newRaid}
    </Link>
  );
}

/** Shared by the Squad tab and the admin form's live preview. */
export function RaidCardBody({ card, timezone, headingId, preview = false }: { card: RaidCardData; timezone: string; headingId: string; preview?: boolean }) {
  const stamp = useStampOnce(card, preview);
  const progress = card.status === "live" || card.status === "won" || card.status === "ended";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="flex items-center gap-2 text-lg font-semibold">
            <Swords aria-hidden size={18} strokeWidth={1.75} className="shrink-0 text-ink-2" />
            <span className="truncate">{card.name}</span>
            <InfoTip title="How a raid works" text={RAID_COPY.info} />
          </h2>
          {card.tagline ? <p className="text-sm text-muted">{card.tagline}</p> : null}
        </div>
        {card.daysLeft !== null ? <p className="shrink-0 text-sm text-ink-2">{raidDaysLeft(card.daysLeft)}</p> : null}
      </div>

      {card.status === "scheduled" ? <p className="text-sm text-ink-2">{raidNext(card.name, card.startsAt, timezone)}</p> : null}
      {card.status === "cancelled" ? <p className="text-sm text-ink-2">{raidCancelled(card.cancelReason)}</p> : null}

      {card.status === "won" ? (
        <p
          className={`inline-flex items-center gap-2 self-start rounded-md border border-accent px-3 py-1 text-sm font-semibold tracking-[0.12em] text-accent ${stamp ? "stamp-in" : ""}`}
        >
          <Trophy aria-hidden size={16} strokeWidth={1.75} />
          {RAID_COPY.cleared} · {card.pct}%
        </p>
      ) : null}
      {card.status === "ended" ? <p className="text-sm font-medium text-ink-2">{raidEnded(card.pct)}</p> : null}

      {progress ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-base font-semibold tabular-nums">{raidTotalLine(card.totalKg, card.targetKg, card.pct)}</p>
          {card.split ? (
            <RaidSplitBar card={{ ...card, split: card.split }} />
          ) : (
            <div
              role="progressbar"
              aria-label="Squad progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, card.pct)}
              className="relative h-3 overflow-hidden rounded-md bg-surface-2"
            >
              <div className="h-full bg-accent-fill" style={{ width: `${Math.min(100, (card.totalKg / card.targetKg) * 100)}%` }} />
              {card.pace !== null ? (
                <div aria-hidden className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `calc(${card.pace * 100}% - 1px)` }} title="Where the squad should be by now" />
              ) : null}
            </div>
          )}
          <p className="text-sm tabular-nums text-ink-2">{youLine(card)}</p>
        </div>
      ) : null}

      {card.you.sticker ? (
        <p className="inline-flex items-center gap-1.5 self-start rounded-full border border-accent bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
          <Trophy aria-hidden size={14} strokeWidth={1.75} />
          {RAID_COPY.sticker}
        </p>
      ) : null}
    </div>
  );
}

/** "You: 1,200 kg · 20% of the squad" with the split bar, "You: 6,200 kg (22%)" (of target) without. */
function youLine(card: RaidCardData): string {
  if (card.you.kg <= 0) return RAID_COPY.zeroYou;
  if (!card.split) return raidYou(card.you.kg, card.you.pct, card.you.capped);
  const share = card.totalKg > 0 ? Math.round((card.you.kg / card.totalKg) * 100) : 0;
  return raidYouShare(card.you.kg, share, card.you.capped);
}

const noSubscribe = () => () => {};

/**
 * FR-026: the first visit after a win you took part in fades the stamp in once (no scale) with the PR haptic.
 * Remembered per device. Returns true on that first visit.
 */
function useStampOnce(card: RaidCardData, preview: boolean): boolean {
  const key = STAMP_KEY(card.raidId);
  const eligible = !preview && card.status === "won" && card.you.sticker;
  const fresh = useSyncExternalStore(
    noSubscribe,
    () => {
      try {
        return eligible && localStorage.getItem(key) === null;
      } catch {
        return false;
      }
    },
    () => false,
  );
  useEffect(() => {
    if (!fresh) return;
    try {
      localStorage.setItem(key, new Date().toISOString());
    } catch {
      // private mode: the stamp may show again, which is harmless
    }
    prHaptic(); // best effort: some browsers only buzz after a tap
  }, [fresh, key]);
  return fresh;
}
