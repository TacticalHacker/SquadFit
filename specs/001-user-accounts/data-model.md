# Data Model: User Accounts & Profiles

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Identity (username, password, forced-change status) lives in **Cognito**. Everything else about
a user lives in the **DynamoDB single table** (`pk`/`sk`, `gsi1pk`/`gsi1sk`), keyed by the
Cognito `sub`.

## Cognito user (managed)

| Attribute | Rule | Source |
|---|---|---|
| `username` | 3–20 chars, `^[A-Za-z0-9_]+$`, case-insensitive unique, immutable | FR-002; checked by the admin script, uniqueness enforced by Cognito |
| password | ≥ 8 chars, no other complexity rules | FR-003 (pool password policy) |
| `sub` | UUID, immutable | Used as `userId` everywhere |
| status | `FORCE_CHANGE_PASSWORD` → `CONFIRMED` | FR-004a/b |

### Account state transitions

```
             admin create-user              user sets new password
 (none) ───────────────────────▶ FORCE_CHANGE_PASSWORD ─────────────────────▶ CONFIRMED
                                        ▲                                         │
                                        └──────── admin reset-password ───────────┘
```

Signing in while in `FORCE_CHANGE_PASSWORD` returns the `NEW_PASSWORD_REQUIRED` challenge
instead of tokens, so the user can't reach the app until the new password is set.

## Profile (DynamoDB item)

| Attribute | Type | Rule |
|---|---|---|
| `pk` | string | `USER#<sub>` |
| `sk` | string | `PROFILE` |
| `userId` | string | Cognito `sub` |
| `username` | string | Copied from the token claim on first save (display only) |
| `displayName` | string | Trimmed, 1–40 chars (FR-010) |
| `timezone` | string | Valid IANA zone (`isValidTimeZone`) (FR-010, FR-012) |
| `dailyCalorieTarget` | integer | 500–10,000 (FR-010). **Private** (FR-018) |
| `avatarKey` | string? | `avatars/<sub>/<uuid>.webp`; absent = show initials (FR-013) |
| `createdAt` | ISO datetime | First profile save = community join date |
| `updatedAt` | ISO datetime | Every save |
| `gsi1pk` | string | `COMMUNITY` (set when the profile is first completed) |
| `gsi1sk` | string | `JOINED#<createdAt>#<sub>` (People list in join order) |

**Profile completeness** (FR-011): a user is "profile complete" once this item exists. It is
only written when all required fields are valid, so there's no separate flag. A Cognito user
with no profile item is redirected to `/setup` and doesn't appear on People (spec edge case).

### Access patterns

| Pattern | Operation |
|---|---|
| Get my profile | `GetItem pk=USER#<sub>, sk=PROFILE` |
| Create/update my profile | `PutItem` (create: `attribute_not_exists(pk)`, keeps `createdAt`) / `UpdateItem` |
| List community (People; later the leaderboard) | `Query gsi1 gsi1pk=COMMUNITY` (ascending = join order) |

## Avatar object (S3)

- Bucket: private, block-public-access, SSE-S3, `RETAIN` in prod.
- Key: `avatars/<sub>/<uuid>.webp`, ≤ 300 KB, `image/webp`, 256×256.
- When the avatar is replaced or removed, the old object is deleted.
- Read through presigned GET URLs that expire after 1 hour.

## Shared schemas (`packages/shared`)

| Schema | Used by |
|---|---|
| `UsernameSchema` | Admin script; sign-in form (basic format check) |
| `PasswordSchema` (min 8) | Sign-in new-password and change-password forms |
| `ProfileInputSchema` `{displayName, timezone, dailyCalorieTarget}` | Setup/edit forms, `PUT /me/profile` |
| `AvatarUploadSchema` `{contentType: "image/webp", dataBase64}` | `PUT /me/avatar` |
| `MeResponseSchema` `{username, profile: OwnProfile \| null}` | `GET /me` and mutation responses |
| `PeopleResponseSchema` `{members: PublicMember[]}` | `GET /people` |

`OwnProfile` = `displayName, timezone, dailyCalorieTarget, avatarUrl|null, joinedAt`.
`PublicMember` = `userId, displayName, avatarUrl|null, joinedAt, isYou`. It has **no calorie
target and no timezone** (FR-018, constitution VI).
