# API contracts: Squad v2

All routes require a Cognito session (409 `PROFILE_REQUIRED` without a profile). Shapes are zod strict objects in
`packages/shared/src/contracts/squad-boards.ts` (new) and `squad.ts` / `squad-profile.ts` / `me.ts` (changed).
`Member` = the existing `SquadMemberSchema` (userId, displayName, avatarUrl, isYou). `Club = "club225" | "club300" | "club400" | "club450" | "club500"`.

## GET /squad/boards (new; replaces GET /squad/leaderboard)

```ts
{
  month: "2026-11",                 // squad timezone
  viewer: { hidden: boolean, nutritionPrompt: boolean, targetsPrompt: boolean },
  boards: Board[]                   // BOARD_DEFS order; the protein board is omitted when it has no rows
}

Row<T> = { member: Member, rank: number | null, club: Club | null } & T   // rank null = hidden viewer's own row

Board =
 | { id: "workouts", rows: Row<{ days: number }>[] }
 | { id: "streak",   rows: Row<{ weeks: number, best: number, weekDays: number, target: number }>[] }
 | { id: "volume",   rows: Row<{ kg: number }>[] }
 | { id: "steps",    rows: Row<{ avgSteps: number, syncedDays: number }>[] }
 | { id: "prJump",   rows: Row<{ kg: number, liftName: string, pct: number, pctRank: number | null,
                                 pctLiftName: string, pctKg: number }>[] }   // pct* = the member's best % jump
 | { id: "strength", rows: Row<{ big3: number | null, big4: number | null, big4Rank: number | null,
                                 missing: string[] }>[] }   // big3 null + rank null = missing a Big 3 lift (sorted last)
 | { id: "protein",  rows: Row<{ hitDays: number, periodDays: number }>[] }
```

Rows are the full ranked list, best first. Hidden members never appear; a hidden viewer gets their own row with
`rank: null` at the end of each board they qualify for. No row carries calories, targets, body weight or timezone.

## GET /squad/hall-of-fame (new)

```ts
{ records: { id: RecordId, holder: Member | null, club: Club | null,
             value: number,              // kg, weeks, workout days or steps per day, by id
             liftName: string | null,    // monthPrJump only
             date: string | null,        // YYYY-MM-DD for lift/big3/streak records
             month: string | null }[] }  // YYYY-MM for month* records
```

`holder: null` = "No record yet". RecordId order: `liftBench, liftSquat, liftDeadlift, liftOhp, big3, longestStreak, monthWorkouts, monthPrJump, monthVolume, monthSteps`.

## GET /squad/feed (changed)

`?limit=5|20` (default 20). Item changes:

```ts
- highFives, highFivedByMe
+ reactions: { fire: { count, mine }, muscle: { count, mine }, crown: { count, mine } }
+ canReact: boolean
  kind: + "badge"
  pr: { exerciseName, weightKg, reps, e1rm, gainKg: number | null } | null
+ club: Club | null                     // badge items
```

## PUT | DELETE /squad/feed/{id}/reactions/{type} (new; replaces …/high-five)

`id` = `<authorSub>~<eventId>` URL-encoded (unchanged), `type ∈ fire|muscle|crown`.
200 `{ reactions: { fire, muscle, crown } }`. 404 `NOT_FOUND` for unknown items, own items, hidden authors, or a
`day#<date>` that was not a workout day. 400 for an unknown type. Both are idempotent.

## Day cards (changed: GET /squad/members/{id}, …/timeline, …/days/{date}, GET /squad/today)

`highFives, highFivedByMe, canHighFive` → `reactions`, `canReact`. Nutrition: `calorieTarget`/`proteinTarget` are
`null` when the owner has not confirmed targets and the viewer is someone else.

## GET /squad/members/{id} (changed)

Adds `badges: { club: Club, date: string }[]` (all held, lowest first).

## PUT /me/targets (new)

Body (one of):

```ts
{ dailyCalorieTarget: number, dailyProteinTarget: number | null }   // confirms; same ranges as profile
{ dismiss: true }                                                   // hides the prompt only
```

200 `Me`. 400 `VALIDATION_FAILED`.

## GET /me (changed)

Adds `targetsConfirmed: boolean`, `targetsPromptDismissed: boolean`.

## Removed

`GET /squad/leaderboard`, `PUT|DELETE /squad/feed/{id}/high-five`.

## Operator CLI

- `pnpm admin squad timezone <IANA>`: sets the squad timezone.
- `pnpm admin squad migrate-reactions`: high-fives → 💪 (counts only in output).
- `pnpm admin squad backfill`: unchanged command; now also fills months, month bests and badges (no feed items).
