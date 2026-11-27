# Contracts: Squad Volume Raid (021)

zod schemas live in `packages/shared/src/contracts/raids.ts` (strict objects). All routes Cognito; admin routes also `requireAdmin` → 403 `FORBIDDEN`.

## Member

### `GET /squad/raid`
```ts
RaidCardResponse = {
  card: RaidCard | null,
  next: { raidId, name, startsAt } | null,   // scheduled raid shown as one line under a different card
  canManage: boolean,                         // caller is admin
  canCreate: boolean,                         // admin and fewer than 3 scheduled raids
}
RaidCard = {
  raidId, name, tagline: string | null, status: "scheduled" | "live" | "won" | "ended" | "cancelled",
  startsAt, endsAt, targetKg, totalKg, pct,         // pct may exceed 100
  pace: number | null,                               // 0–1 while live/won-in-progress, else null
  daysLeft: number | null,
  cancelReason: string | null,
  you: { kg, rawKg, pct, capped, sticker: boolean }, // own figures only
  contributors: { userId, displayName, avatarUrl: string | null }[] | null, // ≤ 5, null when "Show contributors" is off
}
```

### `GET /squad/raids`
`{ raids: { raidId, name, startsAt, endsAt, status, targetKg, totalKg, pct, youKg: number | null }[] }` — final raids, newest first, ≤ 20.

## Admin

### `GET /admin/raids`
`{ raids: AdminRaid[] }` — every raid with all stored fields except audit users, plus `status`, `totalKg`, `updatedAt`.

### `GET /admin/raids/suggest?start=&end=&groups=legs,arms&exercises=gx-a,gx-b`
`{ suggestedKg: number | null }`

### `POST /admin/raids`
Body `RaidInput`:
```ts
{ name, tagline?, startNow?: boolean, startsAt?: iso, endsAt: iso, targetKg, filter?: { groups, exerciseIds } | null,
  capPct = 40, lateJoiners = true, showContributors = true, stickerId = "raid_cleared", draft = false }
```
→ 201 `{ raid: AdminRaid }`; 409 `RAID_RULE` `{ message, fields }` (overlap, max 31 days, etc.); 400 validation.

### `PUT /admin/raids/{raidId}`
Body `RaidInput & { expectedUpdatedAt }` → 200 `{ raid }`; 409 `STALE`, 409 `RAID_RULE` (locked field, below progress, read-only), 404.

### `POST /admin/raids/{raidId}/cancel`
Body `{ reason?: string ≤ 120, expectedUpdatedAt }` → 200 `{ raid }`; 409 when won/ended/cancelled.

### `DELETE /admin/raids/{raidId}`
Draft or scheduled only → 204; 409 otherwise.

## Changed

- `GymSaveResult.raidKg: number ≥ 0` (default 0): counted kg this save added to the raid(s) still counting.
- `MemberProfile.raidsCleared: number ≥ 0` (default 0).
