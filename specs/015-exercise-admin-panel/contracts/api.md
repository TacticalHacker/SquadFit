# API Contracts: Exercise Admin Panel (015)

Schemas live in `packages/shared/src/contracts/admin-exercises.ts` (zod, strict). All routes use the Cognito authorizer; every `/admin/*` handler returns `403 FORBIDDEN` ("Admins only") unless `Caller.isAdmin`.

## Changed: `GET /me`

`MeResponse` gains `isAdmin: boolean` (the caller's own flag). Never present in any view of another member.

## `GET /admin/exercises`

Response `AdminExercisesResponse`:

```ts
{
  builtIn: { exerciseId, name, group, kind }[],              // read-only
  catalog: {
    exerciseId, name, group, kind: "strength",
    status: "active" | "retired",
    createdAt, createdBy, updatedAt, updatedBy,
  }[],
  ownMatches: Record<string /* library exerciseId */, number /* members with a same-name own exercise */>,
  memberExercises: { name, group, members, days }[], // Story 6: own exercises not in the library, grouped by name; counts only
  limit: 200,
}
```

Counts only: never member ids, usernames or own-exercise ids.

## `POST /admin/exercises`

Body `{ name: string, group: "chest"|"back"|"legs"|"shoulders"|"arms"|"core" }`.

- `201 { exercise: CatalogExercise }`
- `400 VALIDATION_FAILED` (name 1–40, group not cardio)
- `409 DUPLICATE_NAME` "An exercise with this name already exists"
- `409 CATALOG_FULL` "The library is full (200 exercises)"

## `PUT /admin/exercises/{exerciseId}`

Body `{ updatedAt: string, name?: string, group?: Group, status?: "active" | "retired" }` (at least one change).

- `200 { exercise: CatalogExercise }`
- `404 NOT_FOUND` (not a catalog id; built-ins are not editable)
- `409 DUPLICATE_NAME`, `409 STALE` "Someone else changed this exercise; reload"

## `POST /admin/exercises/{exerciseId}/merge`

`exerciseId` is any library strength exercise (built-in or active catalog). No body.

- `200 { members: number, moved: number, skipped: number, removed: number }`
- `404 NOT_FOUND` (unknown, cardio or retired target)

Moves every member's same-name own exercise days onto the target (research R7), then refreshes their squad stats. Safe to repeat.

## `POST /admin/users` (Story 5)

Body `{ username: string }` (`UsernameSchema`, 3–20 letters, digits, underscores). Schemas in `contracts/admin-exercises.ts` (`AdminUserInputSchema`, `AdminUserCreatedSchema`).

- `201 { username, temporaryPassword }`: shown once; the member must set a new password at first sign-in
- `400 VALIDATION_FAILED`
- `409 USERNAME_TAKEN` "Username is taken"

The function alone gets `USER_POOL_ID` and `cognito-idp:AdminCreateUser` on this pool (FR-023). Nothing about the request is logged.

## Changed behavior (no shape change)

- `GET /workouts/gym`: `exercises` includes active catalog items (`isBuiltIn: true`) after the built-ins.
- `PUT|DELETE /workouts/gym/entries/{date}/{exerciseId}`: accepts catalog ids; a retired catalog id saves only on a day that already has an entry for it.
- `POST|PUT /workouts/gym/exercises`: `409 DUPLICATE_NAME` also for catalog names.
- MCP `upsert_workout_log`: matches catalog ids and exact names; "Close matches" include catalog names.

## Operator CLI

```
pnpm admin admins add <username>      # add to the Cognito group "admin"
pnpm admin admins remove <username>
pnpm admin admins list
pnpm admin gym merge <gx-id> <gc-id>... [--dry-run]   # now also accepts catalog targets
```
