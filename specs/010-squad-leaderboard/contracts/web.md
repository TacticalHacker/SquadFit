# Contract: Web (`apps/web`)

Training Log theme rules from CLAUDE.md apply: token colours only, `lucide-react` icons at 16–20 px with `strokeWidth={1.75}`, `rounded-md`/`rounded-lg` (`rounded-full` only for avatars/badges), no gradients/emoji, press feedback by colour, tabular numerals for figures. Session is read only inside `<Suspense>`.

## Navigation

`NavLinks` gains **Squad** → `/squad` (icon `Trophy`), between Food and People. Members-only, so the proxy's existing gate redirects anonymous visitors to `/sign-in?next=/squad`.

## `/squad` (`app/(app)/squad/page.tsx`)

Server Component; reads `searchParams` `period` (`week` | `30d` | `all`) and `exercise`, then fetches `GET /squad/leaderboard` and `GET /squad/feed` in parallel through `apiFetch`, parsing both with the shared schemas.

Layout (single column, max-w-2xl, no horizontal scroll at 320 px):

1. Heading "Squad" + muted line "Friendly competition. Weeks, not days."
2. If `viewerHidden`: notice "You're hidden from the squad. Others can't see you." with a link to Settings.
3. **Period toggle** (`segmentClass`, links that set `?period=`): This week · Last 30 days · All time.
4. **Board tabs** (server-rendered links, state in `?board=`, default `streaks`; the period, exercise (GET form) and Absolute/Relative choices are links/params too, so only the feed and settings form are client components): Streaks · PRs · Consistency · Lifts. Streaks and Consistency show a muted note "Not affected by the period".
5. **Rows** (`BoardRow`): rank (tabular, `—` when null) · `Avatar` (initials fallback) · name (truncate) · main figure `text-2xl font-semibold tabular-nums` with unit · muted secondary line. `isYou` row: `bg-accent-soft`.
   - Streaks: main `current` "wk"; secondary "best {best} · this week {days}/{target}" with a 4 px progress bar (`bg-accent` on `bg-line`).
   - PRs: main `count`; secondary first lift; row is a `<details>`-style disclosure (button with `aria-expanded`) listing each lift "Bench Press · 85 kg × 5 · e1RM 99 kg · 14 Nov".
   - Consistency: main `percent`% or "—"; secondary "{weekDays}/{target} this week · {weekVolumeKg} kg".
   - Lifts: exercise `<select>` (links via `?exercise=`), Absolute | Relative segment (client state). Absolute: main e1RM kg, secondary "{weightKg} kg × {reps}". Relative: main "{relative}×" or "—" (rows without a value listed after ranked rows using `relativeRank`).
6. **Empty states** (per board): Streaks "No workouts logged yet. The first session starts the streak."; PRs "No PRs {this week | in the last 30 days | yet}. Go lift something heavy."; Consistency "Consistency shows after your first full week."; Lifts "Nobody has logged {exercise} {in this period} yet."
7. **Activity feed** (`SquadFeed`): heading "Activity"; list of up to 20 items: avatar, sentence, relative date (muted). Sentences:
   - pr: "{name} hit a {exercise} PR: {w} kg × {r}" + " (e1RM {e} kg)" when e1RM exists
   - streak_week: "{name} completed week {n} of their streak"
   - first_workout: "{name} logged their first workout"
   - High-five button: `Hand` icon + count, `aria-pressed={highFivedByMe}`, optimistic toggle via `useOptimistic` + Server Action `toggleHighFive(id, on)`; reverts on error.
   - Empty: "Nothing yet. Log a workout to get things going."

Loading: `loading`-style skeleton rows inside `<Suspense>`.

## Settings: "Squad" section

New section under Profile (`SquadSettingsForm`, Server Action `saveSquadSettings` → `PUT /me/squad`):
- Weekly workout target: stepper 1–7 (existing `Stepper`), help "Days with a workout that make a week count."
- Toggle "Show me on the squad leaderboard" (default on), help "When off, you can still see the squad."
- Toggle "Share my body weight for relative strength" (default off), help "Others see only lift ÷ body weight, never your weight." Disabled with a note when no body weight is saved.

## Gym drawer

When the entry has `jumpFlag`, show above the sets (`noticeWarnClass`): `AlertTriangle` + "Unusual jump, check this set. It won't count as a PR until you confirm." and a secondary button **Looks right** → Server Action `confirmJump(date, exerciseId, updatedAt)`; on success the note disappears (refresh). Editing sets and saving clears it as usual.

## Workouts screens

`DayNav` `streak` prop becomes `{ current, weekDays, target } | undefined`: shows `Flame` + "{current}-week streak · {weekDays}/{target}" or "No streak yet · {weekDays}/{target}". Both Workouts pages read `weeklyStreak` from `GET /workouts/summary` (the 62-day streak range request is removed).

## Landing page

`app/_landing/product-preview.tsx`: remove the "Coming soon" tag on the Squad tab; the static mock copy can stay.
