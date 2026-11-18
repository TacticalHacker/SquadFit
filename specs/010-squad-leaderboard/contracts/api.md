# Contract: HTTP API (`services/api`)

Same conventions as features 002–009: only the Next.js server calls the API with the member's Cognito access token (all routes below require it; none is `auth: false`), errors are `{ "error": { "code", "message", "fields?" } }`, `today` comes from each member's profile timezone, bodies are never logged. Schemas live in `packages/shared/src/contracts/squad.ts` (new), `me.ts`, `gym.ts`, `workouts.ts`. A caller without a profile gets 409 `PROFILE_REQUIRED` (existing convention).

## Shared shapes

```ts
SquadMemberSchema = z.strictObject({        // what other members may see (constitution VI)
  userId: z.string(), displayName: z.string(), avatarUrl: z.string().nullable(), isYou: z.boolean(),
})
PeriodSchema = z.enum(["week", "30d", "all"])
RankSchema = z.number().int().min(1).nullable()   // null = unranked (hidden viewer, "—" relative)
```

## GET /squad/leaderboard?period=week|30d|all&exercise=<gx-id>

`period` default `week`; `exercise` default `gx-bench-press`, must be one of the returned `liftOptions` else it falls back to the default.

```ts
SquadLeaderboardSchema = z.strictObject({
  period: PeriodSchema,
  viewerHidden: z.boolean(),
  streaks: z.array(z.strictObject({
    member: SquadMemberSchema, rank: RankSchema,
    current: z.number().int(), best: z.number().int(),
    week: z.strictObject({ days: z.number().int(), target: z.number().int() }),
  })),
  prs: z.array(z.strictObject({
    member: SquadMemberSchema, rank: RankSchema, count: z.number().int().min(1),
    lifts: z.array(z.strictObject({ exerciseName: z.string(), date: DateSchema, weightKg: z.number(), reps: z.number().int(), e1rm: z.number().nullable() })),
  })),
  consistency: z.array(z.strictObject({
    member: SquadMemberSchema, rank: RankSchema,
    percent: z.number().int().min(0).max(100).nullable(),   // null shows "—", ranks last
    weekDays: z.number().int(), target: z.number().int(), weekVolumeKg: z.number(),
  })),
  lift: z.strictObject({
    exerciseId: z.string(), exerciseName: z.string(),
    options: z.array(z.strictObject({ exerciseId: z.string(), name: z.string() })),
    rows: z.array(z.strictObject({
      member: SquadMemberSchema, rank: RankSchema, relativeRank: RankSchema,
      e1rm: z.number(), weightKg: z.number(), reps: z.number().int(),
      relative: z.number().nullable(),   // e1rm ÷ body weight, 2 dp; null unless opted in with a saved weight
    })),
  }),
})
```

No body weight, target calories, timezone, username or food ever appears. 400 for an invalid `period`.

## GET /squad/feed

```ts
SquadFeedSchema = z.strictObject({
  items: z.array(z.strictObject({
    id: z.string(),                  // "<authorUserId>~<eventId>"
    member: SquadMemberSchema,
    kind: z.enum(["pr", "streak_week", "first_workout"]),
    date: DateSchema,
    pr: z.strictObject({ exerciseName: z.string(), weightKg: z.number(), reps: z.number().int(), e1rm: z.number().nullable() }).nullable(),
    week: z.number().int().nullable(),
    highFives: z.number().int().min(0),
    highFivedByMe: z.boolean(),
    createdAt: z.iso.datetime(),
  })).max(20),
})
```

Hidden members' items are excluded, except that a hidden viewer still sees their own items.

## PUT /squad/feed/{id}/high-five · DELETE /squad/feed/{id}/high-five

No body. 200 `{ highFives: number, highFivedByMe: boolean }`. Idempotent: adding twice or removing a missing reaction is a no-op that returns the current state. 404 if the item doesn't exist or its author is hidden (unless the author is the caller).

## PUT /me/squad

```ts
SquadSettingsSchema = z.strictObject({
  weeklyTarget: z.number().int().min(1).max(7),
  leaderboardVisible: z.boolean(),
  shareBodyWeight: z.boolean(),
})
```

200 returns the saved settings. Triggers a stats rebuild for the caller.

## Changed: GET /me

`OwnProfileSchema` gains `squad: SquadSettingsSchema` (defaults 3 / true / false via `.default` for rollout skew).

## Changed: GET /workouts/gym

Each `GymEntryViewSchema` gains `jumpFlag: z.boolean().default(false)`.

## New: PUT /workouts/gym/entries/{date}/{exerciseId}/confirm

Body `z.strictObject({ updatedAt: z.iso.datetime() })`. Sets `jumpConfirmedAt` if the entry still has that `updatedAt`, then rebuilds stats.

- 200 `{ ok: true }`
- 404 `NOT_FOUND`: no such entry for the caller.
- 409 `VALIDATION_FAILED` `fields: { _: "This entry changed; refresh" }`.
- Allowed on any past date (it does not edit the log).

## Changed: GET /workouts/summary

Response gains `weeklyStreak: z.strictObject({ current, best, weekDays, target }).nullable().default(null)` (null when no stats yet).

## Routes (`infra/lib/api-stack.ts`)

```ts
route("squad-leaderboard-get", HttpMethod.GET, "/squad/leaderboard", { avatars: "read" });
route("squad-feed-get", HttpMethod.GET, "/squad/feed", { avatars: "read" });
route("squad-hi5-put", HttpMethod.PUT, "/squad/feed/{id}/high-five", { write: true });
route("squad-hi5-delete", HttpMethod.DELETE, "/squad/feed/{id}/high-five", { write: true });
route("me-squad-put", HttpMethod.PUT, "/me/squad", { write: true });
route("gym-entry-confirm-put", HttpMethod.PUT, "/workouts/gym/entries/{date}/{exerciseId}/confirm", { write: true });
```

## MCP (`services/api/src/lib/mcp/tools.ts`)

- `get_full_context.streak` becomes `{ current, best, weekDays, target }` (weekly) or `null`; description updated. `leaderboard` stays `null` (no scoring formula yet; boards are not exposed to agents).
- `upsert_workout_log` triggers the same rebuild through `saveGymEntry` (no contract change).
