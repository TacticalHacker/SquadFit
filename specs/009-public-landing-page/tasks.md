---

description: "Task list for feature 009: public landing page"
---

# Tasks: Public Landing Page

**Input**: Design documents from `specs/009-public-landing-page/`

**Tests**: Lean (constitution III): handler tests for the two anonymous routes (access and abuse rules) and the CDK route assertions. No UI or copy tests.

## Phase 1: Setup

- [X] T001 Amend principle VI in `.specify/memory/constitution.md` to allow exactly two anonymous aggregate figures (lifter count, workouts logged in the last 7 days); bump 2.1.0 → 2.2.0 and update the Sync Impact Report and Last Amended date

## Phase 2: Foundational

- [X] T002 [P] Create `packages/shared/src/contracts/public.ts`: `PulseResponseSchema` (`.strict()`, `lifters` int ≥ 0, `workoutsLast7Days` int ≥ 0, `computedAt` iso datetime); `WaitlistGoalSchema` enum `build_muscle | lose_fat | get_stronger | stay_consistent` with `WAITLIST_GOAL_LABELS`; `WaitlistRequestSchema` (`name` "trimmed, 1–60 chars", `email` "trimmed, lowercased, valid email, ≤ 254", `primaryGoal`, `website` "optional string ≤ 200"); `WaitlistResponseSchema` `{ status: "received" }`. Export from `packages/shared/src/index.ts`

## Phase 3: User Story 1 + 2 (P1) — Landing page and routing 🎯 MVP

**Goal**: Signed-out visitors get the landing page at `/`; members still go to the Gym logger.

**Independent test**: quickstart steps 1–5.

- [X] T003 [US2] Update `apps/web/src/proxy.ts`: add `/` to public paths; with a live session, redirect `/` and `/sign-in` to `/workouts/gym`; with a dead refresh token on `/`, clear cookies and serve the page (research R1)
- [X] T004 [US2] Delete `apps/web/src/app/(app)/page.tsx`; point the app logo in `apps/web/src/app/(app)/layout.tsx`, `requireNoProfile` in `apps/web/src/server/session.ts` and the first-save redirect in `apps/web/src/server/actions/profile.ts` at `/workouts/gym`
- [X] T005 [P] [US1] Create `apps/web/src/app/_landing/product-preview.tsx` (client): phone frame with an accessible tablist (Gym, AI Pulse, Squad; arrow keys, `aria-selected`, `aria-controls`); Gym = Bench Press drawer "3 sets · 80 kg × 8 · 1,940 kg volume"; AI Pulse = "✨ AI Coach · 4,200 kg lifted · Protein on track 155 g / 160 g"; Squad = mini leaderboard with 🔥 streaks and an inert Nudge button, tagged "Coming soon"
- [X] T006 [US1] Create `apps/web/src/app/page.tsx` (server component, static): dark theme (`#0D0F12` bg, `#161920` cards, translucent borders, emerald `#10B981` / purple `#8B5CF6` accents); sticky navbar (logo, "PRIVATE BETA" pill, "Member Sign In" → `/sign-in`); hero (eyebrow, headline, subheadline, "Request Squad Invite" → `#invite`, "Member Sign In"); `ProductPreview`; three "Bring your own AI (MCP)" cards; `#invite` section placeholder; metadata title "SquadFit · 10-second gym & macro logging". No horizontal overflow at 375 px (`overflow-x-clip` on the root, `min-w-0` where needed)

## Phase 4: User Story 3 (P2) — Request an invite

**Goal**: Visitors join the waitlist; the operator lists it.

**Independent test**: quickstart steps 7–9.

- [X] T007 [US3] Create `services/api/src/lib/waitlist-repo.ts`: `WaitlistRepo` with `add({name,email,primaryGoal}, nowIso) → "created" | "exists"` (TransactWrite: guard `WAITLISTEMAIL#<email>`/`E` with `attribute_not_exists(pk)` + row `WAITLIST`/`<iso>#<email>`), `hit(key, hour) → count` (`PUBRATE#<key>#<hour>`/`C`, ADD count, `ttl = (hour+1)*3600 + 7200`), `list() → newest first`; add `waitlist` to `services/api/src/lib/deps.ts`
- [X] T008 [US3] Add `InMemoryWaitlistRepo` to `services/api/test/fakes.ts` and to `makeDeps`
- [X] T009 [US3] Write `services/api/test/public-waitlist.test.ts` (fail first): stores once and returns 202 `received`; same email again (different case) → 202, one row; honeypot filled → 202, nothing stored; 6th submission from one address in an hour → 429 `RATE_LIMITED`
- [X] T010 [US3] Create `services/api/src/handlers/public-waitlist-post.ts`: parse `WaitlistRequestSchema`; honeypot → 202; address from `x-sf-client-ip` else `requestContext.http.sourceIp`, SHA-256 first 32 hex; hit `ip#<hash>` (limit 5) and `all` (limit 30) for the current hour → 429; `add` → 202 `{status:"received"}` either way. Never log body, headers or address
- [X] T011 [US3] Create `apps/web/src/server/public-api.ts` (`publicFetch(path, {method, body, headers, schema})`, no token, `cache: "no-store"`) and `apps/web/src/server/actions/waitlist.ts` (Server Action: forwards first `x-forwarded-for` hop / `x-real-ip` as `x-sf-client-ip`; maps 400 fields and 429 to form state)
- [X] T012 [US3] Create `apps/web/src/app/_landing/invite-form.tsx` (client, `useActionState`): name, email, goal select, visually hidden honeypot `website`; field errors; "You're on the list" confirmation replaces the form; submit disabled while pending. Mount it in the `#invite` section of `apps/web/src/app/page.tsx`
- [X] T013 [US3] Add `waitlist list` to `infra/scripts/admin.ts` (USAGE, header comment, `case "waitlist"`), printing `createdAt  goal  name <email>` newest first via `DynamoWaitlistRepo`

## Phase 5: User Story 4 (P3) — Squad pulse

**Goal**: Two anonymous counts on the landing page.

**Independent test**: quickstart steps 6 and 10.

- [X] T014 [US4] Write `services/api/test/public-pulse.test.ts` (fail first): counts members and entries in each member's own last 7 days (one entry outside the window excluded); response body has only `lifters`, `workoutsLast7Days`, `computedAt` and contains no display name
- [X] T015 [US4] Create `services/api/src/handlers/public-pulse-get.ts`: `listCommunity()`; per member `localDate(now, tz)`, `addDays(today, -6)`, `listEntriesInRange`; sum; return `PulseResponseSchema`-shaped body
- [X] T016 [US4] Create `apps/web/src/app/_landing/pulse-strip.tsx`: `await connection()`, then `getPulse()` (`"use cache"`, `cacheLife({ stale: 300, revalidate: 600, expire: 3600 })`, `publicFetch` + `PulseResponseSchema`, errors → `null`); hidden when null or `lifters === 0`; mount in `apps/web/src/app/page.tsx` inside `<Suspense fallback={null}>`

## Phase 6: Infra & polish

- [X] T017 Add routes in `infra/lib/api-stack.ts`: `public-pulse-get` GET `/public/pulse` `{ auth: false }`, `public-waitlist-post` POST `/public/waitlist` `{ auth: false, write: true }`; update the route list and the NONE-auth list in `infra/test/stacks.test.ts`
- [X] T018 Add a "Public landing page (feature 009)" section to `CLAUDE.md`
- [X] T019 Run `pnpm check` and `pnpm synth`; fix failures
- [X] T020 Render `/` at 375 px (dev server): no horizontal overflow, headline and both CTAs above the fold (SC-001), text contrast AA (FR-011); confirm `/` redirects when signed in

## Dependencies

- T001 before merge (gate for US4). T002 blocks T009–T016.
- US1/US2 (T003–T006) are independent of the API.
- US3: T007 → T008 → T009 → T010; T011 → T012. US4: T014 → T015; T016 needs T011's `publicFetch`.
- T017 needs T010 and T015.

## Parallel examples

- T002 ∥ T003 ∥ T005 (different files)
- T013 ∥ T014 once T007 lands

## Implementation strategy

MVP = Phase 3 (static landing page + routing, no backend). Then US3 (waitlist), then US4 (pulse), then infra + polish.
