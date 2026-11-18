# Contract: Web (`apps/web`)

Theme rules from CLAUDE.md apply: token colours only, Lucide icons (16–20, stroke 1.75), tabular numbers, no gradients or emoji icons, radius 6–8 px, `<SheetClose />` in sheets.

| Route / piece | Behaviour |
|---|---|
| `/squad/[memberId]` | Server Component inside `<Suspense>`. Calls profile endpoint; `MEMBER_PRIVATE` renders "This member keeps their log private". Own profile shows **Edit sharing settings** → `/settings#squad`. First timeline page server-rendered; further pages by a client "Load more" / intersection observer using a Server Action (`loadTimeline(memberId, cursor)`). |
| Heatmap | 12 columns × 7 rows, `bg-line` for level 0 and `accent` at `/20 /40 /70 /100` for 1–4 (token utilities only); each cell has `aria-label="<date>: trained / rest"`. |
| Day card | Collapsed: date, session list (gym exercises with sets × top set, activities with minutes), volume, PR badges, high-five button (hidden for own, count shown). Tap → expands set-by-set log via Server Action `loadDay(memberId, date)` (lazy). Nutrition block per level; meal list expander at `meals`. |
| Leaderboard rows | `board-row.tsx`: name + avatar are `<Link>`s; the rest of the row is a button toggling an expansion region (`aria-expanded`); one expanded at a time on viewports < 640 px (single `expandedId` state in the board client wrapper); expansion calls `loadDay` once, caches per member. Rest/empty states per FR-014. |
| "Today's workouts" | New tab/segment on `/squad` (`?view=today`), plain links like the other tabs; server-rendered cards from `GET /squad/today`. |
| Nutrition board | New board `nutrition` in `BOARDS`; periods Week / Last 30 days only (period toggle hides "All time" for this board). Row: rank, name, "6 / 7 days", "logged 7" small. Footer note: "Ranked on each member's own protein target." No sort controls. |
| Compact nutrition line | `nutrition-row.tsx` inside the leaderboard row: protein `142 / 160 g` + thin progress bar (`bg-accent` on `bg-line`), calories `2,180 kcal` (+ `/ target`), burned `~420 kcal` with `AiBadge`-style "adj." when `burnedAdjusted`. |
| One-time card | `nutrition-card.tsx` at the top of `/squad` when `viewer.nutritionPrompt`: three radio options + Save / "Not now" (keeps Off); Server Action `saveNutritionSharing`. |
| Settings | `squad-settings-form.tsx` gets a "Share my nutrition with the squad" segment (Off · Daily totals · Totals + meals) with one-line explanation of what each shows. |
| Feed | `squad-feed.tsx` renders `protein_streak` as "<Name> hit their protein target 7 days in a row"; names/avatars link to profiles. |

Never use `dangerouslySetInnerHTML`; photo URLs are rendered only in `<img>` from the API response and are never persisted client-side.
