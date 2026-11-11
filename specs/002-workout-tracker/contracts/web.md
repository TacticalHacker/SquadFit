# Contract: Web routes & Server Actions (`apps/web`)

Same session model as [001's web contract](../../001-user-accounts/contracts/web.md): all calls to the AWS API happen on the Next.js server with the user's access token; session is read inside `<Suspense>`; protected routes use `requireProfile()`.

## Routes

| Route | Access | Purpose | Spec |
|---|---|---|---|
| `/workouts` | signed in + profile | Today's checklist and totals; `?date=YYYY-MM-DD` for another day; day navigation and a 7-day strip | US1, US2, US4 |
| `/workouts/mine` | signed in + profile | Add, edit and remove the user's own workouts | US5 |
| `/` | signed in + profile | Redirects to `/workouts` (placeholder home is retired; a dashboard can return later) | |

Navigation (`(app)/layout.tsx`) gets a **Workouts** link first, before People and Settings.

### `/workouts` page behaviour

- `date` is validated (`DateSchema`); an invalid or future date redirects to `/workouts` (today).
- Server component calls `GET /workouts?date=` and `GET /workouts/summary?from=<date−6>&to=<date>`, then renders:
  - **Header**: the date in the user's locale format, "Today" label when `date === today`, ◀ previous link, ▶ next link (hidden on today), "Back to today" link on other days.
  - **Totals card**: total minutes and total calories (FR-011).
  - **Checklist** (client component `WorkoutChecklist`): one row per `rows[]` item with a checkbox (accessible label "Running, 30 minutes, 300 calories"), the minutes field when ticked, calories when ticked, default values when unticked. Removed-custom rows show a "removed" tag.
  - **Read-only banner** when `editable === false`: "This day can no longer be edited" and all controls disabled (FR-017).
  - **7-day strip** of links to `?date=` with each day's minutes/calories (US4).
- `WorkoutChecklist` receives `today` and `timeZone` and refreshes the page on focus, visibility change and every 60 s when `localDate(now, timeZone) !== today` (research R6, FR-018).

### Optimistic updates (research R5)

`useOptimistic` over the day view; each interaction applies `applyChange(view, change)` immediately (same `caloriesFor`/`summarize` as the server), then calls a Server Action inside `startTransition`. On failure the optimistic state is dropped by React and an inline message appears ("Couldn't save. Try again."); on `DAY_LOCKED` the message is "This day can no longer be edited" and the page is refreshed.

## Server Actions (`src/server/actions/workouts.ts`, `"use server"`)

All validate their input with the shared zod schemas, call the API through `apiFetch`, and return `{ ok: true, view } | { ok: false, error }` (for the checklist) or the `ActionState` shape from feature 001 (for forms). `UnauthorizedError` redirects to `/sign-in`; `PROFILE_REQUIRED` redirects to `/setup`.

| Action | Calls | Notes |
|---|---|---|
| `tickWorkout(date, workoutId)` | `PUT /workouts/entries/{date}/{workoutId}` (no body) | Default minutes |
| `untickWorkout(date, workoutId)` | `DELETE /workouts/entries/{date}/{workoutId}` | |
| `setEntryMinutes(date, workoutId, minutes)` | `PUT … { minutes }` | Client also validates 1–600 whole number and shows "Minutes must be a whole number from 1 to 600" |
| `createCustomWorkout(prev, formData)` | `POST /workouts/custom` | `revalidatePath("/workouts", "layout")` |
| `updateCustomWorkout(prev, formData)` | `PUT /workouts/custom/{id}` | |
| `removeCustomWorkout(id)` | `DELETE /workouts/custom/{id}` | |

### `/workouts/mine` page behaviour

- Lists the user's active custom workouts (needs the list: reuse `GET /workouts` rows where `!isStandard && !removed`) with one inline form each (name, default minutes, default calories; **Save**, **Remove**), and an **Add workout** form at the top. Standard workouts are not listed here (FR-022).
- Field errors from the API (`fields`) are shown under the inputs; `DUPLICATE_NAME` appears under the name field.
