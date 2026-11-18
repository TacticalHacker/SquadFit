# Data Model: Squad Profiles and Shared Nutrition

Same single table; no new table or index.

## Changed: Profile (`USER#<sub>` / `PROFILE`)

| Attribute | Type | Default if absent | Rule |
|---|---|---|---|
| `nutritionSharing` | `"off" \| "totals" \| "meals"` | `"off"` | FR-018; written only by `PUT /me/squad` |
| `nutritionPromptSeen` | bool | false | FR-026; set by any `PUT /me/squad` that carries `nutritionSharing` or `dismissPrompt: true` |

No migration. `squadSettingsOf` returns both with defaults.

## New items (all under the author's partition)

| Item | Key | Notes |
|---|---|---|
| Day high-five target | `USER#<author>` / `FEED#day#<date>` | Same shape as a feed item (`kind: "workout_day"`, `eventDate`, `hi5Count`, `createdAt`, `squadId`) but **no `gsi1pk`/`gsi1sk`**, so it never lists in the feed. Created lazily on the first high-five; deleted with its `HI5#day#<date>#<reactor>` items when the date stops being a workout day. |
| Day high-five | `USER#<author>` / `HI5#day#<date>#<reactor>` | Existing format and transaction (idempotent, `hi5Count` updated atomically). |
| Protein-streak event | `USER#<sub>` / `FEED#protein7#<endDate>` | Feed item (`kind: "protein_streak"`, payload `{ days: 7 }`), with `gsi1pk = SQUADFEED#global`. Reconciled by `protein-events.ts`; listed only if the author is visible and level ≠ off (checked at read). |

`SquadEventKind` gains `"workout_day"` and `"protein_streak"`. `refreshSquadStats` already diffs feed items by derived ids: it treats `day#` items as derived-if-workout-day (never creates them) and does not touch `protein7#` items (owned by `protein-events.ts`).

## Derived (never stored)

```ts
type NutritionLevel = "off" | "totals" | "meals";

// Totals shape (level totals and meals)
interface NutritionTotals {
  caloriesIn: number; calorieTarget: number | null;
  protein: number; carbs: number; fat: number; proteinTarget: number | null;
  burned: number; burnedAdjusted: boolean;   // true if any workout entry that day has aiNote
  pending: number;                           // photo entries not yet analysed (excluded from totals)
}
// Meals shape adds
interface NutritionMeals extends NutritionTotals {
  meals: { meal: Meal; subtotalCalories: number; macros: Macros | null;
           items: { name: string; servings: number; calories: number; macros: Macros | null;
                    photoUrl?: string /* expiring */ ; caption?: string }[] }[];
}
```

`calorieTarget` and `proteinTarget` are shown only at `totals` and above; they come from the member's profile and are the only way a target reaches another member.

### Workout day card

```ts
interface DayCard {
  date: string;
  sessions: Session[];          // gym session first, then activities by name
  volumeKg: number; durationMin: number;
  topSet: { exerciseName: string; weightKg: number; reps: number } | null;
  prBadges: { exerciseName: string; weightKg: number; reps: number; e1rm: number | null }[];
  highFives: number; highFivedByMe: boolean; canHighFive: boolean;  // false for own
  nutrition?: NutritionTotals | NutritionMeals;                      // key absent at level off
}
type Session =
  | { kind: "gym"; exercises: { exerciseName: string; sets?: SetRow[]; topSet; volumeKg; minutes: number }[] }
  | { kind: "activity"; name: string; minutes: number; calories?: never };
```

Sets (`sets: SetRow[]`) appear only on the day-log endpoint and on expanded leaderboard rows; timeline cards carry per-exercise summaries (lazy detail, FR-013).

### Heatmap

`{ from, to, cells: { date, level: 0|1|2|3|4 }[] }` for the last 84 local days (R5). Level 1 = trained without volume, 2–4 by the member's volume terciles.

### Protein-hit day (pure)

`hit(day) = entriesCounted ≥ 1 && protein ≥ dailyProteinTarget` (R8). Run of 7 consecutive hit days → one `protein7#<endDate>` event; the next run starts the day after.
