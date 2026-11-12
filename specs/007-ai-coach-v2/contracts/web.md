# Contract: Web UI (`apps/web`)

## Pulse Bar: `components/pulse-bar.tsx` (client, new)

Props: `{ date: string; pulse: { note: OverallNote; metrics: PulseMetrics } }`. Rendered by both `app/(app)/workouts/gym/page.tsx` and `app/(app)/workouts/page.tsx` directly after `<DayStrip>`, only when `note` is not null. The pages fetch `/coach-note?date=<view.date>` in their existing `Promise.all`; a failed fetch → no bar.

Collapsed bar:
- `<button type="button" aria-expanded aria-controls="pulse-panel">`, `h-14` (56 px), `rounded-xl`, `bg-slate-900/60 backdrop-blur-md`, 1 px border tinted by status (research R10), `sr-only` status label.
- Left: `✨` (`aria-hidden`). Middle: headline, `truncate`, `min-w-0 flex-1`. Right: `View ▾` (chevron rotates when open; `motion-reduce` disables the rotation animation).

Expanded (wide ≥ 640 px: inline card below the bar, grid-rows transition; narrow: feature 006 `BottomSheet`, title "AI coach", Escape/backdrop closes):
1. Full headline (not truncated).
2. Metric strip, 3 equal cells: **Net calories** (`netCalories` kcal, signed), **Protein** (`proteinG` g, plus `/ target` when the member has one), **Gym volume** (`gymVolumeKg` kg, thousands separator).
3. "The verdict": `<ul>` of highlights.
4. Action checklist: `<input type="checkbox">` + `<label>` per item, ≥ 44 px row height. Tick → optimistic toggle → Server Action `setCoachAction(date, index, done, noteUpdatedAt)` → on 409 or error: revert, show "This note was updated; refresh" / "Couldn't save, try again", then `router.refresh()` on 409.

## AI adjusted badge: `components/ai-badge.tsx` (client, new)

Shown next to calories when `aiNote` is non-null, on Gym exercise rows and on Activities rows. A `<button aria-expanded>` labelled "✨ AI adjusted" (text-xs, muted). Activating it toggles a one-line text with the reason below the row (`role="note"`), and outside click or Escape closes it. No hover-only behavior.

## Food screen

`app/(app)/food/page.tsx` no longer fetches `/coach-note` or renders `CoachCard`. `components/coach-card.tsx`, `lib/coach-markdown.ts` (+ test) and the `react-markdown` dependency are removed.

## Activities tab

- Lists only own workouts plus past entries on that day (existing "removed" rows).
- No quick picks; `QUICK_PICK_IDS` and the `std-*` style entries are removed (old rows fall back to the default style).
- 006's "Logged in Gym" Strength-training hint is removed.
- Empty state (no own workouts and nothing logged that day): "No activities yet. Add the ones you do, like padel or a morning run." with a link to `/workouts/mine`.

## Settings

`app/(app)/settings/page.tsx` profile form gains **Body weight (kg)**: `<input type="number" inputMode="decimal" step="0.1" min="20" max="400">`, 16 px font. Placeholder `75`, helper "Used by your AI coach for calorie estimates. 75 kg is used until you set it." Empty submits `null`. Errors come from `BodyWeightSchema` messages.
