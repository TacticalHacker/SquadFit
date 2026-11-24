# Feature Specification: Daily Muscle Heatmap

**Feature Branch**: `018-muscle-heatmap`

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "Add a daily Muscle Heatmap (front & back figure) showing worked body parts for the selected date. Front regions: chest, front delts, biceps, forearms, abs, quads. Back regions: traps, upper back, lats, rear delts, triceps, lower back, glutes, hamstrings, calves. Exercises map to primary (1.0×) and optional secondary (0.5×) regions, falling back to their muscle group (Chest, Back, Legs, Shoulders, Arms, Core) when not mapped. Unworked regions are neutral; worked regions use the accent in 3 intensity steps (light for secondary or 1–2 sets, medium for 3–5, full for 6+). Shown on the Workouts page below the day's 'X min · Y kcal burned' summary, hidden or a subtle empty state when no sets are logged. Tapping/hovering a highlighted muscle shows its name and sets logged, and optionally filters the exercise list below."

> Numbering note: "feature 017" in CLAUDE.md is the squad weight trend (shipped without a spec folder), so this feature is 018.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See which muscles I trained on a day (Priority: P1)

A member opens the Gym tab of Workouts for a day on which they logged lifts. Under the day's "X min · Y kcal burned" line they see a small body figure, front and back side by side. The muscles they trained that day are filled with the accent colour, stronger where they did more sets; everything else stays neutral. Switching to another day with the day navigation or the 7-day strip updates the figure to that day.

**Why this priority**: This is the feature. It turns a list of logged exercises into an at-a-glance picture of what the session covered, which is the whole value; the other stories only refine it.

**Independent Test**: Log 4 completed sets of Bench Press and 2 of Barbell Curl on one day, open that day on the Gym tab, and check that chest shows the medium step, biceps the light step, and unrelated regions (e.g. calves) are neutral.

**Acceptance Scenarios**:

1. **Given** a day with 4 completed sets of Bench Press, **When** the member views that day on the Gym tab, **Then** chest is shown at the medium step and the regions Bench Press works as secondary (front delts, triceps) are shown at the light step.
2. **Given** a day with 6 or more weighted sets for a region, **When** the member views it, **Then** that region is shown at full accent.
3. **Given** the member saves, edits or removes sets in the exercise drawer, **When** the drawer closes, **Then** the figure reflects the change without reloading the page.
4. **Given** the member navigates to another day, **When** the day loads, **Then** the figure shows that day's work only.
5. **Given** a day with no completed strength sets (nothing logged, only cardio, or only unticked sets), **When** the member views it, **Then** no figure is shown and the page layout is unchanged from today's.

---

### User Story 2 - Read the detail for one muscle (Priority: P2)

The member taps (on a phone) or hovers/focuses (on a desktop or keyboard) a highlighted muscle and sees a small label with the muscle's name and how many sets worked it that day, e.g. "Chest · 4 sets" or "Triceps · 2 sets (indirect)".

**Why this priority**: Colour steps are coarse; the label gives the exact number and explains why a region is lit (directly or as a helper muscle).

**Independent Test**: With the Story 1 day, tap the triceps region and check the label reads "Triceps" with 4 indirect sets; tap the calves region and check nothing appears.

**Acceptance Scenarios**:

1. **Given** a highlighted region, **When** the member taps, hovers or keyboard-focuses it, **Then** a label shows the region's name and its direct and indirect set counts.
2. **Given** a neutral (unworked) region, **When** the member taps it, **Then** nothing happens.
3. **Given** a label is showing, **When** the member taps elsewhere, presses Escape or selects another region, **Then** the label closes (or moves to the new region).

---

### User Story 3 - Filter the exercise list by a muscle (Priority: P3)

From the muscle label the member can choose to see only exercises that work that muscle. The exercise list below then shows every exercise in their library (built-in, admin-added and their own) that works that region, the ones logged that day first, with a clear way to remove the filter.

**Why this priority**: Useful for "what else can I do for rear delts?", but the figure stands on its own without it.

**Independent Test**: Tap the lats region on a day with Lat Pulldown logged, choose the filter, and check that the list shows Lat Pulldown first followed by other lat exercises (e.g. Pull-Ups, Seated Cable Row), with no chest exercises, and that clearing the filter restores the previous muscle-group pill.

**Acceptance Scenarios**:

1. **Given** the label for a region is open, **When** the member chooses "Show exercises", **Then** the list shows only exercises that work that region (primary or secondary), logged-that-day ones first, and the filter is shown as an active, removable chip.
2. **Given** a region filter is active, **When** the member removes it, picks a muscle-group pill, or types in search, **Then** the region filter is cleared and the list behaves as before.
3. **Given** a region filter is active, **When** the member changes day, **Then** the filter is cleared.

### Edge Cases

- **Own and admin-added exercises** have only a muscle group, so they light that group's fallback regions (see FR-004). An own "Arms" exercise lights both biceps and triceps.
- **Cardio exercises** (Incline Treadmill Walk, Stairmaster) and **Activities-tab entries** never light any region and never make the figure appear on their own.
- **Retired catalog exercises and removed own exercises** still logged on a day count through their muscle group, like any other entry of that day.
- **Bodyweight sets** (weight 0, e.g. Pull-Ups, Sit-Ups) count; only completed sets with at least 1 rep count, matching the squad's "completed set" rule.
- **Sets flagged as an unusual jump** still count: the figure is about work done, not records.
- **Locked days** (older than the edit window) still show the figure; it is read-only information.
- **Many regions lit**: a full-body day can light every region; the figure stays the same size.
- **Small phones (320 px wide)**: both figures fit side by side without horizontal scrolling.

## Requirements *(mandatory)*

### Functional Requirements

**Regions and mapping**

- **FR-001**: The figure MUST have exactly these regions. Front: chest, front delts, biceps, forearms, abs, quads. Back: traps, upper back, lats, rear delts, triceps, lower back, glutes, hamstrings, calves. Each region has a plain display name (e.g. "Front delts", "Upper back").
- **FR-002**: Every built-in strength exercise MUST have an explicit mapping: one or more **primary** regions and zero or more **secondary** regions (no region both). The full mapping table is a deliverable of planning and is reviewed with the spec owner.
- **FR-003**: Admin-added (catalog) and members' own exercises MUST use the muscle-group fallback (FR-004); this feature adds no per-exercise mapping input for them.
- **FR-004**: Muscle-group fallback, all primary: Chest → chest; Back → lats, upper back; Legs → quads, hamstrings, glutes; Shoulders → front delts; Arms → biceps, triceps; Core → abs. Cardio → none.

**Intensity**

- **FR-005**: For the selected day, each region's **score** = (completed sets of exercises where it is primary × 1) + (completed sets of exercises where it is secondary × 0.5). A completed set is one ticked as done with at least 1 rep; weight does not matter.
- **FR-006**: Regions MUST be shown in one of four states by score: **none** (0) neutral fill and outline; **light** (> 0 and < 3); **medium** (≥ 3 and < 6); **full** (≥ 6) full accent.
- **FR-007**: Worked regions MUST use only the existing accent colour in its light, medium and full strengths, with readable contrast between steps in both light and dark mode; unworked regions use the existing neutral surface and line colours. No new colours, gradients or glows.

*Worked example*: 4 sets of Bench Press (primary chest; secondary front delts, triceps) and 2 sets of Tricep Pushdown (primary triceps). Chest = 4 → medium. Front delts = 4 × 0.5 = 2 → light. Triceps = 2 + 4 × 0.5 = 4 → medium. Everything else = 0 → none.

**Placement and empty state**

- **FR-008**: The figure MUST appear on the Gym tab of Workouts directly below the day's "X min · Y kcal burned" summary, as a compact card with front and back views side by side.
- **FR-009**: The figure MUST be hidden when the selected day has no completed strength sets (FR-005 score 0 everywhere).
- **FR-010**: The figure MUST update when the day changes and when the member saves or removes an entry, consistent with the rest of the day view (including optimistic updates).

**Detail and filtering**

- **FR-011**: Tapping, hovering or keyboard-focusing a worked region MUST show its name with direct and indirect set counts (e.g. "Triceps · 2 sets · 4 indirect"). Unworked regions are not interactive. Each worked region MUST have an accessible name that includes the same information, and the figure as a whole an accessible summary (e.g. "Worked: chest, triceps, front delts").
- **FR-012**: The detail MUST offer "Show exercises", which filters the exercise list to exercises whose mapping (or fallback) includes that region as primary or secondary, logged-that-day exercises first, then the rest in their usual order.
- **FR-013**: An active region filter MUST be visible as a removable chip and MUST be cleared by removing it, choosing a muscle-group pill, typing a search, or changing day.

**Scope and privacy**

- **FR-014**: The figure is computed from the member's own day view only and MUST NOT appear on squad profiles, day cards, feed items, share images or any response about another member; no AI/MCP tool changes.
- **FR-015**: The mapping and scoring rules MUST be verified against the worked example, the muscle-group fallback, and the step boundaries (2.5 → light, 3 → medium, 6 → full).

### Key Entities

- **Muscle region**: one of the 15 fixed body areas in FR-001, with a display name and a side (front or back).
- **Exercise muscle mapping**: for a built-in exercise, its primary and secondary regions; for others, derived from the muscle group (FR-004).
- **Day muscle load**: for one member and one day, per region: direct sets, indirect sets, score, and intensity step. Derived from that day's gym entries when viewed; never stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any day with logged lifts, a member can tell which muscle areas they trained without opening any exercise, within 3 seconds of the day loading.
- **SC-002**: The figure changes within the same moment the logged sets do (no extra wait beyond what the day summary already takes) after saving or removing an entry.
- **SC-003**: 100% of built-in strength exercises have a primary mapping, and every exercise with a muscle group other than Cardio lights at least one region.
- **SC-004**: On a 320 px-wide screen, the whole figure card is visible without horizontal scrolling and each worked region is large enough to tap (or reachable via its accessible label).
- **SC-005**: Days with no completed strength sets look exactly as they do today (no added empty space).

## Assumptions

- "Workouts page" means the Gym tab (`/workouts/gym`), the only tab where sets exist; the Activities tab is unchanged.
- "Sets logged" means completed sets (ticked, reps ≥ 1), as in the squad rules, even though calorie math counts every set. This avoids lighting muscles for sets that were planned but not done.
- Empty state: the request allowed "hidden or a subtle empty state"; hidden was chosen so empty days stay uncluttered (SC-005).
- Intensity uses the weighted score for all three steps, so a region hit only as secondary reaches medium after 6 sets of the helping exercise; "light for secondary" holds for typical sessions.
- The request's `--bg-elevated` / `--border-subtle` tokens do not exist here; the existing surface/line tokens and the accent (`#FFBE0B` dark / `#8A5A00` light) with its soft variant are used instead (CLAUDE.md theme rules).
- The figure artwork is an original, simple stylised body outline drawn for this app.
- Region mapping for built-in exercises is decided once in planning (common anatomy conventions, e.g. Bench Press → chest; secondary front delts, triceps) and can be refined later without data changes, since nothing is stored.
- No backend, data or API changes are needed: the day view already carries each exercise's group and sets.
