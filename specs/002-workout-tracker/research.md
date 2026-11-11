# Research: Workout Tracker

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-11

Builds on [001 research](../001-user-accounts/research.md): Cognito identity, server-side BFF with httpOnly cookies, DynamoDB single table, zod contracts in `packages/shared`.

## R1. Starter catalog lives in code, not in the database

**Decision**: The standard workouts are a constant array `STANDARD_WORKOUTS` in `packages/shared/src/domain/workouts.ts`, with stable ids (`std-running`). Users' own workouts are DynamoDB items.

**Rationale**: Every user sees the same list (FR-001), so there is nothing to store per user or to seed. A code change ships a new default, and entries keep their own snapshot (FR-010), so past days never change. The web app can render the list without a round trip, and tests can assert on it.

**Alternatives considered**: seeding catalog rows in DynamoDB (needs a seed step per stage and an admin path to edit them). A separate `Workout_Catalog` table as in the PRD data model (a table for ~12 constants).

**Starter values** (kcal figures assume roughly a 70 kg adult, derived from common MET tables; they are rough estimates, per the spec's assumptions):

| id | Name | Default min | Default kcal | kcal/min |
|---|---|---|---|---|
| `std-walking` | Walking | 30 | 120 | 4.0 |
| `std-running` | Running | 30 | 300 | 10.0 |
| `std-cycling` | Cycling | 30 | 240 | 8.0 |
| `std-swimming` | Swimming | 30 | 250 | 8.3 |
| `std-yoga` | Yoga | 30 | 90 | 3.0 |
| `std-strength` | Strength training | 45 | 220 | 4.9 |
| `std-hiit` | HIIT | 20 | 200 | 10.0 |
| `std-jump-rope` | Jump rope | 15 | 150 | 10.0 |
| `std-hiking` | Hiking | 60 | 350 | 5.8 |
| `std-stretching` | Stretching | 15 | 45 | 3.0 |
| `std-dancing` | Dancing | 30 | 150 | 5.0 |
| `std-team-sport` | Team sport | 60 | 400 | 6.7 |

Ids use only letters, digits and hyphens so they are safe in URL path segments and sort keys.

## R2. Calories: proportional scaling from a per-entry rate snapshot

**Decision**: `calories = round(rateCalories × minutes ÷ rateMinutes)` (`Math.round`, half up), where `rateMinutes`/`rateCalories` are the workout's defaults **copied onto the entry when it is created**. Editing an entry's minutes recomputes from that snapshot (FR-008, FR-009, FR-010). The day total is the sum of the rounded entry values, so the screen always adds up.

**Rationale**: Keeps editing independent of the workout record: it still works if a custom workout was edited or removed in the meantime, and later edits to a workout never alter an existing entry. It is a single pure function, easy to test first.

**Alternatives considered**: recomputing from the live workout default (breaks FR-010 if the workout was edited, and fails if it was removed). Storing only calories (can't recompute on edit). Float calories rounded only at display (the sum of displayed values might not equal the shown total).

## R3. Entry storage and keys

**Decision**: One DynamoDB item per entry: `pk = USER#<sub>`, `sk = ENTRY#<YYYY-MM-DD>#<workoutId>`. A custom workout is `pk = USER#<sub>`, `sk = WORKOUT#<workoutId>` (`c-<uuid>`). No new indexes.

**Rationale**:
- The key itself enforces "one entry per user, workout and day" (FR-006), so two devices ticking at once collapse to one item.
- A day is `Query pk, begins_with(sk, "ENTRY#2026-11-11#")`.
- A range (history strip, month) is one `Query pk, sk BETWEEN "ENTRY#<from>" AND "ENTRY#<to>~"` (`~` sorts after every character that can follow a date), so SC-006 is a single request, in date order.
- Everything for a user shares one partition, which makes privacy checks trivial (the caller's `sub` is the only key ever used).

**Alternatives considered**: a `Daily_Summary` item maintained on every write (extra writes and drift risk; we sum on read instead, which is at most a dozen items per day). A GSI by date (not needed until the leaderboard, and that feature can add it). Storing the date as a timestamp (loses the "stays on its logged date after a timezone change" property, FR-015).

## R4. Days, timezone and the edit window

**Decision**: Pure functions in `packages/shared/src/domain/day.ts`:
- `localDate(instant, timeZone)` uses `Intl.DateTimeFormat("en-CA", { timeZone, year, month: "2-digit", day: "2-digit" })`, giving `YYYY-MM-DD`. Handles daylight-saving transitions natively.
- `addDays(date, n)` is calendar arithmetic on the date string via UTC, so DST can't shift it.
- `isEditableDay(date, today)` is true for `today`, `today−1` and `today−2` (FR-017).

The **server is the only source of "today"**: every request reads the caller's timezone from their profile and computes `today = localDate(now, tz)`. The client passes a target `date` but never says what today is. Writes are rejected unless `date` is editable (`409 DAY_LOCKED`), and any date after today is rejected (`400`). Entries store the date string, so a later timezone change moves nothing (FR-015).

**Rationale**: Constitution V (server-authoritative; a day is in the user's timezone, never server UTC) and spec FR-014/FR-017: the edit window is enforced even for requests that bypass the UI. Testable as plain functions across zones, including a DST day.

**Alternatives considered**: trusting a client-supplied "today" (anyone could backfill). Storing UTC timestamps and deriving dates on read (a timezone change would silently move old entries).

## R5. Optimistic UI with React built-ins

**Decision**: The checklist is a client component using `useOptimistic` + `useTransition` and Server Actions (`tickWorkout`, `untickWorkout`, `setEntryMinutes`). A pure `applyChange(dayView, change)` in `packages/shared/src/domain/day-view.ts` computes the optimistic result using the same `caloriesFor` and `summarize` as the server. When the action settles, the server's day view replaces the optimistic one; if it fails, React reverts the checkbox and the component shows "Couldn't save. Try again." (the spec's network-failure edge case). The server remains the authority: it recomputes calories and totals itself, and the optimistic numbers are display only.

**Rationale**: Meets SC-001 (< 1 s) without a client cache library. Sharing `applyChange` and `caloriesFor` means the optimistic numbers equal the server's by construction, which is testable.

**Alternatives considered**: waiting for the round trip on every tap (feels slow on a phone). SWR/React Query (a new dependency for one screen). Local-only state synced later (violates "must never show ticked when nothing was saved").

## R6. Midnight rollover (FR-018)

**Decision**: The page renders for an explicit `date` (the `?date=` param, defaulting to the server's `today`). The client component gets `today` and `timeZone` as props and, on focus, on `visibilitychange`, and once a minute, compares `localDate(new Date(), timeZone)` to `today`. If they differ it calls `router.refresh()`, which re-renders the server component with the new `today`. A screen showing the implicit "today" therefore moves to the new day within a minute of midnight or on return to the tab. Every mutation carries the displayed `date`, so it can never silently land on a different day than the one on screen, and the server re-checks the window.

**Alternatives considered**: a timer for the exact next midnight in a non-device timezone (needs timezone offset math for little gain). Doing nothing (violates FR-018).

## R7. Name uniqueness for custom workouts

**Decision**: `normalizeWorkoutName` (trim, collapse spaces, lower-case) is applied to compare names. On create or rename the handler lists the caller's active custom workouts and the standard names and rejects a clash with `409 DUPLICATE_NAME` (FR-020). It is a check-then-write, not a transaction.

**Rationale**: Only one person can race themselves (two tabs, same instant); the worst outcome is two similarly named personal workouts, which is harmless. A transactional name-lock item per name would add a second item type and cleanup on rename for no real benefit at this scale. Revisit if the leaderboard ever depends on names.

## R8. Removing a custom workout

**Decision**: Soft remove: set `removedAt` on the workout item. It disappears from the checklist and from new logging, and past entries are untouched (they carry their own name and rate). If an entry's workout is no longer on the checklist, the day view still shows it as an extra row marked `removed: true`, so the user can see it and, within the window, untick or edit it.

**Alternatives considered**: hard delete (entries would lose their source, though the snapshot makes that survivable; soft remove keeps a path to "restore" in future for free).

## R9. API surface and error codes

**Decision**: Seven routes, all behind the JWT authorizer and all returning `409 PROFILE_REQUIRED` for a caller with no profile (FR-003): `GET /workouts`, `PUT|DELETE /workouts/entries/{date}/{workoutId}`, `POST /workouts/custom`, `PUT|DELETE /workouts/custom/{id}`, `GET /workouts/summary`. `GET /workouts` returns everything the screen needs in one response (checklist rows with their entries, the day's totals, `today`, `editable`) so the page is one request. New error codes added to the shared enum: `DAY_LOCKED`, `DUPLICATE_NAME`, `NOT_FOUND`.

**Rationale**: One round trip per screen and per action; mutations return the full day view so the client never has to merge.

## R10. Testing approach

**Decision** (same as 001 R8):
- `packages/shared`: Vitest, written first, for `caloriesFor`, `summarize`, `localDate` (five+ zones including a DST day, SC-004), `addDays`, `isEditableDay`, name normalisation, catalog invariants (ids unique, positive numbers, names unique ignoring case), `applyChange` and `buildDayView`.
- `services/api`: handler tests with an in-memory `WorkoutRepo` fake and a fixed clock (window edges, timezone from profile, 409/404 paths, privacy, idempotency).
- `infra`: assertions that the new routes exist and require the JWT authorizer.
- `apps/web`: Vitest for the pure client helpers; end to end via the manual [quickstart.md](quickstart.md) against `dev`.
