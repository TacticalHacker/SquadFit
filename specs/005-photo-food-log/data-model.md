# Data Model: Photo Food Log

**Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

No new tables or indexes. Builds on [feature 003's food entry](../003-nutrition-tracker/data-model.md).

## Food entry (changed)

New values and attributes on `USER#<sub>` / `FOODLOG#<date>#<entryId>`:

| Attribute | Type | Rule |
|---|---|---|
| `source` | string | Gains the value `"photo"` (existing: `typed`, `standard`, `own`) |
| `photoKey` | string | `food-photos/<sub>/<entryId>.jpg` or `.webp`; present only when `source = "photo"` |
| `caption` | string | Optional, trimmed, plain text, **0-200 chars**; absent when empty |
| `photoStatus` | string | `pending` \| `ai` \| `manual` \| `edited`; present only for photo entries |
| `name` | string | Photo entries: the caption, or `"Photo meal"` when no caption (keeps the existing 1-60 char rule: caption is cut to 60 for `name`) |
| `calories` | integer | `0` while pending; afterwards **1-5,000** as for typed entries |
| `macros` | map? | `null`/absent while pending; afterwards all three of protein, carbs, fat, each **0-500** with at most one decimal |
| `servings`, `rate` | | `1` and equal to the totals once analysed (like typed entries) |

### Status machine

| From | To | Who | Condition (atomic) |
|---|---|---|---|
| (new) | `pending` | owner (web) | editable day |
| `pending` | `ai` | owner's AI key | `photoStatus = pending`, editable day, valid values |
| `pending` | `manual` | owner (web) | `photoStatus = pending` |
| `ai` / `manual` | `edited` | owner (web) | status is `ai` or `manual` or `edited`; values changed |
| `pending` | `pending` | owner (web) | caption or meal edit, `photoStatus = pending` |
| any | deleted | owner (web) | editable day; also deletes the photo object |

## Photo object

`food-photos/<sub>/<entryId>.<ext>` in the private bucket. JPEG or WebP, ≤ 1.5 MB, content type set from the sniffed bytes. Removed with its entry.

## Derived (not stored)

- `ledger.pending`: count of entries with `photoStatus = pending` on the day.
- Photo URL in views: presigned GET, 1 hour.
- Totals (eaten, net, remaining, macros) skip pending entries; `entriesWithoutMacros` also skips them.
