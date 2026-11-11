# Contract: Web routes & Server Actions (`apps/web`)

Same session model as [001](../../001-user-accounts/contracts/web.md) and [002](../../002-workout-tracker/contracts/web.md): all calls to the AWS API happen on the Next.js server with the user's access token; the session is read inside `<Suspense>`; protected routes use `requireProfile()`.

## Routes

| Route | Access | Purpose | Spec |
|---|---|---|---|
| `/food` | signed in + profile | Day view for today; `?date=YYYY-MM-DD` for another day | US1-US4 |
| `/food/mine` | signed in + profile | Add, edit and remove the user's own foods | US4 |

Navigation gets a **Food** link after Workouts. `DayNav` gains a `basePath` prop (and keeps the optional streak) so both trackers share it.

### `/food` page behaviour

- `date` is validated with `DateSchema`; an invalid or future date redirects to `/food` (today).
- The server component calls `GET /food?date=` and renders, inside the dark card panel used by Workouts:
  - **Date header** with ◀ ▶ and "Back to today" (FR-016).
  - **Ledger card**: remaining against the target as a bar, with eaten, burned, net; protein, carbs, fat totals and a "some entries have no macros" note when `entriesWithoutMacros > 0` (FR-009, FR-010, FR-025). Over the target is worded plainly, not as an alarm.
  - **Four meal sections** (Breakfast, Lunch, Dinner, Snacks), each with its subtotal, its entries and an **Add** button. An entry row shows name, servings or "typed", calories and macros; tapping it expands it for editing (servings stepper in 0.5 steps and meal for list entries; name, calories, macros and meal for typed ones) with a Remove action.
  - **Add panel** (opens under the chosen meal, meal preselected for today by local hour, none for other days): **Find** tab (search box over built-in foods, own foods and recent foods, results labelled "Built-in", "Mine", "Recent"; picking one shows a servings stepper and an Add button; a recent food adds straight away) and **Quick entry** tab (name, calories, optional protein/carbs/fat).
  - **Read-only banner** when `editable === false`: "This day can no longer be edited"; Add, edit and remove are hidden (FR-017).
- `FoodScreen` receives `today` and `timeZone` and moves to today when `hasDayChanged` (002's `rollover` helper, FR-018).
- Recent foods and own foods are loaded by the server component (`GET /food/recent`, `GET /food/foods`) in parallel with the day, only for editable days.

### Optimistic updates (research R9)

`useOptimistic` over the day view with `applyFoodChange`. Adding shows the entry at once with a temporary id; the server's returned view replaces it. Entries with a temporary id are not editable until then. Failure: inline "Couldn't save. Try again."; `DAY_LOCKED`: "This day can no longer be edited" and a page refresh; `NOT_FOUND` on edit or remove: refresh with "That entry was already removed".

## Server Actions (`src/server/actions/food.ts`, `"use server"`)

All validate input with the shared zod schemas, call the API through `apiFetch`, and return `{ ok: true, view } | { ok: false, error, fields? }` for the day screen, or the `ActionState` shape for forms. `UnauthorizedError` redirects to `/sign-in`; `PROFILE_REQUIRED` to `/setup`.

| Action | Calls |
|---|---|
| `addTypedEntry(date, input)` | `POST /food/entries/{date}` (`kind: "typed"`) |
| `addListEntry(date, kind, foodId, servings, meal)` | `POST /food/entries/{date}` |
| `updateEntry(date, entryId, patch)` | `PUT /food/entries/{date}/{entryId}` |
| `removeEntry(date, entryId)` | `DELETE /food/entries/{date}/{entryId}` |
| `createOwnFood(prev, formData)` / `updateOwnFood(prev, formData)` | `POST` / `PUT /food/foods[/{id}]`, `revalidatePath("/food", "layout")` |
| `removeOwnFood(foodId)` | `DELETE /food/foods/{id}` |

### `/food/mine` page behaviour

Lists the user's own foods with an inline edit form each (name, serving, calories, optional protein/carbs/fat; **Save**, **Remove**) and an **Add food** form at the top. Field errors appear under inputs; `DUPLICATE_NAME` under the name field. Built-in foods are not listed here.
