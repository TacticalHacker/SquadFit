# Research: Squad Volume Raid (021)

## R1 State is derived from the clock, no scheduled job

- **Decision**: Store only facts (`draft`, `startsAt`, `endsAt`, `wonAt`, `cancelledAt`). `raidStatus(raid, now)` in `domain/raid.ts` derives the status on every read: cancelled → draft → won → scheduled (`now < start`) → live (`now < end`) → ended.
- **Rationale**: FR-002/SC-003 ("within 1 minute") hold trivially and exactly; nothing can drift or fail to run. Constitution IV/VII: no EventBridge rule, no always-on job.
- **Alternatives**: the source's every-minute job (extra Lambda + rule, can lag or fail, and state must still be correct between runs).

## R2 Raid counting runs inside the existing stats rebuild

- **Decision**: `refreshSquadStats` already reads all of a member's entries after every gym save, delete, jump confirmation, merge, activity change and AI write. After its stats put succeeds it calls `refreshRaids(userId, entries, held, deps)` (`lib/raid-refresh.ts`), which recomputes the member's contribution for every *counting* raid (not draft, not cancelled, `start ≤ now < end + 12 h`). `buildMemberStats` additionally returns `held` (set indexes per `date|exerciseId` currently held as an unusual jump), taken from the same walk that decides the flags, so the raid and the "Looks right" note always agree.
- **Rationale**: one entry read, every write path covered (FR-017), the AI agent follows the same rules.
- **Alternatives**: incremental deltas in each handler (misses paths, double counts on retries).

## R3 Grace and freeze

- **Decision**: A raid is recomputed only while `now < endsAt + 12 h`. Inside that window every entry's save time is ≤ now, so "saved no later than 12 h after the end" holds for whatever is counted; after it nothing changes the contribution (frozen, FR-004). Raid days = squad-timezone dates `localDate(startsAt)` … `localDate(endsAt − 1 ms)`; an entry counts when its own local `date` is in that range (edge case "day boundaries").
- **Alternatives**: per-set save timestamps (sets have none; entries have `updatedAt`, but filtering by it would drop an edited Sunday entry, not freeze it).

## R4 Totals are summed from contributions; the win is a conditional write

- **Decision**: Each contribution stores `rawKg`, `setCount`, timestamps. Counted kg = `min(rawKg, cap)` with `cap = target × capPct / 100`, computed on read, so a live target edit re-caps everyone at once. After writing a contribution the refresh queries the raid partition with a strongly consistent read, sums, and if `total ≥ target` and `wonAt` is absent sets `wonAt` with `attribute_not_exists(wonAt)` (win exactly once, FR-003). It also writes the sum as `totalKg` on the raid item (a cache for history only; the card always sums). The last writer always reads after every earlier write, so a win is never missed.
- **Contribution writes are monotonic**: conditional on `statsVersion` (the stats version the entries were read for) being newer than the stored one, so two overlapping rebuilds of one member can't leave the older result.
- **Alternatives**: atomic `ADD` deltas on the raid (cap changes make stored deltas wrong; retries double-count).

## R5 Stickers

- **Decision**: `USER#<sub> / RAIDSTICKER#<raidId>` (`ifAbsent`). Written for every contributor (`setCount ≥ 1`) when the win is recorded, for a contributor's own refresh on a won raid, and lazily for the caller on `GET /squad/raid` (repair). Cancelled raids award nothing new. Profile response gains `raidsCleared` (count). One sticker id in this feature: `raid_cleared`.

## R6 Storage keys

- Raid: `pk RAID#<id>`, `sk META`, `gsi1pk SQUADRAIDS#global`, `gsi1sk <startsAt>#<id>`. Listing all raids is one GSI query (a few per month at most).
- Contribution: `pk RAID#<id>`, `sk CONTRIB#<sub>` (the card is one partition query: meta + contributions).
- Ids: `rd-<yyyyMMdd>-<6 base36>`.

## R7 Admin edits and validation

- **Decision**: pure `validateRaid(input, others, now, squadTz, current?)` returns `{ field, message }[]` (dates, overlap "Dates overlap <name>", 31-day max, 90-day lead, ≤ 3 scheduled, one live) and `lockedChanges(current, input, status)` for the editing table. Handlers return 409 `RAID_RULE` with `fields`; stale `expectedUpdatedAt` → 409 `STALE` (feature 015 pattern). Admin check: existing `requireAdmin` (403).

## R8 Suggested target

- **Decision**: `GET /admin/raids/suggest` reads every community member's entries for the 28 days before today (squad tz), counts with the raid's filter (ticked sets, no caps, no hold), and `suggestTarget(total, historyDays, raidDays)` = `round500((total / max(1, ceil(historyDays/7))) × raidDays/7 × 1.1)`, min 1,000; `null` when no volume. `historyDays` = days from the earliest gym entry inside the window to yesterday.

## R9 Card selection

- **Decision**: `pickRaidCard(raids, now)`: the live/won-in-progress raid; else the latest finished one still in its display window (won/ended: `end + 3 d`; cancelled: `cancelledAt + 1 d`); else the next scheduled. When the main card isn't the scheduled one, the next scheduled raid also comes back as `next` for a one-line "Next raid" note.

## R10 Privacy (constitution VI)

- Other members appear on the raid only as `{ userId, displayName, avatarUrl }`, only if visible to the viewer, newest counting save first, max 5, and only with "Show contributors" on. Own kg, %, capped only in `you`. Hidden members' volume is inside the squad total (spec clarification Q2): constitution VI amended to 2.7.0 to say so. Nothing reaches public, MCP or logs.

## R11 Web

- `/squad`: `RaidCard` first (server fetch `GET /squad/raid`, failure → no card). `/squad/raids` history (+ admin section: drafts and scheduled, "+ New raid"). `/squad/raids/new` and `/squad/raids/[raidId]` admin form (`notFound()` unless admin) with live preview using the same `RaidCard` body. Server Actions in `server/actions/raids.ts`. Stamp shown once per device: `localStorage sf:raidstamp:v1:<raidId>`, fade only, `prHaptic`. Toast: `GymSaveResult.raidKg` (≥ 0) → "+1,920 kg to raid". Wording in `plain.ts`.

## R12 Two functions for the raid routes

- **Decision**: `squad-raids` (GET /squad/raid, GET /squad/raids) and `admin-raids` (the six admin routes) dispatch on `routeKey` to the per-route handler files. Found at `pnpm check`: eight separate functions put the Api stack at 503 resources, over CloudFormation's 500 limit. Now 476.
- **Alternatives**: split the Api stack (bigger change, cross-stack references for every route); nested stacks (same).
