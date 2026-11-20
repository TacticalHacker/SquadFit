# Data Model: Share a Workout Day (016)

## Stored

### `USER#<sub>` / `SQUADSTATS` (changed)
`lifts[<exerciseId>].improvedDays: string[]` (new): local dates whose top set beat the previous session's top set of that
exercise (the walk's `improved`). Rebuilt on every write like the rest of the stats. Absent on old items = `[]`.

### `USER#<sub>` / `FEED#day#<date>` (changed, feature 011 item)
| Attribute | Notes |
|---|---|
| `kind` | `workout_day` |
| `eventDate` | `<date>` |
| `payload` | `{}` (figures are computed on read) |
| `rxFire`, `rxMuscle`, `rxCrown`, `createdAt` | unchanged |
| `postedAt` | **new**: ISO time of the first post; absent = not posted |
| `photoKey` | **new**: `share-photos/<sub>/<date>.jpg|webp`, only while posted with a photo |
| `gsi1pk` | `SQUADFEED#global` **only while posted** |
| `gsi1sk` | `<postedAt>#<sub>#day#<date>` while posted |

State: `unposted` (no GSI keys; may exist only as a reaction target) ⇄ `posted` (GSI keys + `postedAt`, optional `photoKey`).
- post: upsert; first post sets `postedAt`/`gsi1sk`; re-post keeps them, sets/removes `photoKey`.
- unpost: remove `gsi1pk`, `gsi1sk`, `postedAt`, `photoKey`; reactions kept; S3 object deleted.
- day stops being a workout day: `refreshSquadStats` deletes the item and its reactions (existing) **and its photo** (new).

### S3 `share-photos/<sub>/<date>.<ext>`
Private; JPEG or WebP (sniffed), ≤ 1.5 MB. Read via 1-hour signed URLs by `squad-feed-get` only.

## Computed (never stored)

### ShareSummary (`buildShareSummary`)
| Field | Rule |
|---|---|
| `date` | requested date (≤ member's today) |
| `label` | top two muscle groups by working-set count (strength only), ties by first logged; `null` for activity-only days |
| `durationMin` | Σ minutes of the day's workout entries |
| `exerciseCount` | number of the day's workout entries (gym + activities) |
| `liftsImproved` | number of the day's strength entries whose id has the date in `stats.lifts[id].improvedDays` |
| `rows` | first 5 workout entries in logged order (`createdAt`): strength `{ kind: "strength", name, exerciseId, top: {weightKg, reps} | null, sets }`, cardio/activity `{ kind: "minutes", name, minutes }` |
| `moreCount` | entries beyond 5 |
| `prs` | `stats.lifts[id].prDays` on the date for the day's exercises: `{ exerciseId, name, weightKg, reps, e1rm, gainKg }` |
| `streak` | `{ weeks, weekDays, target }` from `streakFigures(stats.weeks, date, weeklyTarget)` |
| `steps` | that date's synced steps or `null` |

Volume is computed per row for tests/feed parity (not a headline). Never: calories, body weight, targets, timezone, username, email.
