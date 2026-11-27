# Data model: Squad Volume Raid (021)

Single table, same `pk`/`sk` + `gsi1pk`/`gsi1sk` as every feature. Never log any of these items.

## Raid — `RAID#<raidId>` / `META`

| Attribute | Type | Notes |
|---|---|---|
| raidId | `rd-<yyyyMMdd>-<6 base36>` | never changes |
| squadId | `global` | |
| gsi1pk / gsi1sk | `SQUADRAIDS#global` / `<startsAt>#<raidId>` | list all raids |
| name | 3–40 chars | |
| tagline | ≤ 120 chars, optional | |
| startsAt, endsAt | ISO instants | end − start: 1–31 days |
| targetKg | 1,000 – 10,000,000 | |
| metric | `volume_kg` | room for protein/steps |
| filter | `{ groups: MuscleGroup[], exerciseIds: string[] }` or absent (= all) | cardio never counts |
| capPct | 10–100 | default 40 |
| lateJoiners | boolean | default true |
| showContributors | boolean | default true |
| stickerId | `raid_cleared` | |
| draft | boolean | true = invisible to members, holds no slot |
| wonAt | ISO, optional | set once, conditional |
| cancelledAt, cancelReason | ISO / ≤ 120, optional | |
| totalKg | number | cache of the last computed sum (history only) |
| createdBy, createdAt, updatedBy, updatedAt | | `updatedAt` = optimistic-lock token |

**Status** (derived, `raidStatus`): `cancelled` if cancelledAt → `draft` if draft → `won` if wonAt → `scheduled` if now < startsAt → `live` if now < endsAt → `ended`. Counting window: not draft/cancelled, `startsAt ≤ now < endsAt + 12 h`.

## Contribution — `RAID#<raidId>` / `CONTRIB#<sub>`

| Attribute | Notes |
|---|---|
| userId | |
| rawKg | Σ weight × reps of counting sets (tenths-safe) |
| setCount | number of counting sets (≥ 1 = contributor) |
| lastCountedAt | last refresh that changed rawKg or setCount upward (avatar order) |
| statsVersion | SQUADSTATS version the entries were read for; writes are conditional on it increasing |
| updatedAt | |

Counted kg = `min(rawKg, targetKg × capPct / 100)` (derived). Only the member themself ever receives their own figures.

## Sticker award — `USER#<sub>` / `RAIDSTICKER#<raidId>`

`{ raidId, stickerId, awardedAt }`, written `ifAbsent`, never deleted.

## Counting set (domain `raidContribution`)

A set of a gym entry where: `kind = gym`, `exerciseKind = strength`, entry date within raid days, entry matches the filter (`workoutId ∈ exerciseIds` or `muscleGroup ∈ groups`), `completed`, `reps ≥ 1`, not in `held[date|exerciseId]`, and the member counts (`lateJoiners` or `profile.createdAt ≤ startsAt`). Volume = reps × weightKg (0 kg adds 0).
