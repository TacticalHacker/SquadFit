# Research: Public Landing Page

## R1. Who sees `/`

- **Decision**: The proxy (`src/proxy.ts`) treats `/` as public. With a refresh cookie present it redirects `/` → `/workouts/gym` (the gym layout's `requireProfile` sends incomplete profiles to `/setup` as today). Without one, it serves the landing page. If the refresh token is dead, the cookies are cleared and the landing page is served. `/sign-in` for a signed-in user now redirects straight to `/workouts/gym`.
- **Rationale**: The proxy already reads the cookie on every request, so members get a single redirect with no landing-page flash (SC-003), and the landing page itself never reads cookies, so it stays fully static (prerendered).
- **Alternatives**: Checking the session in the page inside `<Suspense>` makes the page dynamic and flashes the landing page for members. Rejected.
- Internal links and redirects to `/` (app logo, `requireNoProfile`, first profile save) point to `/workouts/gym` directly to skip a hop.

## R2. Pulse caching

- **Decision**: `PulseStrip` is an async server component inside `<Suspense fallback={null}>`. It calls `await connection()` then `getPulse()`, a `"use cache"` function with `cacheLife({ stale: 300, revalidate: 600, expire: 3600 })` that fetches `GET /public/pulse` without a token and parses `PulseResponseSchema`. Any error → `null` → the strip is not rendered.
- **Rationale**: `connection()` keeps the fetch out of `next build` (no build-time API dependency, no stale value baked into the shell). The 10-minute lifetime meets FR-014. Runtime `use cache` is in-memory per server instance; at this traffic each instance calls the API at most every 10 minutes.
- **Alternatives**: Build-time prerender with ISR (depends on Amplify revalidation; bakes a failed fetch into HTML). Client-side fetch (browser would call AWS directly; violates research R3 of feature 001).

## R3. Counting "workouts in the last 7 days"

- **Decision**: For each community member: `today = localDate(now, member.timezone)`, `from = addDays(today, -6)`, count `workouts.listEntriesInRange(userId, from, today)` (activities and gym entries, including removed-activity rows, since they still count on the member's day). Sum. Lifters = `listCommunity().length`.
- **Rationale**: Constitution V (days in the member's timezone); reuses existing, tested day math, so no new domain function and no new test of math.

## R4. Rate limiting an anonymous write behind a server-side caller

- **Decision**: The Server Action reads the visitor address from the first `x-forwarded-for` hop (fallback `x-real-ip`) and forwards it as `x-sf-client-ip`. The handler uses that header, else `requestContext.http.sourceIp`, hashes it (SHA-256, first 32 hex chars), and increments two hourly counters: `PUBRATE#ip#<hash>#<hour>` (limit 5) and `PUBRATE#all#<hour>` (limit 30). Over either limit → 429 `RATE_LIMITED`, nothing stored. Both counters have `ttl` = end of hour + 2 h.
- **Rationale**: All web traffic reaches the API from the Next server, so `sourceIp` alone would put every visitor in one bucket. The forwarded header can be forged by someone calling the API directly, so the global cap bounds abuse no matter what (worst case 30 junk rows/hour, ~720/day, deletable).
- **Alternatives**: Shared secret between Next and API (more config for little gain), WAF rate rule (cost and a new resource), CAPTCHA (third-party script on the page). Rejected under VII.

## R5. One row per email without revealing existence

- **Decision**: A `TransactWriteItems` with a conditional put on `WAITLISTEMAIL#<email>` / `E` (`attribute_not_exists(pk)`) and a put of the `WAITLIST` / `<iso>#<email>` row. On `TransactionCanceledException` with a `ConditionalCheckFailed` reason → treat as success. The response is the same `{ status: "received" }` with 202 either way.
- **Rationale**: Atomic dedupe (double-tap safe) while keeping the brief's `WAITLIST` / `<timestamp>#<email>` row for newest-first listing.

## R6. Honeypot

- **Decision**: Optional `website` field (visually hidden, `tabIndex=-1`, `autoComplete="off"`, `aria-hidden`). Non-empty → 202 `received`, nothing stored, no rate-counter hit.
- **Rationale**: Bots get no signal. Checked in the API so direct callers hit it too.

## R7. Logging

- Neither handler logs the body, headers or the address. Errors are logged only as `err.name`.
