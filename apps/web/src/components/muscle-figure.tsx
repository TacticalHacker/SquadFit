"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import { MUSCLE_REGION_LABELS, type DayMuscleLoad, type MuscleRegion, type RegionLoad } from "@calci/shared";

/**
 * Feature 018: an original, stylised front/back body outline (research R5). Shapes are polygons on a 100-wide grid,
 * drawn for the viewer's left half and mirrored (x → 100 − x) unless they sit on the centre line.
 */
type Pt = readonly [number, number];
type Shape = { pts: readonly Pt[]; mirror: boolean };

const both = (...pts: Pt[]): Shape => ({ pts, mirror: true });
const centre = (...pts: Pt[]): Shape => ({ pts, mirror: false });

const poly = (pts: readonly Pt[]) => `M${pts.map(([x, y]) => `${x} ${y}`).join("L")}Z`;
const toPath = (shapes: readonly Shape[]) =>
  shapes.map((s) => poly(s.pts) + (s.mirror ? poly(s.pts.map(([x, y]) => [100 - x, y] as const)) : "")).join("");

// Shared silhouette pieces that are never a region.
const head = "M50 6a8 10 0 1 0 0.01 0Z";
const neck = both([46, 25], [50, 25], [50, 31], [45, 31]);
const hand = both([21, 99], [27, 99], [27, 107], [23, 110], [20, 105]);
const knee = both([40, 151], [46, 151], [46, 158], [40, 158]);
const foot = both([39, 191], [46, 191], [46, 197], [37, 197]);
const arm = both([27, 52], [33, 49], [34, 58], [31, 70], [25, 68], [24, 60]);
const forearm = both([25, 71], [31, 72], [29, 86], [27, 98], [21, 97], [21, 84]);

const FRONT_FILLER = [
  neck,
  hand,
  knee,
  foot,
  both([39, 53], [41, 56], [42, 92], [38, 94], [37, 70]), // obliques
  centre([38, 94], [42, 92], [50, 96], [58, 92], [62, 94], [60, 106], [50, 112], [40, 106]), // hips
  both([40, 160], [46, 160], [45, 190], [41, 190]), // shins
];
const BACK_FILLER = [neck, hand, knee, foot, forearm];

const FRONT: Partial<Record<MuscleRegion, Shape[]>> = {
  chest: [both([49, 34], [40, 32], [37, 42], [39, 52], [49, 54])],
  "front-delts": [both([39, 31], [31, 33], [26, 41], [27, 50], [33, 47], [37, 41])],
  biceps: [arm],
  forearms: [forearm],
  abs: [centre([41, 56], [59, 56], [58, 92], [50, 96], [42, 92])],
  quads: [both([39, 106], [49, 113], [48, 132], [46, 150], [40, 150], [36, 130])],
};

const BACK: Partial<Record<MuscleRegion, Shape[]>> = {
  traps: [centre([50, 25], [44, 27], [36, 32], [44, 36], [50, 46], [56, 36], [64, 32], [56, 27])],
  "rear-delts": [both([36, 32], [31, 33], [26, 41], [27, 50], [33, 46], [37, 38])],
  "upper-back": [both([50, 46], [44, 36], [38, 38], [39, 50], [46, 56], [50, 58])],
  lats: [both([39, 51], [46, 57], [49, 62], [48, 74], [42, 82], [38, 70], [36, 56])],
  triceps: [arm],
  "lower-back": [centre([42, 82], [49, 64], [51, 64], [58, 82], [59, 94], [50, 96], [41, 94])],
  glutes: [both([41, 95], [50, 97], [50, 114], [43, 116], [38, 108])],
  hamstrings: [both([38, 110], [43, 117], [49, 116], [48, 135], [46, 150], [40, 150], [36, 130])],
  calves: [both([40, 159], [46, 159], [47, 172], [45, 188], [41, 188], [39, 172])],
};

const FILL = ["fill-heat-0", "fill-heat-1", "fill-heat-2", "fill-heat-3"] as const;

export function regionSummary(label: string, l: RegionLoad): string {
  const parts: string[] = [];
  if (l.direct > 0) parts.push(`${l.direct} ${l.direct === 1 ? "set" : "sets"}`);
  if (l.indirect > 0) parts.push(`${l.indirect} indirect`);
  return [label, ...parts].join(" · ");
}

export function MuscleFigure({
  side,
  load,
  selected,
  onSelect,
  onToggle,
}: {
  side: "front" | "back";
  load: DayMuscleLoad;
  selected: MuscleRegion | null;
  /** Hover (mouse) or keyboard focus: show this region. */
  onSelect: (region: MuscleRegion) => void;
  /** Tap or Enter/Space: show it, or hide it when it is already shown. */
  onToggle: (region: MuscleRegion) => void;
}) {
  const regions = side === "front" ? FRONT : BACK;
  const filler = side === "front" ? FRONT_FILLER : BACK_FILLER;
  return (
    <figure className="flex flex-col items-center gap-1">
      <svg viewBox="16 4 68 196" className="h-48 w-auto overflow-visible" role="group" aria-label={side === "front" ? "Front" : "Back"}>
        <g aria-hidden className="fill-heat-0 stroke-line" strokeWidth={0.75} strokeLinejoin="round">
          <path d={head} />
          <path d={toPath(filler)} />
        </g>
        {(Object.entries(regions) as [MuscleRegion, Shape[]][]).map(([region, shapes]) => {
          const l = load[region];
          const worked = l.step > 0;
          const isSelected = selected === region;
          const d = toPath(shapes);
          if (!worked) {
            return <path key={region} d={d} aria-hidden className="pointer-events-none fill-heat-0 stroke-line" strokeWidth={0.75} strokeLinejoin="round" />;
          }
          return (
            <path
              key={region}
              d={d}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`${regionSummary(MUSCLE_REGION_LABELS[region], l)}`}
              className={`cursor-pointer outline-none ${FILL[l.step]} ${isSelected ? "stroke-ink" : "stroke-line"}`}
              strokeWidth={isSelected ? 1.5 : 0.75}
              strokeLinejoin="round"
              onPointerEnter={(e: PointerEvent) => {
                if (e.pointerType === "mouse") onSelect(region);
              }}
              onPointerUp={(e: PointerEvent) => {
                if (e.pointerType !== "mouse") onToggle(region);
              }}
              onFocus={(e) => {
                // Only keyboard focus selects; a tap focuses too, and onPointerUp already handles it.
                if (e.currentTarget.matches(":focus-visible")) onSelect(region);
              }}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle(region);
                }
              }}
            />
          );
        })}
      </svg>
      <figcaption className="text-xs text-muted">{side === "front" ? "Front" : "Back"}</figcaption>
    </figure>
  );
}
