# Contract: Public API (no Cognito authorizer)

Schemas live in `packages/shared/src/contracts/public.ts`.

## GET /public/pulse

200
```json
{ "lifters": 3, "workoutsLast7Days": 27, "computedAt": "2026-11-12T10:00:00.000Z" }
```
`PulseResponseSchema` is `.strict()`: no other field may appear.

## POST /public/waitlist

Headers: `x-sf-client-ip` (optional, set by the Next server).

Request (`WaitlistRequestSchema`)
```json
{ "name": "Sam", "email": "sam@example.com", "primaryGoal": "get_stronger", "website": "" }
```

| Case | Status | Body |
|---|---|---|
| Stored, already on the list, or honeypot filled | 202 | `{ "status": "received" }` |
| Invalid field | 400 | `VALIDATION_FAILED` with `fields` |
| Over 5/hour for the address or 30/hour overall | 429 | `RATE_LIMITED` |

## Operator CLI

`pnpm admin waitlist list [--stage dev|prod]` prints `createdAt  goal  name <email>`, newest first.
