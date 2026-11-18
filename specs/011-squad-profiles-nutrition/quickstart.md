# Quickstart: validate feature 011

Prerequisites: `pnpm install`; no AWS needed for tests. For a manual run, `pnpm dev` with a dev stack (`AWS_PROFILE=macmini-raj`) and three members (operator CLI `pnpm admin create-user`).

1. **Automated**: `pnpm check` (typecheck, lint, tests). Key suites: `packages/shared/test/nutrition-share.test.ts`, `member-profile.test.ts`; `services/api/test/squad-member.test.ts`, `squad-nutrition.test.ts`, `squad-hi5-day.test.ts`.
2. **Sharing levels** (data model, contracts/api.md): as member A request B's profile/timeline/day at B = off, totals, meals; the `nutrition` key is absent, totals-only (no `meals`, no `photoUrl`), then full. Flip the level and re-request a past day: it changes immediately.
3. **Privacy**: hide member C (Settings), request `GET /squad/members/<C>`, `/timeline`, `/days/<date>`, `/squad/today`: all 403 `MEMBER_PRIVATE`/absent; C's own view works.
4. **Profile UI**: from `/squad` tap a name → header, PRs, heatmap, timeline; scroll to load older days; tap a day for sets; high-five a day and reload; confirm `/squad` activity feed has no new item.
5. **Rows**: expand a leaderboard row (network shows `days/{date}` only on expand); on a phone width expand a second row and confirm the first closes; check "Rest day" / "Nothing logged yet".
6. **Nutrition board**: set protein targets, log food to hit/miss on several days; verify ranks with ties, members at Off absent, no-target member shows "Set a protein target" only to themselves; 7 consecutive hit days adds the feed line.
7. **Adjusted label**: have the AI adjust a workout's calories (or seed an entry with `aiNote`) and confirm "~ … adj." in the row and day card.
