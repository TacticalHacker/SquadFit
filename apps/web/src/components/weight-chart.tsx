"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { WEIGHT_RANGES, nearestSlot, weightAxis, type WeightRange, type WeightSlot, type WeightView } from "@calci/shared";
import { WEIGHT_COPY, weightKg, weightRange, weightSpan } from "@/lib/plain";
import { useWeightTrend } from "@/lib/weight-trend-pref";
import { chipClass, segmentClass, segmentGroupClass } from "./form-bits";

/**
 * Feature 014: Apple Health-style weight chart (research R5). Draws the server-built WeightView only; the math lives in
 * `domain/bodyweight.ts`. W/M: dots joined through day averages, capsules for multi-entry days, optional trend.
 * 6M/Y: min–max capsules (a dot when min = max). Scrubbing snaps to the nearest slot with data.
 */

const HEIGHT = 200;
const PAD_TOP = 8;
const PAD_BOTTOM = 22;
const AXIS_W = 40;

const daily = (r: WeightRange) => r === "W" || r === "M";
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const wk = new Intl.DateTimeFormat("en-GB", { weekday: "narrow", timeZone: "UTC" });
const mon = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const monNarrow = new Intl.DateTimeFormat("en-GB", { month: "narrow", timeZone: "UTC" });

/** Sparse x labels: every day in W, weekly in M, month starts in 6M, month initials in Y. */
function xLabel(range: WeightRange, slot: WeightSlot, i: number, n: number): string | null {
  if (range === "W") return wk.format(utc(slot.start));
  if (range === "M") return (n - 1 - i) % 7 === 0 ? String(+slot.start.slice(8, 10)) : null;
  if (range === "6M") return i === 0 || slot.start.slice(5, 7) !== slot.end.slice(5, 7) || slot.start.endsWith("-01") ? mon.format(utc(slot.end)) : null;
  return monNarrow.format(utc(slot.start));
}

function header(view: WeightView, s: WeightSlot | null): { label: string; value: string | null; span: string } {
  if (s && s.count > 0) {
    const span = weightSpan(s.start, s.end);
    if (!daily(view.range)) return { label: WEIGHT_COPY.range, value: weightRange(s.min!, s.max!), span };
    return { label: s.count === 1 ? WEIGHT_COPY.weight : WEIGHT_COPY.average, value: weightKg(s.average!), span };
  }
  const span = weightSpan(view.start, view.end);
  if (!view.summary) return { label: daily(view.range) ? WEIGHT_COPY.average : WEIGHT_COPY.range, value: null, span };
  return daily(view.range)
    ? { label: WEIGHT_COPY.average, value: weightKg(view.summary.average), span }
    : { label: WEIGHT_COPY.range, value: weightRange(view.summary.min, view.summary.max), span };
}

export function WeightChart({ view, pending, onRange }: { view: WeightView; pending: boolean; onRange: (r: WeightRange) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [active, setActive] = useState(-1);
  const [trendOn, setTrendOn] = useWeightTrend();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const slots = view.slots;
  const n = slots.length;
  const showTrend = daily(view.range) && trendOn;
  const plotW = width - AXIS_W;
  const slotW = plotW / n;
  const x = (i: number) => (i + 0.5) * slotW;

  const values = slots.flatMap((s) => (s.count ? [s.min!, s.max!] : []));
  if (showTrend) values.push(...slots.flatMap((s) => (s.trend === null ? [] : [s.trend])));
  const axis = values.length ? weightAxis(Math.min(...values), Math.max(...values)) : null;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const y = (v: number) => (axis ? PAD_TOP + ((axis.hi - v) / (axis.hi - axis.lo)) * plotH : 0);

  const activeSlot = active >= 0 ? (slots[active] ?? null) : null;
  const head = header(view, activeSlot);

  const scrub = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setActive(nearestSlot(slots, (e.clientX - r.left) / slotW - 0.5));
  };

  const dot = Math.min(3.5, Math.max(2.5, slotW * 0.3));
  const barW = Math.min(8, Math.max(4, slotW * 0.5));
  const dataIdx = slots.flatMap((s, i) => (s.count ? [i] : []));
  const line = dataIdx.map((i) => `${x(i)},${y(slots[i]!.average!)}`).join(" ");
  const trend = slots.flatMap((s, i) => (s.trend === null ? [] : [`${x(i)},${y(s.trend)}`])).join(" ");
  const summary = view.summary
    ? `${head.label === WEIGHT_COPY.range ? "Range" : "Average"} ${head.value}, ${weightSpan(view.start, view.end)}`
    : `${WEIGHT_COPY.emptyRange}, ${weightSpan(view.start, view.end)}`;

  return (
    <div className="flex flex-col gap-3">
      <div className={`${segmentGroupClass} grid-cols-4`} role="group" aria-label="Chart range">
        {WEIGHT_RANGES.map((r) => (
          <button key={r} type="button" aria-pressed={view.range === r} onClick={() => (setActive(-1), onRange(r))} className={segmentClass(view.range === r)}>
            {r}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="min-h-16">
        <p className="text-xs font-semibold tracking-wide text-muted">{head.label}</p>
        <p className="text-2xl font-semibold tabular-nums text-ink">{head.value ?? "—"}</p>
        <p className="text-sm text-muted">{head.span}</p>
      </div>

      <div ref={box} className={`relative ${pending ? "opacity-60" : ""}`}>
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label={summary}
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
              <line x1={0} x2={plotW} y1={y(t)} y2={y(t)} strokeDasharray="2 3" strokeWidth={1} className="stroke-line" />
              <text x={width - 2} y={y(t) + 4} textAnchor="end" fontSize={11} className="fill-faint tabular-nums">
                {t}
              </text>
            </g>
          ))}

          {slots.map((s, i) => {
            const label = xLabel(view.range, s, i, n);
            return label ? (
              <text key={s.start} x={x(i)} y={HEIGHT - 6} textAnchor="middle" fontSize={11} className="fill-faint">
                {label}
              </text>
            ) : null;
          })}

          {activeSlot ? <line x1={x(active)} x2={x(active)} y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM} strokeWidth={1} className="stroke-ink" /> : null}

          {daily(view.range) && dataIdx.length > 1 ? (
            <polyline points={line} fill="none" strokeWidth={1.25} strokeOpacity={0.4} strokeLinejoin="round" className="stroke-ink-2" />
          ) : null}
          {showTrend && trend ? <polyline points={trend} fill="none" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" className="stroke-ink-2" /> : null}

          {axis
            ? slots.map((s, i) => {
                if (!s.count) return null;
                const dim = active >= 0 && active !== i ? 0.4 : 1;
                const single = s.min === s.max || (daily(view.range) && s.count === 1);
                if (single) return <circle key={s.start} cx={x(i)} cy={y(s.average!)} r={active === i ? dot + 1.5 : dot} opacity={dim} className="fill-accent" />;
                const top = y(s.max!);
                const h = Math.max(barW, y(s.min!) - top);
                const mid = (top + y(s.min!)) / 2;
                return <rect key={s.start} x={x(i) - barW / 2} y={mid - h / 2} width={barW} height={h} rx={barW / 2} opacity={dim} className="fill-accent" />;
              })
            : null}
        </svg>
        {!axis ? <p className="absolute inset-0 grid place-items-center text-sm text-muted">{WEIGHT_COPY.emptyRange}</p> : null}
      </div>

      {daily(view.range) ? (
        <div>
          <button type="button" aria-pressed={trendOn} onClick={() => setTrendOn(!trendOn)} className={chipClass(trendOn)}>
            {WEIGHT_COPY.trend}
          </button>
        </div>
      ) : null}
    </div>
  );
}
