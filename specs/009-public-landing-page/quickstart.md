# Quickstart: Public Landing Page

## Automated

```sh
pnpm check   # typecheck + lint + tests (pulse + waitlist handler tests, stack assertions)
pnpm synth   # GET /public/pulse and POST /public/waitlist have AuthorizationType NONE
```

## Manual (after `pnpm deploy:dev` and `pnpm dev`)

1. Signed out, open `http://localhost:3000/` → landing page. DevTools at 375 px: no horizontal scrollbar.
2. Tap Gym / AI Pulse / Squad tabs → preview switches; Squad shows "Coming soon". Arrow keys move between tabs.
3. "Member Sign In" → `/sign-in`. Sign in → land on `/workouts/gym`.
4. Signed in, open `/` → `/workouts/gym` immediately (no landing flash).
5. Signed out, open `/food` → `/sign-in?next=%2Ffood`; after sign-in → `/food`.
6. Pulse strip shows lifters and workouts this week; stop the API (wrong `API_URL`) → strip disappears, page fine.
7. "Request Squad Invite" → submit valid values → "You're on the list". Submit the same email again → same message.
8. `pnpm admin waitlist list` → one row for that email.
9. `curl -X POST <api>/public/waitlist` six times within an hour with the same `x-sf-client-ip` → 6th is 429.
10. `curl <api>/public/pulse` → only `lifters`, `workoutsLast7Days`, `computedAt`.
