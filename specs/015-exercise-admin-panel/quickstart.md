# Quickstart: Exercise Admin Panel (015)

## Prerequisites

- `pnpm check` and `pnpm synth` pass.
- `pnpm deploy:dev` deployed (creates the Cognito `admin` group and the `/admin/*` routes).
- AWS profile per CLAUDE.md (`macmini-raj`, ap-south-1).

## 1. Grant admins

```sh
pnpm admin admins add roshan
pnpm admin admins add nikhil
pnpm admin admins list        # → roshan, nikhil
```

Sign out and back in (or wait ≤ 1 h) so the new token carries the group.

## 2. Access control (Story 2)

- As `roshan`: Settings shows **Admin**; `/settings/admin` opens.
- As a non-admin: no link; `/settings/admin` shows the not-found page.
- Handler tests: each `/admin/*` handler returns 403 for a caller without the group.

## 3. Add an exercise (Story 1)

1. In the panel add "Cable Kickback", group Arms → listed as active.
2. Adding "cable  KICKBACK" or "Bench Press" → "An exercise with this name already exists".
3. As another member, within 5 minutes: Gym → Arms shows Cable Kickback after the built-ins; search "kickback" finds it; log 3 sets; the next day shows "last time".
4. Ask the AI agent to log "cable kickback 3x12 at 10 kg" → saved under the same id.

## 4. Rename, regroup, retire, restore (Story 3)

1. Rename to "Cable Kick-Back": picker shows the new name; yesterday's entry keeps the old name.
2. Retire: gone from the picker and AI matching; yesterday's entry, PRs and boards are unchanged; editing yesterday's entry still saves.
3. Restore: back in the picker with its history.
4. Built-ins show a lock and have no edit controls; `PUT /admin/exercises/gx-bench-press` → 404.

## 5. Merge (Story 4)

1. As a member, create own exercise "Cable Kickback" before step 3 (or use an existing duplicate) and log a day on it.
2. Panel shows "1 member has their own" on Cable Kickback → **Merge** → counts (1 member, N moved, 0 skipped, 1 removed).
3. The member's history and "last time" now sit on the catalog exercise; running Merge again moves nothing.

## 6. Outage fallback

With the catalog query failing (unit test on `getLibrary`), the gym view still lists every built-in.
