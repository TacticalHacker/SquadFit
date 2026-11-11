# Contract: HTTP API (AWS, `services/api`)

Base URL: `ApiUrl` stack output (server-only env `API_URL` on Vercel). Only the Next.js server
calls this API, never the browser.

**Auth**: every route except `/health` requires `Authorization: Bearer <Cognito access token>`.
The HTTP API JWT authorizer checks it (issuer = user pool, audience = app client id). Handlers
read `sub` and `username` from `requestContext.authorizer.jwt.claims`. A missing or invalid
token gets **401** from API Gateway before any Lambda runs.

Request and response bodies are defined as zod schemas in `packages/shared/src/contracts/`
(see [data-model.md](../data-model.md#shared-schemas-packagesshared)). Handlers `safeParse` the
input. Errors use one shape:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "…", "fields": { "timezone": "Unknown timezone" } } }
```

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Body fails schema; `fields` maps field → message |
| `PROFILE_REQUIRED` | 409 | Avatar upload before the profile exists |
| `PAYLOAD_TOO_LARGE` | 413 | Avatar > 300 KB decoded |

---

## `GET /health` (public)

`200 { status: "ok", stage, time }` (already implemented).

## `GET /me`

Returns the caller's identity and private profile.

`200`
```json
{
  "username": "roshan",
  "profile": {
    "displayName": "Roshan",
    "timezone": "Asia/Kolkata",
    "dailyCalorieTarget": 2200,
    "avatarUrl": "https://…presigned…",
    "joinedAt": "2026-11-11T10:00:00.000Z"
  }
}
```
`profile` is `null` until setup is finished. The web app uses this to gate on `/setup` (FR-011).

## `PUT /me/profile`

Creates (first call = joins the community) or replaces the editable profile fields.

Body: `{ "displayName": "Roshan", "timezone": "Asia/Kolkata", "dailyCalorieTarget": 2200 }`

- `displayName`: trimmed, 1–40 chars
- `timezone`: valid IANA zone
- `dailyCalorieTarget`: integer 500–10,000

`200`: the same body as `GET /me`. Idempotent. `createdAt`/`joinedAt` never change after the first call.

## `PUT /me/avatar`

Body: `{ "contentType": "image/webp", "dataBase64": "<…>" }`. The browser has already
resized the image to 256×256 WebP.

- Decoded size ≤ 300 KB, otherwise `413`. Must start with the WebP magic bytes (`RIFF….WEBP`), otherwise `400`.
- Replaces the previous object, which is deleted. `409 PROFILE_REQUIRED` if there's no profile yet.

`200`: `GET /me` body.

## `DELETE /me/avatar`

Removes the avatar so initials are shown instead. `200`: `GET /me` body. Idempotent.

## `GET /people`

Every community member (users with a profile), in join order.

`200`
```json
{
  "members": [
    { "userId": "…sub…", "displayName": "Roshan", "avatarUrl": null, "joinedAt": "…", "isYou": true }
  ]
}
```
No `dailyCalorieTarget`, `timezone` or `username` in this response (FR-018, constitution VI).
