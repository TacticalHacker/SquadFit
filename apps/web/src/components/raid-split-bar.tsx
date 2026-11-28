"use client";

import { useEffect, useState } from "react";
import type { RaidCard, RaidSegment } from "@calci/shared";
import { raidOthers, raidSegment } from "@/lib/plain";
import { Avatar } from "./avatar";

const SHADES = ["bg-raid-1", "bg-raid-2", "bg-raid-3"] as const;
const AVATAR = 24;
/** A segment narrower than this (px) has no room for its own avatar and joins a "+N" chip. */
const MIN_AVATAR_PX = AVATAR + 4;

type Placed = { seg: RaidSegment; left: number; width: number; shade: string };
type Mark = { kind: "avatar"; seg: RaidSegment; centre: number } | { kind: "group"; segs: RaidSegment[]; centre: number };

/**
 * Feature 021 split bar: one segment per member sized to their counted kg, in the order they first contributed (never
 * sorted, so there is no #1). Hidden members are one grey "Others" segment that can't be opened. The pace tick sits
 * on top. Positions are % of max(total, target), so overkill fills the bar.
 */
export function RaidSplitBar({ card }: { card: RaidCard & { split: NonNullable<RaidCard["split"]> } }) {
  const { segments, othersKg } = card.split;
  const scale = Math.max(card.totalKg, card.targetKg);
  const [open, setOpen] = useState<string | null>(null);
  const [row, setRow] = useState<HTMLUListElement | null>(null);
  const px = useWidth(row);

  const placed = layout(segments, scale);
  const end = placed.length > 0 ? placed[placed.length - 1]!.left + placed[placed.length - 1]!.width : 0;
  const others = othersKg > 0 ? { left: end, width: (othersKg / scale) * 100 } : null;
  const marks = placeMarks(placed, px);
  const selected = segments.find((s) => s.userId === open) ?? null;
  const toggle = (id: string) => setOpen((cur) => (cur === id ? null : id));

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="progressbar"
        aria-label="Squad progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, card.pct)}
        className="relative h-3 overflow-hidden rounded-md bg-surface-2"
      >
        {placed.map((p) => (
          <button
            key={p.seg.userId}
            type="button"
            aria-label={raidSegment(p.seg.isYou ? "You" : p.seg.displayName, p.seg.kg, p.seg.sessions)}
            aria-pressed={open === p.seg.userId}
            onClick={() => toggle(p.seg.userId)}
            className={`absolute inset-y-0 ${p.shade} ${p.seg.isYou ? "ring-2 ring-inset ring-ink" : ""}`}
            style={{ left: `${p.left}%`, width: `max(1px, calc(${p.width}% - 2px))` }}
          />
        ))}
        {others ? (
          <div
            aria-label={raidOthers}
            className="absolute inset-y-0 bg-line-strong"
            style={{ left: `${others.left}%`, width: `max(1px, calc(${others.width}% - 2px))` }}
          />
        ) : null}
        {card.pace !== null ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-ink"
            style={{ left: `calc(${(card.pace * card.targetKg * 100) / scale}% - 1px)` }}
            title="Where the squad should be by now"
          />
        ) : null}
      </div>

      {segments.length > 0 ? (
        <ul ref={setRow} aria-label="Who took part" className="relative h-7">
          {marks.map((m) => (
            <li
              key={m.kind === "avatar" ? m.seg.userId : `g-${m.segs[0]!.userId}`}
              className="absolute top-0 -translate-x-1/2"
              style={{ left: `clamp(${AVATAR / 2}px, ${m.centre}%, calc(100% - ${AVATAR / 2}px))` }}
            >
              {m.kind === "avatar" ? (
                <button
                  type="button"
                  onClick={() => toggle(m.seg.userId)}
                  aria-label={raidSegment(m.seg.isYou ? "You" : m.seg.displayName, m.seg.kg, m.seg.sessions)}
                  className={`block rounded-full ${m.seg.isYou || open === m.seg.userId ? "ring-2 ring-accent" : ""}`}
                >
                  <Avatar displayName={m.seg.displayName} avatarUrl={m.seg.avatarUrl} size={AVATAR} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => toggle(m.segs.find((s) => s.userId !== open)?.userId ?? m.segs[0]!.userId)}
                  aria-label={m.segs.map((s) => s.displayName).join(", ")}
                  className="flex h-6 min-w-6 items-center justify-center rounded-full border border-line bg-surface-2 px-1.5 text-xs font-medium text-ink-2"
                >
                  +{m.segs.length}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <p aria-live="polite" className="min-h-5 text-sm tabular-nums text-ink-2">
        {selected ? raidSegment(selected.isYou ? "You" : selected.displayName, selected.kg, selected.sessions) : ""}
      </p>
    </div>
  );
}

function layout(segments: readonly RaidSegment[], scale: number): Placed[] {
  const out: Placed[] = [];
  for (const [i, seg] of segments.entries()) {
    const prev = out[i - 1];
    out.push({ seg, left: prev ? prev.left + prev.width : 0, width: (seg.kg / scale) * 100, shade: SHADES[i % SHADES.length]! });
  }
  return out;
}

/** Wide segments get their avatar at their centre; runs of narrow ones share one "+N" chip at the run's centre. */
function placeMarks(placed: readonly Placed[], px: number): Mark[] {
  const marks: Mark[] = [];
  let run: Placed[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const first = run[0]!;
    const last = run[run.length - 1]!;
    const centre = (first.left + last.left + last.width) / 2;
    marks.push(run.length === 1 ? { kind: "avatar", seg: first.seg, centre } : { kind: "group", segs: run.map((r) => r.seg), centre });
    run = [];
  };
  for (const p of placed) {
    if (px === 0 || (p.width / 100) * px >= MIN_AVATAR_PX) {
      flush();
      marks.push({ kind: "avatar", seg: p.seg, centre: p.left + p.width / 2 });
    } else run.push(p);
  }
  flush();
  return marks;
}

function useWidth(el: HTMLElement | null) {
  const [px, setPx] = useState(0);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setPx(e?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return px;
}
