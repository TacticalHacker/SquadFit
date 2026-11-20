# Quickstart: Share a Workout Day (016)

## Prerequisites
`pnpm install`; `pnpm deploy:dev` (new routes + grants); then `pnpm admin squad backfill` once so `improvedDays` exists for history.

## Checks
1. `pnpm check` passes (domain tests in `packages/shared/src/domain/share-card.test.ts`, handler tests for share/post).
2. `pnpm synth` passes; stack test: only `squad-post-put` can write `share-photos/*`.

## Manual validation
| Scenario | Expected |
|---|---|
| Gym tab, today with 2 logged exercises → Share | Sheet opens, Card preview ≤ 1 s, figures match the day |
| Day with nothing logged | No Share button |
| iPhone Safari / Android Chrome → Share | System sheet lists Instagram; Story opens with the image (3 taps) |
| Cancel the system sheet | No error |
| Desktop Chrome | Download primary + hint; file is 1080 × 1920 JPEG |
| Add portrait / landscape / rotated / 48 MP photo | Right way up, fills frame, drag + pinch/slider, never shows an empty edge |
| HEIC that the browser can't read | "Couldn't open this photo. Try a JPEG or a screenshot." |
| Sticker | PNG with transparency, white text with shadow |
| 10 exercises; 60-char names | 5 rows + "+5 more"; names shrink then "…" |
| PR day | "New personal best" + "Bench Press · 82.5 kg (+2.5 kg)" |
| Post to squad feed (no photo) | One feed item with the workout card; reactions work; re-post doesn't duplicate |
| Post with photo opt-in, then Remove post | Photo shows to another member; after remove, item gone, profile reactions still there |
| Hidden member | Post option disabled; API 403 |

Sample images: open the sheet in a desktop browser and use Download for each template.
