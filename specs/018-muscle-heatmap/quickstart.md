# Quickstart: Daily Muscle Heatmap (018)

Validation guide. Module surface: [contracts/ui.md](contracts/ui.md); rules: [data-model.md](data-model.md).

## Prerequisites

- `pnpm install`; a dev member who can sign in (`pnpm admin create-user` if needed) and `apps/web/.env.local` pointing at the dev API.
- No deploy, migration or backfill: the feature is web + shared code only.

## Automated

```sh
pnpm --filter @calci/shared test -- muscle-map   # mapping invariants, worked example, fallback, step boundaries, region filter
pnpm check                                        # typecheck + lint + all tests
```

Expected: all green; `pnpm synth` unchanged (no infra change).

## Manual (`pnpm dev`, http://localhost:3000/workouts/gym)

| # | Steps | Expected |
|---|---|---|
| 1 | Open today with nothing logged | No figure; page looks as before (FR-009, SC-005). |
| 2 | Log Bench Press, 4 sets (ticked or not) | Figure appears under "Today: … burned": chest medium, front delts + triceps light, everything else neutral. |
| 3 | Add Tricep Pushdown, 2 sets | Triceps becomes medium (2 + 4 × 0.5 = 4); no page reload (FR-010). |
| 4 | Remove both entries | Figure disappears. Log them again. |
| 5 | Log a cardio entry only on another editable day | No figure on that day. |
| 6 | Tap triceps | Line shows "Triceps · 2 sets · 4 indirect" + **Show exercises**. Tap calves (neutral): nothing. Escape / tap outside: line closes. Tab to a region with the keyboard: same line. |
| 7 | **Show exercises** on triceps | List shows Tricep Pushdown and Bench Press first, then other triceps exercises; "Triceps" chip active; pills dimmed. Save a drawer: the filter stays. |
| 8 | Remove the chip / pick a pill / type a search / change day | Filter cleared each time (FR-013). |
| 9 | Log an own exercise in "Arms" | Biceps and triceps both light (fallback FR-004). |
| 10 | Open a locked day with lifts | Figure shows, read-only (filter still works). |
| 11 | Toggle OS dark mode; resize to 320 px | Three steps distinguishable in both themes; card fits, no horizontal scroll (SC-004). |
| 12 | Open your squad profile and the share sheet | No figure anywhere outside the Gym tab (FR-014). |
