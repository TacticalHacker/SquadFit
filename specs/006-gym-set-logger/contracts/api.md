# Contract: HTTP API additions (AWS, `services/api`)

Same conventions as [002's API contract](../../002-workout-tracker/contracts/api.md): only the Next.js server calls the API, every route needs a Cognito access token, the caller comes from verified claims, errors are `{ "error": { "code", "message", "fields?" } }`, every route returns `409 PROFILE_REQUIRED` without a profile and computes `today` from the profile timezone on the server. Request bodies, sets and weights are never logged.

All schemas are zod in `packages/shared/src/contracts/gym.ts` (new) and `workouts.ts` (extended); handlers parse input with them, the web parses output with them (constitution II).

New error code: `LIMIT_REACHED` (409): creating a 51st own exercise. Reused: `VALIDATION_FAILED` (400), `DAY_LOCKED` (409), `DUPLICATE_NAME` (409, "You already have an exercise with that name"), `NOT_FOUND` (404).

## Shared shapes

```ts
MuscleGroupSchema = z.enum(["chest","back","legs","shoulders","arms","core","cardio"])
GymSetSchema      = { setNumber: int ≥1, reps: int 1–100, weightKg: number 0–500, multiple of 0.5, completed: boolean }
GymEntryViewSchema = {
  exerciseId: string, name: string, muscleGroup, exerciseKind: "strength"|"cardio",
  sets: GymSet[] | null,           // null for cardio
  volumeKg: number | null,         // null for cardio
  minutes: int, calories: int, updatedAt: string (ISO)
}
GymLastSchema = { date, sets: GymSet[] | null, minutes: int, top: { weightKg, reps } | null }
GymExerciseSchema = {
  exerciseId, name, group: MuscleGroup, kind: "strength"|"cardio", isBuiltIn: boolean,
  entry: GymEntryView | null, last: GymLast | null
}
GymViewSchema = { date, today, timezone, editable: boolean, exercises: GymExercise[], summary: { totalMinutes, totalCalories } }
```

`summary` is the whole day (workouts + gym), identical to `DayView.summary` for the same date.

## GET /workouts/gym?date=YYYY-MM-DD

Gym tab data. `date` defaults to `today`; after `today` → 400. Response `200 GymView`. `last` is the most recent entry for that exercise with `date < ?date` (research R5); exercises the member never logged have `last: null`. Removed own exercises appear only if they have an entry on that day (with `isBuiltIn: false`).

## PUT /workouts/gym/entries/{date}/{exerciseId}

Save (create or replace) one exercise on one day. Body, by exercise kind:

```json
{ "sets": [ { "setNumber": 1, "reps": 8, "weightKg": 80, "completed": true }, … ] }   // strength, 1–20 sets, setNumber 1..n in order
{ "minutes": 25 }                                                                    // cardio, 1–600
```

The body is `GymEntryPutSchema` (strict: extra keys like `totalVolumeKg`/`calories` are rejected with 400, FR-014). Wrong shape for the exercise's kind → 400. Unknown exercise / not the caller's / removed own exercise with no existing entry that day → 404. Day older than `today−2` → 409 `DAY_LOCKED`; after today → 400.

Response `200 GymView` for `{date}` (so the client replaces its state with server truth).

## DELETE /workouts/gym/entries/{date}/{exerciseId}

Remove that day's entry; idempotent (absent → still 200). Same day rules. Response `200 GymView`.

## Own exercises

| Route | Body | Response |
|---|---|---|
| `POST /workouts/gym/exercises` | `{ name: 1–40 chars, group: MuscleGroup except "cardio" }` | `201 { exercise: GymExercise }` (`entry`/`last` null); 409 `DUPLICATE_NAME` / `LIMIT_REACHED` |
| `PUT /workouts/gym/exercises/{exerciseId}` | same | `200 { exercise }`; 404 if not the caller's or removed; 409 `DUPLICATE_NAME` |
| `DELETE /workouts/gym/exercises/{exerciseId}` | none | `204`; soft remove, idempotent; built-in id → 404 |

## Changes to feature 002 routes

- `GET /workouts` and every 002 entry mutation return `DayView` with two new fields: `gym: GymEntryView[]` (that day's gym entries, oldest first) and `gymMinutes: int`. `summary` now includes gym entries (it already did at the data level; research R12).
- `PUT|DELETE /workouts/entries/{date}/{workoutId}` with a `gx-`/`gc-` id → 404 `NOT_FOUND` (research R2).
- `GET /workouts/summary`: unchanged contract; totals include gym entries.

## Feature 003 / 004

- `GET /food`: unchanged contract; `ledger.burned` includes gym calories.
- MCP `get_user_history`: each `workouts[]` item keeps `{ name, minutes, calories }` and, for gym entries, adds `kind: "gym"`, `muscleGroup`, and for strength `sets: [{ set, reps, kg, done }]`, `volumeKg` (FR-024, research R13).

## Routes in `infra/lib/api-stack.ts`

```ts
route("gym-get",               HttpMethod.GET,    "/workouts/gym");
route("gym-entry-put",         HttpMethod.PUT,    "/workouts/gym/entries/{date}/{exerciseId}", { write: true });
route("gym-entry-delete",      HttpMethod.DELETE, "/workouts/gym/entries/{date}/{exerciseId}", { write: true });
route("gym-exercise-post",     HttpMethod.POST,   "/workouts/gym/exercises", { write: true });
route("gym-exercise-put",      HttpMethod.PUT,    "/workouts/gym/exercises/{exerciseId}", { write: true });
route("gym-exercise-delete",   HttpMethod.DELETE, "/workouts/gym/exercises/{exerciseId}", { write: true });
```

`gym-get` needs read on the `gsi1` index; `table.grantReadData` already covers the table's indexes (assert in the stack test).
