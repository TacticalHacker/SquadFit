---
description: "Task list for feature 015: Exercise Admin Panel"
---

# Tasks: Exercise Admin Panel

**Input**: Design documents from `/specs/015-exercise-admin-panel/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Required by constitution III (lean rule): failing tests first for new pure domain functions, and per handler only authorization + one happy path + the one or two rejections that matter. No UI, copy or schema-limit tests.

**Organization**: Grouped by user story. US1 and US2 are both P1 and ship together as the MVP (adding without access control is not shippable).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Add the Cognito group in `infra/lib/auth-stack.ts`: `new CfnUserPoolGroup(this, "AdminGroup", { userPoolId: this.userPool.userPoolId, groupName: "admin", description: "SquadFit admins (feature 015)" })`; add an assertion in the existing auth-stack test under `infra/test/` that a `AWS::Cognito::UserPoolGroup` with `GroupName: "admin"` exists

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the library abstraction, the catalog store and the admin identity, used by all stories.

- [X] T002 [P] Write failing tests in `packages/shared/test/gym-library.test.ts` for: `buildLibrary(catalog)` returns all `GYM_EXERCISES` first, then **active** catalog items sorted by name (retired excluded, `source: "catalog"`); `catalogId(name, takenIds)` → `"gx-cable-kickback"` for "Cable Kickback", `"gx-bench-press-2"` when `gx-bench-press` is taken; `isLibraryNameTaken("bench  PRESS", [])` true, `isLibraryNameTaken("Cable Kickback", [{ name: "cable kickback", status: "retired" }])` true (retired names stay reserved), false for a new name; `isExerciseNameTaken(name, others, library)` true for an active catalog name
- [X] T003 Implement in `packages/shared/src/domain/gym.ts`: `export type GymLibrary = readonly GymExerciseDef[]`; add optional `source?: "catalog"` to `GymExerciseDef`; `CatalogExerciseSchema` (zod: `exerciseId` matching `^gx-[a-z0-9-]+$`, `name` via `ExerciseNameSchema` (1–40, trimmed, inner spaces collapsed), `group` = `MuscleGroupSchema` excluding `"cardio"`, `kind: "strength"`, `status: "active" | "retired"`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`); `buildLibrary(catalog)`, `catalogId(name, takenIds)` (lowercase, non-alphanumerics → `-`, trimmed dashes, suffix `-2`, `-3`… while taken; built-in ids always count as taken), `isLibraryNameTaken(name, catalogAll)`; change `findGymExercise(id, library)`, `isExerciseNameTaken(name, existingNames, library)`, `findGymExerciseByName(name, own, library)` to take the library explicitly (no default), and add `library: GymLibrary` to the `buildGymView` input, iterating it instead of `GYM_EXERCISES` (catalog items get `isBuiltIn: true`). Export new names from `packages/shared/src/index.ts`. Make T002 pass and update existing callers in `packages/shared/test/gym.test.ts` and `gym-view.test.ts` to pass `GYM_EXERCISES` (signature-only change, no new assertions)
- [X] T004 [P] Write failing tests in `services/api/test/auth.test.ts` for `isAdminClaim`: `"[admin]"` true, `"[admin other]"` true, `["admin"]` true, `"[administrator]"` false, `undefined` false
- [X] T005 Extend `services/api/src/lib/auth.ts`: `Caller.isAdmin: boolean` from `claims["cognito:groups"]` via exported `isAdminClaim(value: unknown)` (string `"[a b]"` form from the HTTP API JWT authorizer, or an array); `requireAdmin(caller)` returning `apiError(403, "FORBIDDEN", "Admins only")` or `null`. Make T004 pass. Update the claim builder in the API test helpers (wherever events are built, e.g. `services/api/test/fakes.ts` or `gym-helpers.ts`) with an option to add `cognito:groups`
- [X] T006 Create `services/api/src/lib/catalog-repo.ts`: `interface CatalogRepo { list(): Promise<CatalogExercise[]>; create(item): Promise<"ok" | "duplicate" | "id_taken">; update(id, expectedUpdatedAt, patch: { name?; group?; status? }, by, nowIso): Promise<{ ok: true; item } | { ok: false; reason: "not_found" | "stale" | "duplicate" }> }` and `DynamoCatalogRepo` per data-model.md: items `pk = "GYMCATALOG", sk = "EX#<exerciseId>"` and guards `pk = "GYMCATALOGNAME#<normalizeWorkoutName(name)>", sk = "N"`; create = `TransactWrite` (both puts `attribute_not_exists(pk)`; map the cancellation reason index to `id_taken` vs `duplicate`); rename = transaction (delete old guard, put new guard `attribute_not_exists`, update item conditional on `updatedAt = :expected`); group/status-only update = conditional `UpdateCommand`. Add `catalog: CatalogRepo` to `Deps` in `services/api/src/lib/deps.ts`
- [X] T007 Add `InMemoryCatalogRepo` to `services/api/test/fakes.ts` with the same create/update/duplicate/stale semantics, wired into the fake `deps` and returned from the factory
- [X] T008 Create `services/api/src/lib/gym-library.ts`: `getLibrary(deps): Promise<GymLibrary>` caching per `deps.catalog` instance in a `WeakMap` (so tests with fresh fakes never share a cache), TTL 2 minutes; on a `list()` error serve the stale value if any, else `GYM_EXERCISES` cached for 30 s, logging only `err.name`; `invalidateLibrary(deps)`. One test in `services/api/test/gym-library.test.ts`: a catalog whose `list()` throws still yields every built-in
- [X] T009 Switch library consumers to `getLibrary(deps)`: `services/api/src/lib/gym-save.ts` (`findGymExercise(exerciseId, library)`; a retired catalog id is absent, so it falls back to the day's existing snapshot like a removed own exercise, else 404), `services/api/src/lib/gym-view-loader.ts` (`buildGymView({ ..., library })`), `services/api/src/lib/own-exercises.ts` (`isExerciseNameTaken(..., library)`), `services/api/src/lib/mcp/writes.ts` (id check, `findGymExerciseByName(..., library)`, "Close matches" from `library` names), and `infra/scripts/gym-merge.ts` (target lookup over `buildLibrary(await catalog.list())`). Leave `packages/shared/src/domain/boards.ts` on `GYM_EXERCISES`. `pnpm check` must pass with no behavior change

**Checkpoint**: with an empty catalog the app behaves exactly as today.

---

## Phase 3: User Story 1 – Admin adds an exercise for everyone (P1) 🎯 MVP

**Goal**: an admin adds a strength exercise; every member sees and logs it within 5 minutes; the AI agent logs it by name.

**Independent Test**: quickstart §3.

### Tests (write first, must fail)

- [X] T010 [P] [US1] In `services/api/test/admin-exercises.test.ts`: `POST /admin/exercises` as admin with `{ name: "Cable Kickback", group: "arms" }` → 201 with `exerciseId: "gx-cable-kickback"`, `status: "active"`; `{ name: "bench  press", group: "chest" }` → 409 `DUPLICATE_NAME`; as non-admin → 403 `FORBIDDEN`. `GET /admin/exercises` as non-admin → 403
- [X] T011 [P] [US1] In `services/api/test/gym-entry.test.ts` (or `gym-get.test.ts`): after seeding the fake catalog with an active `gx-cable-kickback`, `GET /workouts/gym` lists it with `isBuiltIn: true` and `PUT /workouts/gym/entries/{date}/gx-cable-kickback` with sets saves; member `POST /workouts/gym/exercises` with name "cable kickback" → 409 `DUPLICATE_NAME`
- [X] T012 [P] [US1] In `services/api/test/mcp-upserts.test.ts`: `upsert_workout_log` with `exercise: "cable kickback"` saves under `gx-cable-kickback`

### Implementation

- [X] T013 [P] [US1] Create `packages/shared/src/contracts/admin-exercises.ts`: `AdminExerciseInputSchema` (strict `{ name: ExerciseNameSchema, group: MuscleGroup except "cardio" }`), `AdminExercisePatchSchema` (strict `{ updatedAt: string, name?, group?, status?: "active"|"retired" }`, refine at least one change), `AdminExerciseResponseSchema` (`{ exercise: CatalogExerciseSchema }`), `AdminExercisesResponseSchema` (strict `{ builtIn: { exerciseId, name, group, kind }[], catalog: CatalogExercise[], ownMatches: Record<string, number>, limit: 200 }`), `AdminMergeResponseSchema` (`{ members, moved, skipped, removed }` non-negative ints); export from `packages/shared/src/index.ts`
- [X] T014 [US1] Create `services/api/src/handlers/admin-exercise-post.ts` (`handle(event, deps)` + `handler`): `requireAdmin` → parse `AdminExerciseInputSchema` → `catalog.list()`; if `length >= 200` → 409 `CATALOG_FULL` "The library is full (200 exercises)"; if `isLibraryNameTaken` → 409 `DUPLICATE_NAME` "An exercise with this name already exists"; `catalogId(name, ids)` → `create` (retry with the next suffix on `id_taken`, 409 on `duplicate`) with `createdBy/updatedBy = caller.username`; `invalidateLibrary(deps)`; 201. Log only error names
- [X] T015 [US1] Create `services/api/src/handlers/admin-exercises-get.ts`: `requireAdmin` → `{ builtIn: GYM_EXERCISES mapped, catalog: await catalog.list() (uncached), ownMatches: {} , limit: 200 }` (ownMatches filled in US4). Make T010 pass
- [X] T016 [US1] Register routes in `infra/lib/api-stack.ts`: `route("admin-exercises-get", HttpMethod.GET, "/admin/exercises")`, `route("admin-exercise-post", HttpMethod.POST, "/admin/exercises", { write: true })`; confirm `pnpm synth`
- [X] T017 [US1] Make T011 and T012 pass (fixes in the T009 consumers if needed)
- [X] T018 [P] [US1] Add `apps/web/src/server/admin-actions.ts` (`"use server"`): `listAdminExercises()` via `apiFetch` parsed with `AdminExercisesResponseSchema`; `addExercise(prev, formData)` posting `{ name, group }`, returning field errors / the 409 message, then `revalidatePath("/settings/admin")`
- [X] T019 [US1] Create `apps/web/src/app/(app)/settings/admin/page.tsx` (session read inside `<Suspense>`; `getMe()` and `notFound()` unless `me.isAdmin`) and `apps/web/src/components/admin-exercises.tsx`: an add form at the top (name `inputClass`, group as a `segmentClass` control without Cardio, one `buttonClass` "Add exercise"), then the library grouped by muscle group (built-ins with a lucide `Lock` icon size 16 `strokeWidth={1.75}`, catalog rows with status). Read `node_modules/next/dist/docs/` before writing Next code (apps/web/AGENTS.md)

**Checkpoint**: an admin (set by hand in Cognito for now) can add an exercise; members log it.

---

## Phase 4: User Story 2 – Only admins can manage the library (P1)

**Goal**: operator grants admin; only admins see the link and can act.

**Independent Test**: quickstart §1–2.

- [X] T020 [P] [US2] Add `isAdmin: z.boolean()` to `MeResponseSchema` in `packages/shared/src/contracts/me.ts`; set it from `caller.isAdmin` in `services/api/src/handlers/me-get.ts`; one assertion in `services/api/test/me-get.test.ts` (true with the group claim, false without)
- [X] T021 [P] [US2] Add `pnpm admin admins add|remove <username>` and `pnpm admin admins list` to `infra/scripts/admin.ts` using `AdminAddUserToGroupCommand`, `AdminRemoveUserFromGroupCommand`, `ListUsersInGroupCommand` with `GroupName: "admin"` (region from `infra/lib/config.ts`, existing pool-id lookup); print usernames only; update the usage text at the top of the file
- [X] T022 [US2] In `apps/web/src/app/(app)/settings/page.tsx`, render an "Admin" row/link to `/settings/admin` (lucide `Shield`, size 18, `strokeWidth={1.75}`) only when `me.isAdmin`
- [X] T023 [US2] Verify the web token refresh path (`apps/web/src/proxy.ts` / Cognito client) keeps working with the group claim (no code change expected; note in quickstart if sign-out is needed after granting)

**Checkpoint (MVP)**: US1 + US2 deployable.

---

## Phase 5: User Story 3 – Rename, regroup, retire, restore (P2)

**Goal**: admins fix and retire catalog exercises without touching history.

**Independent Test**: quickstart §4.

- [X] T024 [P] [US3] Tests in `services/api/test/admin-exercises.test.ts`: `PUT /admin/exercises/gx-cable-kickback` rename with the current `updatedAt` → 200 and `GET /workouts/gym` shows the new name; a stale `updatedAt` → 409 `STALE`; `PUT /admin/exercises/gx-bench-press` → 404; non-admin → 403
- [X] T025 [P] [US3] Test in `services/api/test/gym-entry.test.ts`: retire `gx-cable-kickback`; a PUT on a day that already has its entry → 200 (keeps snapshot); a PUT on a new day → 404; `GET /workouts/gym` for a day without an entry does not list it
- [X] T026 [US3] Create `services/api/src/handlers/admin-exercise-put.ts`: `requireAdmin` → parse `AdminExercisePatchSchema` → 404 unless a catalog id; on rename check `isLibraryNameTaken` against built-ins and catalog rows other than itself → 409 `DUPLICATE_NAME`; `catalog.update(...)` mapping `stale` → 409 `STALE` "Someone else changed this exercise; reload"; `invalidateLibrary`; 200. Register `route("admin-exercise-put", HttpMethod.PUT, "/admin/exercises/{exerciseId}", { write: true })` in `infra/lib/api-stack.ts`. Make T024 and T025 pass
- [X] T027 [US3] Web: `updateExercise` Server Action in `apps/web/src/server/admin-actions.ts`; in `apps/web/src/components/admin-exercises.tsx` tapping a catalog row opens a `BottomSheet` (header close is `<SheetClose />`) with name, group, **Retire** / **Restore** (`secondaryButtonClass`), and **Save** (`buttonClass`); show created/updated by + date; retired rows dimmed (`text-faint`) with a "Retired" chip

---

## Phase 6: User Story 4 – Merge members' own copies (P3)

**Goal**: one-tap merge of same-name own exercises into a library exercise, counts only.

**Independent Test**: quickstart §5.

- [X] T028 [US4] Add to `services/api/src/lib/gym-repo.ts` (and the in-memory fake): `listEntriesByExercise(userId, exerciseId)` (gsi1 `GYM#<sub>#<id>`), `moveEntry(userId, entry, target: { id, name, group })` (transaction: put the new `ENTRY#<date>#<targetId>` item with `gsi1pk = GYM#<sub>#<targetId>`, `workoutId`, `name`, `muscleGroup` changed and everything else (sets, `updatedAt`, `aiNote`, `jumpConfirmedAt`) unchanged, `attribute_not_exists`; delete the old item `attribute_exists`; returns `"moved" | "conflict"`), `markOwnExerciseMerged(userId, sourceId, targetId, nowIso)` (`removedAt = if_not_exists(removedAt, :now)`, `mergedInto`)
- [X] T029 [US4] Create `services/api/src/lib/gym-merge.ts`: `findOwnMatches(library, deps)` → `Map<libraryId, { userId, exerciseId }[]>` over `profiles.listCommunity()` × `gym.listOwnExercises()` (active own exercises, `normalizeWorkoutName` equality, strength library items only); `mergeInto(target, sources, deps)` → moves every day, keeps the own exercise when any day conflicted, calls `safeRefresh` per affected member, returns `{ members, moved, skipped, removed }`. Rewrite `infra/scripts/gym-merge.ts` as a thin wrapper over `mergeInto` (keep `--dry-run` by counting entries without moving)
- [X] T030 [P] [US4] Test in `services/api/test/admin-merge.test.ts`: a member with own "Cable Kickback" (`gc-1`) logged on two days, one of which already has `gx-cable-kickback` → `POST /admin/exercises/gx-cable-kickback/merge` returns `{ members: 1, moved: 1, skipped: 1, removed: 0 }` and the moved day's sets are unchanged; second call moves nothing; non-admin → 403
- [X] T031 [US4] Create `services/api/src/handlers/admin-exercise-merge-post.ts` (`requireAdmin`; target must be an active strength library exercise else 404; `mergeInto`); fill `ownMatches` counts (number of members per library id) in `admin-exercises-get.ts`. Register `route("admin-exercise-merge-post", HttpMethod.POST, "/admin/exercises/{exerciseId}/merge", { write: true, timeoutSeconds: 60 })` in `infra/lib/api-stack.ts`. Make T030 pass
- [X] T032 [US4] Web: `mergeExercise` Server Action; in `apps/web/src/components/admin-exercises.tsx` rows with `ownMatches[id] > 0` show "N members have their own" and a **Merge** button with a confirm `BottomSheet`; show the result counts in a `noticeSuccessClass` notice

---

## Phase 6b: User Story 5 – Admin creates a member account (P2)

**Goal**: admins create accounts from the panel; temporary password shown once.

**Independent Test**: spec Story 5.

- [X] T036 [US5] Move `generateTempPassword` to `services/api/src/lib/temp-password.ts`; `infra/scripts/temp-password.ts` re-exports it (CLI and its test unchanged)
- [X] T037 [US5] `services/api/src/lib/user-directory.ts`: `UserDirectory.create(username, tempPassword): Promise<"ok" | "taken">` with `CognitoUserDirectory` (`AdminCreateUser`, `MessageAction: SUPPRESS`, `UsernameExistsException` → `"taken"`); `users` in `Deps` (lazy, `USER_POOL_ID`); in-memory fake (case-insensitive) in `test/fakes.ts`; add `@aws-sdk/client-cognito-identity-provider` to `services/api`
- [X] T038 [P] [US5] `AdminUserInputSchema` / `AdminUserCreatedSchema` in `packages/shared/src/contracts/admin-exercises.ts`; error code `USERNAME_TAKEN`
- [X] T039 [US5] Test then handler `services/api/src/handlers/admin-user-post.ts`: admin → 201 with a 16-char password; `ALICE` after `alice` → 409 `USERNAME_TAKEN`; non-admin → 403 and nothing created
- [X] T040 [US5] `infra/lib/api-stack.ts`: `route("admin-user-post", HttpMethod.POST, "/admin/users")` with `USER_POOL_ID` env and `userPool.grant(fn, "cognito-idp:AdminCreateUser")` only; stack test asserts the route and that no other function has a `cognito-idp` permission
- [X] T041 [US5] Web: `createMember` Server Action; a "Members" section at the top of `/settings/admin` (`components/admin-members.tsx`): username input + "Create account", then a one-time card with username, temporary password and a Copy button

---

## Phase 6c: User Story 6 – Member-made exercises, make global (P3)

- [X] T042 [US6] `memberExercises()` in `services/api/src/lib/gym-merge.ts` (own exercises not taken by the library or any catalog row, grouped by `exerciseNameKey`, members + logged days, most common spelling/group); `memberExercises` in `AdminExercisesResponseSchema` and `GET /admin/exercises`
- [X] T043 [US6] Test in `services/api/test/admin-merge.test.ts`: two members' "Zercher Squat"/"zercher-squat" → one row (2 members, 2 days, no user ids); create + merge moves both and empties the list
- [X] T044 [US6] Web: `promoteExercise` Server Action (create, then merge); "Member-made" tab on `/settings/admin` (`?tab=member-made`, `components/admin-member-exercises.tsx`) with a Make global sheet (group picker); `SegmentLinks` takes any number of options

- [X] T045 [US6] Test first, then `suggestLibraryMatch` in `packages/shared/src/domain/exercise-match.ts` (DB Bench → Flat Dumbbell Press, EZ Bar Curls → EZ-Bar Curl; none for Bulgarian Split Squat, Smith Machine shoulder press, Bicep Curl)
- [X] T046 [US6] `suggestion` on each `memberExercises` row; merge route accepts `{ sourceName }` (`ownByName`); test merging "DB Bench" into Flat Dumbbell Press
- [X] T047 [US6] Web: suggested-match line with one-tap Merge, "Merge into…"/"Other…" picker sheet (auto-focused search, Enter = first result) with direction + impact confirm, "Add to library"

---

## Phase 7: Polish & cross-cutting

- [X] T033 [P] Add an "Exercise admin (feature 015)" section to `CLAUDE.md`: admin = Cognito group `admin` (`pnpm admin admins add|remove|list`), `/settings/admin`, `/admin/*` routes, `GYMCATALOG`/`GYMCATALOGNAME#` items, `getLibrary` (2-min cache; always pass the library, never `GYM_EXERCISES`, except boards), retired = hidden not deleted, merge service shared with the CLI, never log member data
- [X] T034 Run `pnpm check` and `pnpm synth`; fix anything failing
- [ ] T035 Walk through `specs/015-exercise-admin-panel/quickstart.md` on dev after `pnpm deploy:dev` and `pnpm admin admins add roshan` / `nikhil`

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → stories. T003 blocks T009; T005–T008 block every handler.
- US1 and US2 are independent of each other after Phase 2 but ship together (MVP).
- US3 depends on US1's catalog contracts (T013) and panel (T019).
- US4 depends on US1 (T013, T015, T019); independent of US3.
- Polish last.

## Parallel Opportunities

- Phase 2: T002 ∥ T004 (different packages); T006 ∥ T007 after T003.
- US1: T010 ∥ T011 ∥ T012 ∥ T013 ∥ T018.
- US2: T020 ∥ T021.
- US3: T024 ∥ T025.
- US4: T030 can be written alongside T028.

## Implementation Strategy

1. Phases 1–2, verify nothing changed with an empty catalog.
2. US1 + US2 → deploy dev, grant roshan and nikhil → MVP.
3. US3, then US4, each deployable on its own.
