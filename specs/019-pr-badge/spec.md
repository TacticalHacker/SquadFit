# Feature Specification: Live PR Badge

**Feature Branch**: `019-pr-badge`

**Created**: 2026-11-27

**Status**: Draft

**Input**: User description: "SquadFit — PR Badge Spec" (2026-11-27). When a set beats the member's best for that exercise, the exercise drawer's summary line above Save becomes a "★ New PR" badge right away, before Save, with zero extra taps. In scope: PR detection while logging, the badge, a star on the PR set, haptic, the PR line in an after-save toast, stored PR records. Out of scope: leaderboard, squad feed badges, sharing. Hard rule: no popups, confirmations or new buttons. (PR types and priority, anti-fake rules, UI states, haptics, edge cases and the acceptance table are reproduced below, as amended in Clarifications.)

> Numbering note: 017 (squad weight trend) shipped without a spec folder, so this feature is 019.

## Context: what already exists

The app already decides PRs once, on the server, for the squad feed, boards, club badges and profiles (features 010/013): first log is a baseline; a PR is a heavier top set or a higher estimated 1-rep max; the estimate counts only for 1–10 reps; at most one PR per exercise per day; a set more than 50% **and** more than 20 kg above the previous best is held back as an "Unusual jump" until the member taps **Looks right**; sets at 0 kg never count. Weights are kg only (no lb entry exists). The exercise drawer today knows only the **last** session of each exercise ("Last: 77.5 kg × 8"), not the all-time bests, and there is no after-save toast. The design rules forbid scale animations.

## Clarifications

### Session 2026-11-27

- Q: One PR definition for the whole app, or a separate one for the badge? → A: One set of rules everywhere (badge, stored records, feed, profiles, anything that reads PRs). Keep the existing 1–10 rep limit for the estimate (it gets unreliable above ~10 reps) and **add Rep PRs everywhere**, feed included. Rebuild everyone's stats once after release (`pnpm admin squad backfill`). Reason: if badge and feed disagree, members ask "why didn't my PR post?"
- Q: Big-jump handling versus the existing Unusual-jump rule? → A: One threshold, the existing one (more than 50% **and** more than 20 kg above the best). The badge always appears right away; "Big jump — typo?" shows under it only above that threshold (the source's 30% rule is dropped). Such a set becomes a stored record (and a feed PR) only after **Looks right** is tapped, so typos never reach the feed. The acceptance row 120 × 3 (exactly +50%) becomes 125 kg × 3 (+56%, +45 kg).
- Q: Should 0 kg sets count for Rep PRs? → A: Only for exercises flagged as bodyweight (pull-ups, dips, push-ups), and then everywhere; a blank weight saves as 0 kg, so counting every 0 kg set would post fake Rep PRs. Exercises have no bodyweight flag yet, so **0 kg sets do not count in this feature**; the flag and 0 kg Rep PRs are a later feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See a PR the moment I enter it (Priority: P1)

A member opens Bench Press in the drawer, steps the weight of a set up to 82.5 kg × 5 (their best before today was 80 kg × 8). Without any extra tap, the summary line above Save turns into a turmeric pill reading "★ New PR · 82.5 kg (+2.5 kg)", a small ★ appears at the end of that set's row, the phone gives a short double buzz, and screen readers hear "New personal record, 82.5 kilograms". If they step the weight back to 80 kg, the pill fades back to the normal "1,450 kg volume · ~8 min · ~45 kcal" line with no message.

**Why this priority**: This is the feature: instant, in-flow recognition of a PR while the member is still at the bar.

**Independent Test**: With one past Bench Press session (best 80 kg × 8), enter each set in the acceptance table below and check the summary line, without saving and with the network off.

**Acceptance Scenarios** (history: one past Bench Press session, best 80 kg × 8, estimate ≈ 101.3 kg):

1. **Given** 82.5 kg × 5, **Then** "★ New PR · 82.5 kg (+2.5 kg)".
2. **Given** 80 kg × 10, **Then** "★ Rep PR · 80 kg × 10 (+2 reps)" (the estimate, 106.7 kg, is also beaten, but Rep PR ranks higher).
3. **Given** 77.5 kg × 12, **Then** "★ Rep PR · 77.5 kg × 12 (+4 reps)" (Rep PRs have no rep limit; only the estimate does).
4. **Given** 60 kg × 15, **Then** no badge (below 80% of the best weight, and over the estimate's 10-rep limit).
5. **Given** 80 kg × 8, **Then** no badge (a tie is not a PR).
6. **Given** 125 kg × 3, **Then** "★ New PR · 125 kg (+45 kg)" with a small "Big jump — typo?" under it; Save still works.
7. **Given** 110 kg × 3 (+37.5%, +30 kg: under the 50% threshold), **Then** "★ New PR · 110 kg (+30 kg)" with no typo hint.
8. **Given** an exercise the member has never logged before, **Then** the line reads "Baseline set · 1,450 kg volume" in muted text and no badge appears.
9. **Given** the badge for 82.5 kg × 5, **When** the set is edited to 80 kg × 5, **Then** the badge fades back to the normal summary line.
10. **Given** two sets that are both PRs, **Then** one badge shows the best of them (by PR type, then size) and the ★ marks that set's row only.
11. **Given** any set at 0 kg (e.g. Pull-ups 0 kg × 12 with a best of 0 kg × 10), **Then** no badge (0 kg sets don't count until exercises carry a bodyweight flag).

---

### User Story 2 - Saving confirms the PR (Priority: P2)

The member taps Save. A small toast appears for about 3 seconds that leads with the PR: "★ 1 PR · +1,450 kg lifted · 2-week streak". It closes by itself or on tap and never covers the Save button or blocks other taps. The PR is stored as a personal record for that exercise and, like today's PRs, posts to the squad feed.

**Why this priority**: Gives the moment a close and makes the PR durable and consistent with the squad. The badge alone (Story 1) already delivers most of the value.

**Independent Test**: Save the 82.5 kg × 5 set; check the toast text, that it disappears after ~3 s, that the member's stored PR records for Bench Press contain exactly one new Weight PR (82.5 kg, previous 80 kg, 5 reps, that day), and that the squad feed shows the PR.

**Acceptance Scenarios**:

1. **Given** a save with 1 PR, **Then** the toast leads with "★ 1 PR" and one PR record is stored.
2. **Given** a save with no PR, **Then** the toast shows only "+1,450 kg lifted" (and the streak when it is above zero).
3. **Given** a save of 80 kg × 10 (a Rep PR), **Then** a record of type reps is stored and the squad feed posts it as a PR, exactly as a weight PR would be.
4. **Given** a save of 125 kg × 3 (big jump), **Then** the toast shows no PR, no record is stored and nothing posts; the drawer shows the existing "Unusual jump" note with **Looks right**. **When** the member taps **Looks right**, **Then** the record is stored and the PR posts to the feed.
5. **Given** the member later edits or removes that day's sets so the set no longer beats the earlier best, **Then** the PR record (and its feed item) no longer exists, and records for later days are re-evaluated against the corrected history.
6. **Given** the member edits a past session (inside the edit window) to a heavier weight, **Then** later PR records that no longer beat that new best are removed.

---

### User Story 3 - Works for everyone, everywhere (Priority: P3)

The badge, star and announcement work with reduced motion (plain fade), with screen readers (polite live announcement once per new PR), on Android (double buzz) and on iPhone (one system tick where supported, silently skipped where not).

**Independent Test**: With reduced motion on, enter a PR and check there is only a fade; with VoiceOver/TalkBack, check the announcement is read once and not repeated while the member keeps stepping the same set.

### Edge Cases

- **Warm-up sets**: they never beat a best, so they never trigger a badge; no special handling.
- **Unticked sets**: the badge reacts to any set with weight and reps entered, ticked or not (the check runs on every weight/reps change and on the DONE tick). Stored records count only completed (ticked) sets, as all PR rules do today, so a badge on an unticked set becomes a record only if the set is ticked before Save.
- **Several PRs in one drawer**: one badge, the best set; the toast counts the PRs of that save. The feed keeps at most one PR item per exercise per day, showing the highest type.
- **Earlier sets in the same session**: deltas are against the best **before today**, never against an earlier set today. Two sets of 82.5 kg × 5 today are both "+2.5 kg" but only one badge shows.
- **Past day**: on an editable past day (today − 1, today − 2), "before" means before that day; later sessions do not count against it.
- **Big jump already confirmed**: a set the member already confirmed with **Looks right** shows the badge without the typo hint; editing the set clears the confirmation (as today) and re-evaluates.
- **Cardio exercises**: no badge, no records.
- **Merged exercises** (feature 015): after a merge the moved days are part of the target exercise's history.
- **Offline/slow network**: once the drawer is open, the badge needs no network; saving still needs the network as today.
- **Draft restored**: a restored on-device draft that contains a PR shows the badge (once, without buzzing again on open).

## Requirements *(mandatory)*

### Functional Requirements

**One PR definition (whole app)**

- **FR-001**: A set is a PR when it beats the member's history for that **exact** exercise (by id) before the day being logged, in one of three ways. When several apply, only the highest counts, in this order:
  1. **Weight PR**: weight is strictly heavier than any counted set ever logged for this exercise. Copy: "★ New PR · 82.5 kg (+2.5 kg)".
  2. **Rep PR**: more reps than ever done at this weight or heavier, and weight ≥ 80% of the best weight. Copy: "★ Rep PR · 80 kg × 10 (+2 reps)".
  3. **Estimate PR**: the estimated 1-rep max (Epley: weight × (1 + reps / 30)), for sets of **1–10 reps** only, beats the best estimate. Copy: "★ e1RM PR · ~98 kg (+3 kg)".
- **FR-002**: The same definition is used by the drawer badge, the stored records, the squad feed's PR items, profile PR boards and every other place that today reads the server's PRs. Rep PRs are new in all of them. Boards that rank estimates or improvements (Strength, PR jump, Lifts improved) keep their own rules unchanged.
- **FR-003**: Ties never count; a PR must be strictly better.
- **FR-004**: An exercise needs at least one earlier session before any badge can appear. With none, the summary line shows "Baseline set · <volume>" in muted text.
- **FR-005**: Sets at 0 kg never count (no badge, no record, unchanged from today). Rep PRs for bodyweight exercises wait for a bodyweight flag on exercises (later feature).
- **FR-006**: Deltas are versus the best before the day being logged, never versus another set in the same drawer.
- **FR-007**: After release, every member's PR history is rebuilt once from their full history with the new definition (existing operator backfill), so past Rep PRs appear and the backfill posts no new feed items, as today.

**Detection while logging**

- **FR-008**: The check runs every time a set's weight or reps change or its DONE box is ticked, entirely on the device, and the badge reflects the best PR set in the drawer at that moment.
- **FR-009**: The bests the check needs (best weight with its reps and date, best estimate, the most reps done at or above each weight, number of past sessions) are available to the drawer when it opens, so no request is made while logging. They are the member's own data and are never shown to anyone else.
- **FR-010**: The device's preview uses exactly the same rules as the server (one shared definition), so a badge shown before Save matches what the server stores, except for the big-jump hold (FR-015) and unticked sets.

**Badge and feedback**

- **FR-011**: The summary line above Save is replaced in place by the badge; nothing else in the drawer moves or changes size, and no button, popup or confirmation is added.
- **FR-012**: The badge is a pill in the turmeric fill with dark text (the existing primary-fill tokens); a small ★ appears at the end of the PR set's row.
- **FR-013**: When a new PR appears (a different set or a different PR value from what is shown), the badge enters once with a short fade and colour change; with reduced motion it only fades. When no PR remains, the badge fades back to the normal line with no message. (No scale bounce: the app's design rules forbid scale animations.)
- **FR-014**: When a new PR appears: Android devices buzz with a double pulse (15 ms, 40 ms pause, 15 ms); on iPhone a single system tick is triggered where the browser supports it and nothing happens where it doesn't; screen readers hear "New personal record, 82.5 kilograms" (or the Rep/estimate equivalent) once, politely. No haptic or announcement repeats while the same PR stays shown.
- **FR-015**: When a PR set is more than 50% **and** more than 20 kg above the best weight (or best estimate, for an estimate PR), the badge still shows, with "Big jump — typo?" in small text under it. Save is never blocked. Such a set becomes a stored record and a feed PR only after the member taps the existing **Looks right** (shown after Save, as today). No other threshold exists.

**After save**

- **FR-016**: After a successful save, a toast shows for about 3 seconds, leading with the PR count when there is one: "★ 1 PR · +1,450 kg lifted · 2-week streak" ("★ 2 PRs" for two). Parts that are zero (no PR, no volume, zero streak) are omitted. It closes on its own or on tap, does not block taps anywhere else, and is announced politely.
- **FR-017**: The PR count in the toast comes from the server's result of the save, so it matches what was stored (a held big jump is not counted).

**Stored records**

- **FR-018**: For each PR, the system stores a personal record for the member and exercise with: the PR type (weight, reps, estimate), the new value, the previous value, the set's weight and reps, the day and the saved entry it belongs to (with the set's position), and when it was achieved.
- **FR-019**: Records are derived from the member's full history of that exercise: whenever any day of that exercise is saved, edited, removed or jump-confirmed (including merges and AI agent writes), the member's records for the exercise are rebuilt, so a record (or feed PR) never exists for a PR that is no longer true.
- **FR-020**: Records are written only by the server; the device's badge is a preview and never writes a record itself.
- **FR-021**: The records themselves are not exposed in any new squad, public, share or AI-agent response; the squad sees PRs only where it does today (feed items, profile PR board), now including Rep PRs.
- **FR-022**: PR records, sets, weights and exercise names are never written to logs.

### Key Entities

- **Exercise bests (per member × exercise, excluding the day being logged)**: best weight (+ reps, date); best estimate; for each weight, the most reps done at that weight or heavier; number of past sessions.
- **Personal record**: member, exercise, type (weight | reps | estimate), value, previous value, weight, reps, day, entry and set position, achieved at. Rebuilt from history; never edited directly.
- **PR preview (on the device only)**: the best PR among the drawer's current sets, its set, and whether it is a big jump.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The badge appears within 100 ms of the change that causes it, with no network request.
- **SC-002**: All 11 acceptance scenarios of Story 1 and all 6 of Story 2 pass.
- **SC-003**: The logging flow has the same number of taps as before (no new buttons, popups or confirmations), and no tap target moves when the badge appears or disappears.
- **SC-004**: For every saved, non-held set, the badge shown before Save and the PR stored and posted after Save agree (same type and value).
- **SC-005**: After any edit or removal of a past session, 100% of stored PR records and feed PRs for that exercise still hold against the corrected history.
- **SC-006**: Haptics checked by hand on one iPhone (iOS 18 or later) and one Android phone.
- **SC-007**: The badge's text stays readable in a bright room (contrast at least 4.5:1 against its fill).

## Assumptions

- **Units**: kg only; the app has no lb entry, so no conversion is needed.
- **One PR per set**: a set stores at most one record, its highest type. A save may store several records (different sets), but the badge shows one and the feed one per exercise per day.
- **Bests source**: the drawer already receives per-exercise "last time" data with the Gym screen; the bests will travel the same way (the plan decides how), so opening the drawer adds no request.
- **"Offline logging"** in the source means the badge works without network once the screen is loaded; the app has no offline saving and this feature doesn't add it.
- **Toast scope**: the drawer saves one exercise at a time, so "PRs across all exercises saved" means the PRs of that save.
- **Feed copy for Rep PRs** follows the badge wording ("80 kg × 10, +2 reps"); exact phrasing lives with the rest of the squad wording.
- **Out of scope**: leaderboard changes, new squad feed badges, sharing PRs, AI agent access to PR records, a bodyweight flag on exercises and 0 kg Rep PRs, changing how "last time" is shown.
