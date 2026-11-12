# Data Model: Public Landing Page

Single table, existing `pk`/`sk`, `ttl` enabled.

| Item | pk | sk | Attributes | Notes |
|---|---|---|---|---|
| Waitlist request | `WAITLIST` | `<createdAt ISO>#<email>` | `name`, `email`, `primaryGoal`, `createdAt` | Operator-only. Query `pk = WAITLIST`, `ScanIndexForward: false` → newest first |
| Email guard | `WAITLISTEMAIL#<email>` | `E` | `createdAt` | Written in the same transaction, conditional `attribute_not_exists(pk)` |
| Rate counter | `PUBRATE#ip#<sha256(addr)[0..32]>#<hour>` or `PUBRATE#all#<hour>` | `C` | `count` (ADD), `ttl` = `(hour+1)*3600 + 7200` | `hour = floor(epochSeconds / 3600)` |

## Validation (contracts/public-api.md)

- `name`: trimmed, 1–60 chars
- `email`: trimmed, lowercased, valid email, ≤ 254
- `primaryGoal`: `build_muscle | lose_fat | get_stronger | stay_consistent`
- `website` (honeypot): optional string ≤ 200

## Pulse (derived, not stored)

- `lifters` = number of `COMMUNITY` profiles
- `workoutsLast7Days` = Σ over members of workout entries dated `[today−6, today]` in that member's timezone
- `computedAt` = ISO time
