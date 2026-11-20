# Implementation Plan: Share a Workout Day (Story Card)

**Branch**: `016-share-workout-story` | **Date**: 2026-11-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/016-share-workout-story/spec.md`

## Summary

A member opens a share sheet for one of their own workout days. The **figures** come from a new server route
`GET /me/share/{date}`, built by a pure `buildShareSummary` in `packages/shared/src/domain/share-card.ts` from that day's
entries, the member's `SQUADSTATS` (PR days with gain, a new per-lift `improvedDays`, weeks) and their synced steps.
The **image** (1080 × 1920, three templates) is drawn in the browser on a `<canvas>` by `apps/web/src/lib/share-render.ts`,
using the dark theme tokens and the site's IBM Plex fonts, and shared with the Web Share API (download fallback). The
member's photo is decoded on the device (`createImageBitmap`, EXIF orientation, downscaled) and never sent unless they
tick "Also post this photo to your squad".

**Post to squad feed** reuses the existing `FEED#day#<date>` item (feature 011 reaction target): posting upserts it with
`gsi1pk`/`gsi1sk` (sorted by first post time) and `postedAt`, plus an optional `photoKey` under `share-photos/<sub>/`.
`GET /squad/feed` stops skipping `workout_day` items that are listed and renders them with a `workout` block computed
on read by the same `buildShareSummary` (no steps or streak there). Unposting removes the GSI keys and the photo but
keeps reactions. `refreshSquadStats` deletes the photo when it deletes a day item that stopped being a workout day.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node.js 24

**Primary Dependencies**: Next.js 16 App Router, React 19, Tailwind 4, lucide-react, zod 4; AWS SDK v3 (DynamoDB, S3). No new packages: canvas, `createImageBitmap`, `navigator.share` and `document.fonts` are platform APIs.

**Storage**: DynamoDB single table (existing `FEED#day#<date>` item gains `postedAt`, `photoKey`, GSI keys while posted; `SQUADSTATS.lifts[id].improvedDays`); S3 private bucket prefix `share-photos/<sub>/<date>.jpg|webp`.

**Testing**: Vitest (shared domain + handler tests with in-memory fakes); CDK assertions for the new grants.

**Target Platform**: iPhone Safari 16+, Android Chrome 120+, desktop Chrome/Safari/Firefox (download fallback).

**Project Type**: Web app (Next.js) + serverless API (Lambda) monorepo.

**Performance Goals**: Preview ≤ 1 s after figures arrive on a mid-range phone; photo decode ≤ 2 s for 48 MP.

**Constraints**: Photo never leaves the device unless the opt-in is ticked; canvas memory on iOS (keep bitmaps ≤ 2160 px on the long side and a single 1080 × 1920 canvas); Lambda payload ≤ 6 MB (photo ≤ 1.5 MB JPEG → ~2 MB base64).

**Scale/Scope**: One squad (tens of members); feed reads compute ≤ 20 workout cards per request.

## Constitution Check

| Principle | Status |
|---|---|
| I. Spec-Driven | ✅ spec + clarifications done before plan. |
| II. Type safety | ✅ `ShareSummarySchema`, `SharePostInputSchema`, feed `workout` block are zod in `packages/shared/src/contracts/share.ts`; parsed in handlers and by the web client. |
| III. Test-first domain | ✅ `buildShareSummary` (top set, label, truncation, improved count, PR rows) and `improvedDays` in `buildMemberStats` get failing tests first; handler tests only for access rules (future date, hidden member can't post, non-workout day refused). Lean. |
| IV. IaC | ✅ two routes + one share-photo grant option in `api-stack.ts`; stack test asserts share-photo write is only on the post function. |
| V. Server-authoritative | ✅ figures (PRs, improved, streak) are computed on the server from the same squad rules; the client only draws them. "Today" for the date guard uses the member's timezone. |
| VI. Members-only visibility | ✅ The summary is the caller's own data (no calories, body weight, targets). Feed posts reach signed-in members only; hidden members can't post and their items are already dropped; photo links are signed (1 h). Steps never go to the feed. Nothing about entries or photos is logged. |
| VII. Simplicity | ✅ No libraries; reuses the day feed item, reactions, photo upload path and `BottomSheet`. See Complexity Tracking for the one stored addition. |

Post-design re-check: ✅ unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/016-share-workout-story/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/shared/src/
├── domain/share-card.ts            # buildShareSummary, sessionLabel, pickRows (pure, tested)
├── domain/squad.ts                 # LiftStats.improvedDays (walkLift already computes it)
└── contracts/share.ts              # ShareSummary, SharePostInput, SharePostResult, FeedWorkout
    contracts/squad.ts              # SquadFeedItem: kind "workout_day" + `workout` block

services/api/src/
├── handlers/me-share-get.ts        # GET /me/share/{date}
├── handlers/squad-post-put.ts      # PUT /squad/posts/{date}
├── handlers/squad-post-delete.ts   # DELETE /squad/posts/{date}
├── handlers/squad-feed-get.ts      # lists posted workout days
├── lib/share-summary.ts            # loads entries/stats/steps → buildShareSummary
├── lib/share-photo-store.ts        # S3 store for share-photos/
├── lib/squad-repo.ts               # postDay / unpostDay, putFeed ifAbsent, postedAt/photoKey
├── lib/reaction.ts                 # lazy day item created only if absent
└── lib/squad-stats.ts              # delete posted photo with a dropped day item

infra/lib/api-stack.ts              # routes + sharePhotos grant

apps/web/src/
├── lib/share-render.ts             # canvas drawing: templates, layout, fit text
├── lib/share-photo.ts              # decode/orient/downscale the picked photo
├── lib/plain.ts                    # share wording (headline, rows, PR line)
├── components/share-button.tsx     # Share icon button → opens sheet
├── components/share-sheet.tsx      # preview, templates, toggles, photo, share/download, post
├── components/squad-feed.tsx       # workout_day card
├── components/gym-screen.tsx / day-nav or page  # Share entry on the Gym tab
├── components/timeline.tsx / day-card.tsx       # Share on own cards
└── server/actions/share.ts         # loadShare, postShare, removePost
```

**Structure Decision**: existing monorepo layout; pure rules in `packages/shared`, thin handlers, browser-only drawing in `apps/web/src/lib`.

## Complexity Tracking

| Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| `improvedDays` stored per lift in `SQUADSTATS` | The card and feed need "lifts improved" for one day; the walk already computes it on every write. | Recomputing from all history on every share open and for every feed card means a full-history query per card (up to 20 per feed read). |
| Share-photo delete grant on functions that call `safeRefresh` | A day that stops being a workout day must lose its posted photo (FR-029). | An S3 lifecycle rule can't know the post was removed; a cleanup job is more moving parts. Grant is `DeleteObject` on `share-photos/*` only. |
