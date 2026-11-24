"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type PointerEvent } from "react";
import { WEIGHT_RANGES, weightAxis, type SquadWeight, type WeightRange } from "@calci/shared";
import { WEIGHT_COPY, weightChange, weightSpan } from "@/lib/plain";
import { loadSquadWeight } from "@/server/actions/weight";
import { Avatar } from "./avatar";
import { cardClass, linkClass, noticeErrorClass, segmentClass, segmentGroupClass } from "./form-bits";
import { xLabel } from "./weight-chart";

/**
 * Feature 017: the squad's weight trend. Each member who shares is one line of kg change since their first weigh-in
 * in the period (the server never sends actual weight). One line is in focus (you by default); tap a row to switch.
 */

const HEIGHT = 200;
const PAD_TOP = 8;
const PAD_BOTTOM = 22;
const AXIS_W = 40;

export function SquadWeightChart({ initial }: { initial: SquadWeight }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [focusId, setFocusId] = useState<string | null>(initial.members[0]?.member.userId ?? null);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onRange = (range: WeightRange) =>
    start(async () => {
      setActive(-1);
      const r = await loadSquadWeight(range);
      if (!r.ok) return setError(r.error);
      setError(null);
      setData(r.data);
    });

  const members = data.members;
  const focus = members.find((m) => m.member.userId === focusId) ?? members[0] ?? null;
  const n = data.slots.length;
  const plotW = width - AXIS_W;
  const slotW = plotW / n;
  const x = (i: number) => (i + 0.5) * slotW;
  const values = members.flatMap((m) => m.deltas.filter((d): d is number => d !== null));
  const axis = values.length ? weightAxis(Math.min(0, ...values), Math.max(0, ...values)) : null;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const y = (v: number) => (axis ? PAD_TOP + ((axis.hi - v) / (axis.hi - axis.lo)) * plotH : 0);
  const points = (deltas: readonly (number | null)[]) => deltas.flatMap((d, i) => (d === null ? [] : [`${x(i)},${y(d)}`])).join(" ");

  // Scrubbing snaps to the focused line's nearest slot with data.
  const scrub = (e: PointerEvent<SVGSVGElement>) => {
    if (!focus) return;
    const pos = (e.clientX - e.currentTarget.getBoundingClientRect().left) / slotW - 0.5;
    let best = -1;
    focus.deltas.forEach((d, i) => {
      if (d !== null && (best < 0 || Math.abs(i - pos) < Math.abs(best - pos))) best = i;
    });
    setActive(best);
  };

  const activeSlot = active >= 0 ? data.slots[active] : undefined;
  const headValue = focus ? (activeSlot ? focus.deltas[active] : focus.change) : null;
  const headSpan = activeSlot ? weightSpan(activeSlot.start, activeSlot.end) : weightSpan(data.start, data.end);
  const name = (m: SquadWeight["members"][number]) => (m.member.isYou ? "You" : m.member.displayName);

  return (
    <div className="flex flex-col gap-4">
      {!data.sharing ? (
        <p className="text-sm text-muted">
          {WEIGHT_COPY.notSharing}{" "}
          <Link href="/settings#squad" className={linkClass}>
            Share it in Settings
          </Link>
          .
        </p>
      ) : null}

      <section aria-label="Squad weight trend" className={`${cardClass} flex flex-col gap-3 p-4`}>
        <div className={`${segmentGroupClass} grid-cols-4`} role="group" aria-label="Chart range">
          {WEIGHT_RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={data.range === r} onClick={() => onRange(r)} className={segmentClass(data.range === r)}>
              {r}
            </button>
          ))}
        </div>

        {error ? <p className={noticeErrorClass}>{error}</p> : null}

        <div aria-live="polite" className="min-h-16">
          <p className="text-xs font-semibold tracking-wide text-muted">
            {WEIGHT_COPY.change}
            {focus ? ` · ${name(focus).toUpperCase()}` : ""}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-ink">{headValue === null || headValue === undefined ? "—" : weightChange(headValue)}</p>
          <p className="text-sm text-muted">{headSpan}</p>
        </div>

        <div ref={box} className={`relative ${pending ? "opacity-60" : ""}`}>
          <svg
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            role="img"
            aria-label={`Weight change of ${members.length} ${members.length === 1 ? "member" : "members"}, ${weightSpan(data.start, data.end)}`}
            className="block h-auto max-w-full touch-pan-y select-none"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              scrub(e);
            }}
            onPointerMove={(e) => (e.pointerType === "mouse" || e.currentTarget.hasPointerCapture(e.pointerId) ? scrub(e) : undefined)}
            onPointerUp={(e) => e.pointerType !== "mouse" && setActive(-1)}
            onPointerCancel={() => setActive(-1)}
            onPointerLeave={() => setActive(-1)}
          >
            {axis?.ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={plotW} y1={y(t)} y2={y(t)} strokeDasharray={t === 0 ? undefined : "2 3"} strokeWidth={1} className={t === 0 ? "stroke-line-strong" : "stroke-line"} />
                <text x={width - 2} y={y(t) + 4} textAnchor="end" fontSize={11} className="fill-faint tabular-nums">
                  {t > 0 ? `+${t}` : t < 0 ? `−${Math.abs(t)}` : "0"}
                </text>
              </g>
            ))}

            {data.slots.map((s, i) => {
              const label = xLabel(data.range, s, i, n);
              return label ? (
                <text key={s.start} x={x(i)} y={HEIGHT - 6} textAnchor="middle" fontSize={11} className="fill-faint">
                  {label}
                </text>
              ) : null;
            })}

            {activeSlot ? <line x1={x(active)} x2={x(active)} y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM} strokeWidth={1} className="stroke-ink" /> : null}

            {axis
              ? members
                  .filter((m) => m !== focus)
                  .map((m) => (
                    <polyline key={m.member.userId} points={points(m.deltas)} fill="none" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" className="stroke-line-strong" />
                  ))
              : null}
            {axis && focus ? (
              <g>
                <polyline points={points(focus.deltas)} fill="none" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" className="stroke-accent" />
                {focus.deltas.map((d, i) =>
                  d === null ? null : <circle key={i} cx={x(i)} cy={y(d)} r={active === i ? 4.5 : 3} className="fill-accent" />,
                )}
              </g>
            ) : null}
          </svg>
          {!axis ? <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted">{WEIGHT_COPY.squadEmpty}</p> : null}
        </div>
        <p className="text-xs text-muted">{WEIGHT_COPY.shareInfo}</p>
      </section>

      {members.length ? (
        <ul className={`${cardClass} flex flex-col divide-y divide-line`} aria-label="Members sharing their weight trend">
          {members.map((m) => {
            const on = m === focus;
            return (
              <li key={m.member.userId}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => (setActive(-1), setFocusId(m.member.userId))}
                  className={`flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-2 ${on ? "bg-accent-soft" : ""}`}
                >
                  <Avatar displayName={m.member.displayName} avatarUrl={m.member.avatarUrl} size={32} />
                  <span className={`flex-1 truncate text-sm ${on ? "font-semibold text-ink" : "text-ink"}`}>{name(m)}</span>
                  <span className="text-sm font-medium tabular-nums text-ink">{weightChange(m.change)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
