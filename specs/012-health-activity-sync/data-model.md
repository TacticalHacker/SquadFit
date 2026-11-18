# Data Model: Health Activity Sync (012)

All items are in the existing single table (`pk`/`sk`). No new GSI.

## Daily activity

| Key | Value |
|---|---|
| `pk` | `USER#<sub>` |
| `sk` | `ACTIVITY#<YYYY-MM-DD>` (the member's local date) |

| Attribute | Type | Rule |
|---|---|---|
| `userId` | string | owner |
| `date` | string | `YYYY-MM-DD`, ≤ owner's today, ≥ today − 30 at write time |
| `steps` | int | 0–100,000 |
| `activeKcal` | int? | 0–5,000; absent = unknown |
| `distanceKm` | number? | 0–150, 2 dp; absent = unknown |
| `source` | `mcp \| shortcut \| health_auto_export \| manual` | `manual` is never written by this feature |
| `syncedAt` | ISO | time of this write |
| `updatedAt` | ISO | same as `syncedAt` (every write replaces the whole item) |

Write: unconditional `Put` per day, all days of a request in one transaction. Read: `Query pk = USER#<sub> AND sk BETWEEN ACTIVITY#<from> AND ACTIVITY#<to>`.

## Health sync token

| pk | sk | Attributes |
|---|---|---|
| `HEALTHTOKEN#<sha256>` | `HEALTHTOKEN` | `userId`, `createdAt` |
| `USER#<sub>` | `HEALTHCRED` | `tokenHash`, `createdAt`, `lastUsedAt?` |
| `HEALTHRATE#<sub>#<utcHour>` | `C` | `count`, `ttl` (end of hour + 120 s) |

Lifecycle: none → issued (POST) → regenerated (POST again: new lookup, old lookup deleted in the same transaction) → revoked (DELETE: both deleted). `lastUsedAt` is updated after each successful authentication.

## Profile additions (`USER#<sub>/PROFILE`)

| Attribute | Type | Default when absent |
|---|---|---|
| `dailyStepGoal` | int 1,000–50,000 | 8,000 |
| `shareSteps` | boolean | true |

Effective visibility to others: `leaderboardVisible !== false && shareSteps !== false`.

## Feed item (feature 010 shape)

`USER#<sub>/FEED#steps7#<endDate>`, `kind: "step_streak"`, `eventDate = endDate`, `payload: { days: 7 }`, `gsi1pk = SQUADFEED#global`. It exists only while the 7 days ending on `endDate` are all synced days with steps ≥ the current goal and the owner shares steps. Runs don't overlap: a new item needs `endDate` > the last kept end + 6.

## Derived (computed on read, never stored)

- **Goal hit**: `steps >= dailyStepGoal`.
- **Board row**: `avgSteps = round(Σsteps / syncedDays)` over synced days in the period, `hitDays`, `periodDays` (days elapsed), `syncedDays`. Members with `syncedDays = 0` are excluded.
- **Chart**: 30 dates ending at the owner's today; `steps | null` per date.
