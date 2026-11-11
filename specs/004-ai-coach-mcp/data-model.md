# Data Model: AI Coach (Remote MCP)

**Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Same single table (`pk`/`sk`); no new indexes. The table gains a TTL attribute named `ttl`.

## Coach note (item)

| Attribute | Type | Rule |
|---|---|---|
| `pk` | string | `USER#<sub>` |
| `sk` | string | `COACH#<YYYY-MM-DD>` |
| `date` | string | Same as in `sk`; today or up to 30 days before, in the member's timezone |
| `summaryMarkdown` | string | 1-4,000 chars, trimmed |
| `recommendations` | string[] | 1-10 items, each 1-280 chars, trimmed |
| `generatedBy` | string | Constant `"AI"` |
| `createdAt` / `updatedAt` | ISO datetime | `createdAt` kept on overwrite |

One note per member per date; a new post replaces it. Readable only by its owner.

## AI credential (two items)

| Item | Keys | Attributes |
|---|---|---|
| Lookup | `pk=MCPTOKEN#<sha256 hex>`, `sk=MCPTOKEN` | `userId`, `createdAt` |
| Per member | `pk=USER#<sub>`, `sk=MCPCRED` | `tokenHash`, `createdAt` |

Issue/rotate writes both and deletes the previous lookup item in one transaction; revoke deletes both. The secret is never stored. Listing (operator) lists the Cognito users, then Gets each member's `MCPCRED` item (no new index).

## Rate counter (item)

`pk=MCPRATE#<sub>#<epochMinute>`, `sk=C`, `count` (atomic `ADD`), `ttl` = window end + 120 s epoch seconds.

## Profile (changes to feature 001)

Adds optional `dailyProteinTarget` (integer 10-500). `ProfileInputSchema` accepts it as optional/nullable; `OwnProfileSchema` returns `dailyProteinTarget: number | null`. `ProfileRepo.upsert` sets or removes it; new `setTargets(userId, { dailyCalorieTarget?, dailyProteinTarget? }, now)` does a conditional update (`attribute_exists(pk)`).

## Food ledger (changes to feature 003)

`FoodLedger` gains `proteinTarget: number | null`. `buildFoodDay` takes it as an input; the server loader passes the profile value.

## State rules

- Credential: none → active (issue) → active (rotate, old dies) → none (revoke).
- Coach note: absent → present → replaced (same key).
