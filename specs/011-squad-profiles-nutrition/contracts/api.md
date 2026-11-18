# Contract: HTTP API

Same conventions as feature 010: Cognito token required on every route (none `auth: false`), errors `{ error: { code, message, fields? } }`, `today` from each member's own timezone, bodies never logged, 409 `PROFILE_REQUIRED` for callers without a profile. Schemas in `packages/shared/src/contracts/squad-profile.ts` (new) and `squad.ts`. All response schemas are `z.strictObject`.

**Visibility gate (all `/squad/members/*` and `/squad/today`)**: target missing, malformed id or hidden (viewer ≠ owner) → **403 `MEMBER_PRIVATE`** with the same body in each case.

## Nutrition shapes (the only way food reaches another member)

```ts
NutritionTotalsSchema = z.strictObject({ caloriesIn, calorieTarget: nullable, protein, carbs, fat, proteinTarget: nullable, burned, burnedAdjusted: boolean, pending })
NutritionMealsSchema  = NutritionTotalsSchema.extend({ meals: z.array(MealShareSchema) })   // strict; adds meals, items, photoUrl?, caption?
// level off: the `nutrition` key is absent altogether (never null, never zeros)
```

Server rule: `level(owner)` = `nutritionSharing` (default off), forced `off` if the owner is hidden and viewer ≠ owner. The owner viewing themselves gets `meals` shape with their own data.

## GET /squad/members/{memberId}

```ts
MemberProfileSchema = z.strictObject({
  member: SquadMemberSchema,
  memberSince: DateSchema,
  streak: z.strictObject({ current, best }),
  weeklyTarget: z.number().int(),
  week: z.strictObject({ days: z.number().int(), target: z.number().int() }),
  prs: z.array(z.strictObject({ exerciseId, exerciseName, best: LiftSetSchema.nullable() /* heaviest */, bestE1rm: LiftSetSchema.nullable(), })),
  heatmap: HeatmapSchema,
  nutritionLevel: z.enum(["off","totals","meals"]),   // what the viewer is allowed to see (own profile: viewer's own setting)
  isYou: z.boolean(),
})
```

Never includes email, username, timezone, calorie target, keys; body weight only as the existing opt-in ratio, which this endpoint does not return.

## GET /squad/members/{memberId}/timeline?cursor=<date>

```ts
TimelineSchema = z.strictObject({
  items: z.array(z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("day"), card: DayCardSchema }),
    z.strictObject({ type: z.literal("milestone"), id: z.string() /* "<author>~<eventId>" */, kind: z.enum(["streak_week","first_workout","protein_streak"]), date, week: z.number().nullable(), highFives, highFivedByMe, canHighFive }),
  ])),
  nextCursor: DateSchema.nullable(),   // pass back as ?cursor; null = end
})
```

10 workout days per page (milestones ride along by date), newest first; no day repeated or skipped (R3). `protein_streak` milestones appear only when level ≠ off. Invalid cursor → 400.

## GET /squad/members/{memberId}/days/{date}

`DayLogSchema` = `DayCardSchema` with full `sets: { weightKg, reps, completed }[]` per gym exercise. `nutrition` follows the same level rules. A date with no workout returns `{ date, rest: true, isToday }` (UI shows "Rest day" or "Nothing logged yet" if `isToday`). Dates in the future → 400.

## GET /squad/today?date=<date>

All visible members' day cards for `date` (default: caller's today; must be within the last 30 days), cards for members who trained, ordered by latest workout `updatedAt` descending. Each card carries `member` and, per level, `nutrition` totals only (no meals in this list). 

## GET /squad/leaderboard (changed)

Adds query `date` (selected day for expanded rows, default today) and a fifth board:

```ts
nutrition: z.strictObject({
  rows: z.array(z.strictObject({ member, rank: RankSchema, hitDays, periodDays, daysLogged, rankedOnTarget: true })),
  viewer: z.strictObject({ level, needsTarget: z.boolean() }),
}),
// per-member compact row for members sharing ≥ totals on the selected day:
nutritionToday: z.array(z.strictObject({ userId, nutrition: NutritionTotalsSchema })),
viewer: z.strictObject({ nutritionPrompt: z.boolean() }),
// existing rows gain: z.strictObject({ ..., hasWorkout: boolean })
```

`period` for the nutrition board is `week` or `30d` (`all` → falls back to `week`). Hidden members and level `off` members are absent; shared members without a target are absent for others. No sort option or field based on calories.

## PUT /me/squad (changed)

Body gains optional `nutritionSharing: "off"|"totals"|"meals"` and `dismissPrompt: boolean`. Changing the level writes the profile, then `safeRefreshProtein`. Response is the settings object including both fields.

## PUT|DELETE /squad/feed/{id}/high-five (changed)

`id = <authorSub>~day#<date>` is accepted. PUT checks the viewer is not the author, the author is visible, and `<date>` is a workout day for the author (else 404); creates the unlisted target if absent. Everything else is unchanged and idempotent.

## GET /squad/feed (changed)

Never returns `workout_day` items (not listed by construction). Returns `protein_streak` items only for authors who are visible and at level ≠ off at read time.

## Errors added

`MEMBER_PRIVATE` (403), `VALIDATION_FAILED` (400) for bad cursor/date/level.
