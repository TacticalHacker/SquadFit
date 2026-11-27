# Contracts: Live PR Badge (019)

zod in `packages/shared/src/contracts/`. No new routes; three response shapes gain fields. Every new field has a default, so a web build ahead of the API (or the reverse) still parses.

## `GET /workouts/gym` → `GymViewSchema.exercises[]` (`contracts/gym.ts`)

```ts
export const PrBestsSchema = z.strictObject({
  sessions: z.number().int().nonnegative(),
  bestWeight: z.strictObject({ weightKg: z.number(), reps: z.number().int(), date: DateSchema }).nullable(),
  bestE1rm: z.number().nullable(),
  frontier: z.array(z.strictObject({ weightKg: z.number(), reps: z.number().int() })),
});

// GymExerciseSchema gains:
bests: PrBestsSchema.nullable().default(null), // null = unknown → no badge, normal line; cardio always null
```

Owner-only route (Cognito, the caller's own data). Not added to any squad, public, share or MCP schema.

## `PUT /workouts/gym/entries/{date}/{exerciseId}` and `PUT …/confirm` → `GymSaveResultSchema`

```ts
prs: z.number().int().nonnegative().default(0),         // PR records for this exercise on this date after the save
streakWeeks: z.number().int().nonnegative().default(0), // current weekly streak (0 = hidden in the toast)
```

`DELETE` returns the same shape with `prs: 0`.

## `GET /squad/feed` → `SquadFeedItemSchema.pr` (`contracts/squad.ts`)

```ts
type: z.enum(["weight", "reps", "e1rm"]).nullable().default(null), // null on items written before 019
gainReps: z.number().int().nullable().default(null),                // Rep PR only
```

## Shared domain (`packages/shared/src/domain/pr.ts`, pure, test-first)

| Function | Used by |
|---|---|
| `classifySet(bests, { weightKg, reps }) → PrHit \| null` | `walkLift` (server), `previewPr` (device) |
| `pickTopPr(hits) → PrHit \| null` | both |
| `isBigJump(bests, hit) → boolean` (wraps the existing `suspicious`) | both |
| `addToBests(bests, sets) → PrBests` (frontier merge) | `walkLift` |
| `bestsBefore(prBase, date) → PrBests \| null` | `loadGymView` |
| `previewPr(bests, sets) → PrPreview \| null` (counts unticked sets) | drawer |

## Wording (`apps/web/src/lib/plain.ts`)

| Key | Example |
|---|---|
| `prBadgeText` | `★ New PR · 82.5 kg (+2.5 kg)` · `★ Rep PR · 80 kg × 10 (+2 reps)` · `★ e1RM PR · ~98 kg (+3 kg)` |
| `baselineLine` | `Baseline set · 1,450 kg volume` |
| `bigJumpHint` | `Big jump — typo?` |
| `prAnnounce` | `New personal record, 82.5 kilograms` · `New rep record, 10 reps at 80 kilograms` · `New estimated max, about 98 kilograms` |
| `prToast` | `★ 1 PR · +1,450 kg lifted · 2-week streak` (zero parts omitted) |
| feed Rep PR line | `Bench Press 80 kg × 10 (+2 reps)` |
