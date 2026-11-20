# Data Model: Exercise Admin Panel (015)

All items live in the existing single table (`pk`/`sk`, `gsi1pk`/`gsi1sk`).

## Catalog exercise

| Attribute | Value |
|---|---|
| `pk` | `GYMCATALOG` |
| `sk` | `EX#<exerciseId>` |
| `exerciseId` | `gx-<slug>[-n]`, permanent (research R3) |
| `name` | 1–40 chars, trimmed, inner spaces collapsed (`ExerciseNameSchema`) |
| `group` | `chest`, `back`, `legs`, `shoulders`, `arms`, `core` (never `cardio`) |
| `kind` | `strength` |
| `status` | `active` \| `retired` |
| `createdAt`, `createdBy` | ISO time, admin username |
| `updatedAt`, `updatedBy` | ISO time, admin username; every write is conditional on the `updatedAt` the admin read (409 `STALE` otherwise) |

**State transitions**: `active` → `retired` (Retire) → `active` (Restore). No delete.

**Limits**: ≤ 200 items in the partition (active + retired), checked before create (FR-011).

## Catalog name guard

| Attribute | Value |
|---|---|
| `pk` | `GYMCATALOGNAME#<normalizeWorkoutName(name)>` |
| `sk` | `N` |
| `exerciseId` | owner of the name |

Written in the same transaction as create/rename (old guard deleted on rename). Kept while retired. Built-in names are checked in code (`GYM_EXERCISES`), not stored.

## Admin role

Cognito group `admin` in the user pool (CDK). Not stored in DynamoDB. Read from the access token claim `cognito:groups` into `Caller.isAdmin`.

## Gym library (derived, not stored)

`buildLibrary(catalog)` = `GYM_EXERCISES` + active catalog items sorted by name. Cached per Lambda container for 2 minutes (research R4).

## Changed items

- **Gym entry** (`USER#<sub>/ENTRY#<date>#<exerciseId>`): unchanged shape. Catalog exercises use the same `gx-` ids, name/group snapshot and `gsi1pk = GYM#<sub>#<exerciseId>`.
- **Own exercise** (`USER#<sub>/GYMEX#gc-<uuid>`): a merge sets `removedAt` (if absent) and `mergedInto = <library id>`, as the operator command already does.
- **Squad stats / feed**: unchanged; rebuilt by `safeRefresh` for members touched by a merge.

## Validation rules (from the spec)

- Admin create/rename: name free among built-ins and all catalog rows (`isLibraryNameTaken`) → else 409 `DUPLICATE_NAME` "An exercise with this name already exists".
- Member own-exercise create/rename: name free among the library (built-ins + active catalog) and their other active own exercises (FR-005).
- Group `cardio` refused for catalog exercises (FR-003).
