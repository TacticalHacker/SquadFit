# Implementation Plan: Daily Muscle Heatmap

**Branch**: `018-muscle-heatmap` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/018-muscle-heatmap/spec.md`

## Summary

Show a compact front + back body figure on the Gym tab, under the day's "X min · Y kcal burned" line, with 15 muscle regions filled in three accent steps by the day's completed sets (primary × 1, secondary × 0.5). Tapping a worked region shows its set counts and can filter the exercise list to that muscle. Everything is derived in the browser from the `GymView` the page already has, through a new pure module `packages/shared/src/domain/muscle-map.ts` (mapping table for the 52 built-in strength exercises + muscle-group fallback). No API, data, infra or MCP change.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node.js ≥ 24

**Primary Dependencies**: Next.js 16 App Router, React, Tailwind CSS 4, `lucide-react` (existing); no new dependencies

**Storage**: N/A (nothing stored; derived on render)

**Testing**: Vitest (`packages/shared/test/muscle-map.test.ts`)

**Target Platform**: Web (mobile-first, 320 px and up), light + OS dark mode

**Project Type**: pnpm monorepo web app (`apps/web` + `packages/shared`)

**Performance Goals**: Figure recomputes with the day view (≤ 60 exercises × ≤ 20 sets: trivial); no extra request

**Constraints**: Colours only via `globals.css` tokens; no gradients/glows/scale animations; inline SVG only (no chart or anatomy library); never shown outside the member's own Gym tab

**Scale/Scope**: 1 new shared module + test, 2 new components, edits to `gym-screen.tsx` and `globals.css`, CLAUDE.md section

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Spec-Driven Delivery | ✅ | Spec 018 has no `[NEEDS CLARIFICATION]`; behaviour beyond the spec (e.g. side delts counted as front delts) is recorded in research R6. |
| II. End-to-End Type Safety | ✅ | No network shapes change; new types live in `@calci/shared`; `MuscleRegion` is a closed union. |
| III. Test-First Domain Logic (lean) | ✅ | One test file for the new pure functions: mapping invariants (SC-003), the worked example, the fallback, step boundaries, region-filter order. No UI tests. |
| IV. IaC, Serverless | ✅ | No infra change. |
| V. Server-Authoritative, Fair Scoring | ✅ | Not a score, rank or streak; a display of the member's own server-delivered entries, computed with shared pure code (research R1). Day and edit window still come from the server. |
| VI. Members-Only Visibility | ✅ | Own data only; not added to any squad, public, share or MCP response (FR-014). |
| VII. Simplicity | ✅ | No new endpoint, library or storage; detail line instead of a positioned tooltip (research R5). |

**Post-design re-check**: unchanged, all ✅.

## Project Structure

### Documentation (this feature)

```text
specs/018-muscle-heatmap/
├── plan.md
├── research.md          # R1–R7, incl. the full exercise → muscle table (R6)
├── data-model.md        # derived entities only; nothing stored
├── quickstart.md
├── contracts/ui.md      # shared module surface + component props
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
packages/shared/
├── src/domain/muscle-map.ts        # NEW: regions, MUSCLE_MAP, GROUP_FALLBACK, musclesFor, dayMuscleLoad, heatStep, hasMuscleLoad, exercisesForRegion
├── src/index.ts                    # re-export muscle-map
└── test/muscle-map.test.ts         # NEW

apps/web/src/
├── app/globals.css                 # --heat-0..3 + --color-heat-0..3
└── components/
    ├── muscle-figure.tsx           # NEW: front/back SVG, one path per region
    ├── muscle-heatmap.tsx          # NEW: card, selection, detail line, "Show exercises"
    └── gym-screen.tsx              # load memo, render under summary, region filter state + chip

CLAUDE.md                           # "Muscle heatmap (feature 018)" section
```

**Structure Decision**: Existing monorepo layout. Pure logic in `packages/shared/src/domain` (constitution III), presentation in `apps/web/src/components`. `services/api` and `infra` are untouched.

## Complexity Tracking

No violations.
