# Contract: Web UI (`apps/web`)

Read `node_modules/next/dist/docs/` before writing Next code (apps/web/AGENTS.md). The browser never calls the AWS API; reads happen in Server Components, writes in Server Actions (`src/server/actions/gym.ts`), as in features 002/003.

## Routes

| Route | What |
|---|---|
| `/workouts` | Unchanged page + `WorkoutsTabs` ("Activities \| Gym"). "Logged today" lists gym entries (name, `3 sets · 1,920 kg` or `25 min`, kcal) linking to `/workouts/gym?date=D&open=<exerciseId>`. Strength training card shows `Logged in Gym: N min` when `gymMinutes > 0` (FR-025). |
| `/workouts/gym?date=&open=` | Gym tab. Reads session inside `<Suspense>`. Fetches `GymView` (and the 7-day strip like `/workouts`). `open` (an exercise id in the view) opens its drawer on load. Invalid `date` → redirect to `/workouts/gym`. |

## Components (new)

| Component | Kind | Notes |
|---|---|---|
| `WorkoutsTabs` | server | Two links, keeps `?date=`; `aria-current="page"`. |
| `GymScreen` | client | Holds `GymView` state, the selected group, search text, open exercise; renders pill bar, list, drawer. |
| `MusclePills` | client | `sticky top-0 overflow-x-auto no-scrollbar snap-x`; 7 pills, ≥ 44 px tall; selected pill scrolled into view. |
| `ExerciseSearch` | client | `type="search"`, `text-base`, clears with ×; matches names across all groups (`filterExercises` in shared). |
| `ExerciseList` | client | Rows ≥ 56 px tall; logged badge `3 sets · 1,920 kg`; `Draft` badge when a local draft exists; `+ Custom Exercise` row at the end. |
| `BottomSheet` | client | Research R9. Props: `open`, `onClose`, `header`, `footer`, `children`. |
| `GymDrawer` | client | Uses `drawerReducer`; header: name, group, `Last: 80kg × 8`; body: Sets + Default Reps steppers, set rows (or minutes stepper for cardio); footer: Volume · ~min · ~kcal from `gymTotals`, **Save** (primary, full width), **Remove** (if saved), **Discard draft** (if draft). Read-only when `!editable`. |
| `Stepper` | client | `[−] value [+]`; buttons `min-h-11 min-w-11 touch-manipulation`; value is a `NumberField`. |
| `NumberField` | client | Tap-to-type; `inputMode` decimal/numeric, `text-base`, `enterKeyHint="done"`; parses with shared `parseWeight`/`parseReps`/`parseMinutes`; invalid → message + revert. |
| `CustomExerciseForm` | client | Name + group select (no Cardio); used in a `BottomSheet` from `+ Custom Exercise`, and for edit/remove from a long-press-free "Edit" link on own rows. |

## Server Actions (`src/server/actions/gym.ts`)

`saveGymEntry(date, exerciseId, body)`, `removeGymEntry(date, exerciseId)`, `createGymExercise(input)`, `updateGymExercise(id, input)`, `removeGymExercise(id)`. Each validates input with the shared schema, calls `apiFetch`, parses the response, and returns `{ ok: true, result } | { ok: false, code, message, fields? }` (`result` is `GymSaveResult` for entry actions, `{ exercise }` for exercise actions). A `DAY_LOCKED` result makes the drawer read-only and keeps the draft until the member discards it (it is dropped on next load anyway).

## Drafts (`src/lib/gym-draft.ts`)

`loadDraft`, `saveDraft` (debounced 300 ms), `clearDraft`, `listDraftKeys`, `pruneDrafts(today)`; all wrapped in try/catch (storage can be unavailable: then drafts are simply off). Key/shape in [data-model](../data-model.md#draft-browser-localstorage-never-sent-to-the-server). `username` comes from `getMe()` passed to `GymScreen`.

## Global

- `globals.css`: `.no-scrollbar` utility.
- Root `viewport` export: `interactiveWidget: "resizes-content"` (research R9) if not already set; do not set `maximumScale` / `userScalable` (accessibility).
