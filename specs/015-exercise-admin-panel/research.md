# Research: Exercise Admin Panel (015)

## R1. How a member is marked admin

- **Decision**: A Cognito user-pool group `admin` (CDK `CfnUserPoolGroup` in `auth-stack.ts`). The access token carries `cognito:groups`; `getCaller` reads it into `Caller.isAdmin`. The operator manages it with `pnpm admin admins add|remove <username>` and `pnpm admin admins list` (`AdminAddUserToGroup`, `AdminRemoveUserFromGroup`, `ListUsersInGroup`).
- **Claim format**: the HTTP API JWT authorizer passes array claims as a string such as `"[admin]"` (or `"[admin other]"`); a real array is also accepted. `isAdminClaim(value)` handles both and is unit-tested.
- **Revocation**: the access token lives 60 minutes (`accessTokenValidity`), and the web refreshes it through `sf_rt`; a removed member loses access on the next refresh, ≤ 1 h (FR-015). Acceptable for a two-person admin list.
- **Alternatives rejected**: an `isAdmin` attribute on the DynamoDB profile (one more read per admin call, and the profile is member-editable through `PUT /me/profile` code paths, so a mistake there could escalate privileges); an env-var allow-list of usernames (needs a deploy to change, the very thing this feature removes).

## R2. Where catalog exercises are stored

- **Decision**: One partition in the existing table: `pk = GYMCATALOG`, `sk = EX#<exerciseId>`, plus a name guard `pk = GYMCATALOGNAME#<normalized name>`, `sk = N`. Create = one transaction (put exercise `attribute_not_exists`, put guard `attribute_not_exists`). Rename = one transaction (delete old guard, put new guard, update exercise conditional on `updatedAt`). Retired exercises keep their guard so the name stays reserved (spec edge case).
- **Rationale**: Same single-table pattern as the waitlist guard (feature 009); a single `Query` on `GYMCATALOG` returns the whole catalog (≤ 200 items, a few KB).
- **Alternatives rejected**: S3 JSON file or SSM parameter (no conditional writes, second store to secure); a GSI on name (unneeded for ≤ 200 rows).

## R3. Catalog ids

- **Decision**: `gx-<slug>` where slug = lowercase name with non-alphanumerics turned into `-` (e.g. "Cable Kickback" → `gx-cable-kickback`). If the id is a built-in id or already exists in the catalog, append `-2`, `-3`, … The exercise put is conditional on `attribute_not_exists(pk)`, so a race retries with the next suffix. Ids never change on rename (FR-002).
- **Rationale**: Keeps `isGymId` (`gx-`/`gc-`), the 002 404 rule, the MCP description ("gx-..., gc-...") and every key pattern (`ENTRY#<date>#<id>`, `GYM#<sub>#<id>`) working unchanged.
- **Alternatives rejected**: `gk-<uuid>` (a new prefix to teach every check, the AI tool text and the web); random `gx-<uuid>` (ugly in logs-free debugging and CLI output).

## R4. Reading the library at runtime

- **Decision**: `services/api/src/lib/gym-library.ts` exports `getLibrary(deps): Promise<GymLibrary>`, a module-level cache per Lambda container with a 2-minute TTL, filled by one `Query` (`deps.catalog.list()`). Admin writes call `invalidateLibrary()` in their own container. On a read error it serves the stale value if any, otherwise built-ins only for 30 s, and logs the error name only.
- **Rationale**: Members see changes within 2 minutes plus Lambda reuse, under the 5-minute target (FR-006), at the cost of one small query per container every 2 minutes (SC-005).
- **Alternatives rejected**: reading the catalog on every request (adds a query to every gym load and MCP write); no cache invalidation at all (admins would not see their own add immediately in the panel; the panel reads uncached anyway).

## R5. Making the shared logic catalog-aware

- **Decision**: Built-ins stay as `GYM_EXERCISES`. New pure helpers in `packages/shared/src/domain/gym.ts`:
  - `type GymLibrary = readonly GymExerciseDef[]` and `buildLibrary(catalog)` = built-ins + active catalog strength items in name order (built-ins of a group come first in the picker because `filterExercises` keeps list order).
  - `findGymExercise(id, library)`, `isExerciseNameTaken(name, others, library)` and `findGymExerciseByName(name, own, library)` take the library explicitly (no default, so no caller silently ignores the catalog). `buildGymView` input gains `library`.
  - `isLibraryNameTaken(name, catalogAll)` for admin creates/renames: built-ins + every catalog row including retired.
- **Callers updated**: `gym-save.ts` (retired catalog exercise is not in the library, so it falls back to the day's existing snapshot exactly like a removed own exercise; FR-009), `gym-view-loader.ts`, `own-exercises.ts`, MCP `writes.ts` (id check, name match, "close matches"), `infra/scripts/gym-merge.ts`. `boards.ts` keeps using built-ins only (PR-jump and Big-3 ids are built-in by definition).
- `GymExerciseView.isBuiltIn` is `true` for catalog items (members can't edit them); `GymExerciseDef` gains optional `source: "catalog"` for the admin panel only.

## R6. Admin API authorization

- **Decision**: Normal Cognito-authorized routes under `/admin/...`; every handler starts with `requireAdmin(caller)` → `403 FORBIDDEN` "Admins only". The web page `/settings/admin` calls `getMe()` and `notFound()` when `isAdmin` is false; the Settings link renders only when `me.isAdmin`. `MeResponse` gains `isAdmin: boolean` (the caller's own flag, from the token).
- **Tests**: one handler test per route for the 403, plus the happy path (constitution III lean tests).

## R7. Merge from the panel

- **Decision**: Move the core of `infra/scripts/gym-merge.ts` into `services/api/src/lib/gym-merge.ts` (`mergeOwnExercises(targetDef, sourceIds, deps)`) using new `GymRepo` methods (`listEntriesByExercise`, `moveEntry` transaction, `retireOwnExercise(mergedInto)`), so the CLI and the handler share one implementation. Matches are found with `profiles.listCommunity()` → `gym.listOwnExercises()` per member, comparing `normalizeWorkoutName`. After a member's days move, `safeRefresh` rebuilds their squad stats/feed (FR-018). The panel shows counts only (FR-017).
- **Limits**: the merge function gets `timeoutSeconds: 60`; the squad is tens of members. Re-running finds no remaining own exercises (they are marked `removedAt`) and moves nothing.
- **Target**: any library strength exercise (built-in or active catalog). The CLI gains catalog targets for free.

## R8. Web panel

- **Decision**: `/settings/admin` (Server Component inside `<Suspense>`, Server Actions for writes, like the rest of Settings). One list grouped by muscle group: built-ins read-only with a lock icon, catalog rows with Rename/Group/Retire/Restore in a `BottomSheet`, "N members have their own" + **Merge** where N > 0. Add form at the top (name + group `segmentClass`). Uses `form-bits.tsx` classes and lucide icons; no new dependencies.

## R9. Logging and privacy

- Admin handlers log only error names and counts (FR-020). Exercise names are not personal data, but member ids, own-exercise names and lifting data are never logged; `GET /admin/exercises` returns counts, never member ids.
