# UI & module contracts: Daily Muscle Heatmap (018)

No HTTP API, zod schema or MCP tool changes. The contracts below are the shared module surface and the component props.

## `@calci/shared` (`packages/shared/src/domain/muscle-map.ts`, re-exported from `src/index.ts`)

```ts
export const MUSCLE_REGIONS: readonly MuscleRegion[];            // 15 ids, data-model order
export type MuscleRegion = "chest" | "front-delts" | ... | "calves";
export const MUSCLE_REGION_LABELS: Record<MuscleRegion, string>;
export const MUSCLE_REGION_SIDE: Record<MuscleRegion, "front" | "back">;

export interface ExerciseMuscles { primary: MuscleRegion[]; secondary: MuscleRegion[] }
export const MUSCLE_MAP: Readonly<Record<string, ExerciseMuscles>>;
export function musclesFor(exerciseId: string, group: MuscleGroup): ExerciseMuscles;

export interface RegionLoad { direct: number; indirect: number; score: number; step: 0 | 1 | 2 | 3 }
export type DayMuscleLoad = Record<MuscleRegion, RegionLoad>;
export function heatStep(score: number): 0 | 1 | 2 | 3;
export function dayMuscleLoad(
  entries: readonly Pick<GymEntryView, "exerciseId" | "muscleGroup" | "exerciseKind" | "sets">[],
): DayMuscleLoad;
export function hasMuscleLoad(load: DayMuscleLoad): boolean;

export function exercisesForRegion<T extends Pick<GymExerciseView, "exerciseId" | "group" | "kind" | "entry">>(
  exercises: readonly T[],
  region: MuscleRegion,
): T[];
```

Safe for the web bundle (no server-only imports).

## `components/muscle-heatmap.tsx` (client)

```ts
export function MuscleHeatmap(props: {
  load: DayMuscleLoad;                      // caller hides the component when !hasMuscleLoad(load)
  onShowExercises: (region: MuscleRegion) => void;
}): JSX.Element;
```

- Renders a `cardClass` card with `<MuscleFigure side="front" />` and `<MuscleFigure side="back" />` side by side, and a one-line detail for the selected region: `"{Label} · {direct} sets"` plus `" · {indirect} indirect"` when indirect > 0 (singular "set" for 1), then a `linkClass`-style **Show exercises** button.
- Keeps its own `selected: MuscleRegion | null`; selecting a neutral region is impossible. Escape, re-tapping the selection or `pointerdown` outside the card clears it. Selection resets when `load` no longer marks the region worked.
- Card `aria-label`: "Muscles worked: chest, triceps, front delts" (regions with step ≥ 1, highest score first).

## `components/muscle-figure.tsx`

```ts
export function MuscleFigure(props: {
  side: "front" | "back";
  load: DayMuscleLoad;
  selected: MuscleRegion | null;
  onSelect: (region: MuscleRegion) => void;
}): JSX.Element;
```

- Original stylised SVG outline (silhouette in `fill-heat-0 stroke-line`) and one `<path>` per region of that side, filled `fill-heat-{step}`. Worked regions: `tabIndex={0}`, `role="button"`, `aria-label="{Label}, {n} sets"`, `aria-pressed` for the selected one (selected outline uses `stroke-ink`), hover/focus/click call `onSelect`. Neutral regions: `aria-hidden`, `pointer-events: none`.

## `components/gym-screen.tsx` (changes)

- `const load = useMemo(() => dayMuscleLoad(entries), [view.exercises])` where entries = `view.exercises.flatMap(e => e.entry ? [e.entry] : [])`.
- Renders `<MuscleHeatmap>` directly after the "X min · Y kcal burned" row when `hasMuscleLoad(load)`.
- New state `region: MuscleRegion | null`. When set: `shown = exercisesForRegion(view.exercises, region)`, pills render `dimmed`, and a `chipClass(true)` chip "{Label}" with an `X` icon (lucide, 16, `strokeWidth={1.75}`) sits above the list; pressing it, choosing a pill or typing a search sets `region` to `null`. A change of `initialView.date` also clears it (research R7).

## `apps/web/src/app/globals.css`

Adds `--heat-0..3` (research R4) for light and dark, and `--color-heat-0..3` in `@theme`.
