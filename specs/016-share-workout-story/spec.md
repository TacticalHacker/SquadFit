# Feature Specification: Share a Workout Day (Story Card)

**Feature Branch**: `016-share-workout-story`

**Created**: 2026-11-20

**Status**: Draft

**Input**: User description: "Share to Story for a workout day (Strava-style share card)": a member taps Share on a workout day and gets a 9:16 image made on their phone (three templates: Photo, Sticker, Card) to post to an Instagram Story or anywhere else, with an optional own photo that stays on the phone, plus a secondary "Post to squad feed" that puts that workout day in the squad feed (one post per day, optional photo shared with the squad only).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Share today's workout as a story image (Priority: P1)

A member finishes a session, opens the Gym tab and taps **Share** next to the day header. A full-screen sheet opens with a scaled-down live preview of a tall (9:16) image in the site's dark look (the **Card** template): the SquadFit wordmark and site address, the date ("Wed, 18 Nov") with a label from the day's main muscle groups ("Chest · Shoulders"), three big headline figures (duration "69 min", "8 exercises", "3 lifts improved"), up to five exercises with their best set ("Shoulder Press · 60 kg × 10", "Incline Treadmill Walk · 5 min", then "+3 more"), any new personal bests ("New personal best · Bench Press · 82.5 kg (+2.5 kg)" with a trophy icon) and the streak ("3 weeks in a row" or "2 of 4 workouts this week"). The member taps **Share**, the phone's own share sheet opens, they pick Instagram → Story, and the image is there.

**Why this priority**: This is the feature. Everything else adds options to it.

**Independent Test**: On a phone, log two exercises, tap Share, then Share again, and check the system share sheet offers Instagram with a 1080 × 1920 image showing the right figures.

**Acceptance Scenarios**:

1. **Given** the day has at least one logged gym exercise or activity, **When** the member views that day on the Gym tab, **Then** a Share button is shown; **given** nothing is logged, **then** no Share button is shown.
2. **Given** the sheet is open, **Then** the preview appears within about 1 second, with a small loading state until it does.
3. **Given** the phone supports sharing files, **When** the member taps Share, **Then** the system share sheet opens with one image named `squadfit-<date>.jpg`.
4. **Given** the member closes the system share sheet without choosing anything, **Then** no error is shown and the sheet stays open.
5. **Given** the day has 10 exercises, **Then** the list shows the first 5 and "+5 more".
6. **Given** a PR was set on that day, **Then** it shows with the lift name, the new best and the gain over the previous best.
7. **Given** the day is a past day (any date, not only the edit window), **Then** the same Share button and sheet work for it.

---

### User Story 2 - Add my own photo (Priority: P1)

In the sheet the member taps **Add photo**, picks a gym selfie from the camera or gallery, and the preview switches to the **Photo** template: the photo fills the frame and the stats sit at the bottom in white over a dark band that covers only the text area. They drag to move the photo and pinch (or use a slider) to zoom. Small text says "Your photo stays on your phone."

**Why this priority**: The photo is what makes a story worth posting; it is the Strava-style experience the request is about.

**Independent Test**: Add a portrait, a landscape and a sideways-rotated phone photo and check each shows the right way up, fills the frame, can be moved and zoomed, and the shared image matches the preview.

**Acceptance Scenarios**:

1. **Given** a photo is picked, **Then** the template switches to Photo; **given** the photo is removed, **then** it switches back to Card.
2. **Given** a photo taken with the phone held sideways, **Then** it appears the right way up.
3. **Given** a very large photo (up to 48 megapixels), **Then** the sheet does not crash or freeze for more than about 2 seconds.
4. **Given** a file the phone's browser cannot read (for example an unconverted HEIC), **Then** a friendly message says the photo couldn't be opened and to try a JPEG or screenshot, and the previous state is kept.
5. **Given** the photo is zoomed in, **Then** it can never be moved so that an empty edge shows inside the frame.
6. **Given** any template is shared or downloaded, **Then** the photo is never sent to SquadFit.

---

### User Story 3 - Sticker template and what to show (Priority: P2)

The member picks the **Sticker** template to get only the stats block on a transparent background, which they place over a photo or video inside Instagram. Toggles let them choose what appears: exercise list, personal bests, streak, duration, lifts improved, and steps (steps off by default, everything else on).

**Why this priority**: Gives control and the "overlay" use case; the feature works without it.

**Independent Test**: Choose Sticker, share, and check the file is a PNG with transparent background and white text readable on both a white and a black photo; turn off the exercise list and check it disappears from the preview and the file.

**Acceptance Scenarios**:

1. **Given** Sticker is chosen, **Then** the output is a transparent PNG named `squadfit-<date>.png` with white text and a soft shadow.
2. **Given** "Duration" is off, **Then** the headline row shows only the remaining figures; **given** all three headline figures are off, **then** the row is not drawn.
3. **Given** steps are synced for that day and "Steps" is on, **Then** "8,412 steps" is shown; **given** steps are not synced, **then** the Steps toggle is not offered.
4. **Given** the day has no PR, **Then** the personal-best toggle is not offered and nothing about PRs is shown.

---

### User Story 4 - Download on desktop (Priority: P2)

On a browser that cannot share files (most desktop browsers), the sheet shows **Download image** as the main action and the hint "Save the image, then add it to your Instagram Story." A Download button is always available as a secondary action on phones too.

**Why this priority**: Without it, desktop members and some browsers get nothing.

**Independent Test**: On desktop Chrome, open the sheet and download; the file opens as a 1080 × 1920 image.

**Acceptance Scenarios**:

1. **Given** file sharing is not supported, **Then** Share is not shown, Download is the primary action and the hint is shown.
2. **Given** Download is tapped, **Then** the same image as the preview is saved with the name `squadfit-<date>.jpg|png`.

---

### User Story 5 - Post the workout to the squad feed (Priority: P3)

In the same sheet, a secondary option **Post to squad feed** puts that workout day in the squad feed as a workout card (date, label, headline figures, exercises with best sets, PRs). Squad members react with 🔥 💪 👑 as on other feed items. If the member added a photo, an extra unchecked option "Also post this photo to your squad" uploads it to SquadFit so signed-in squad members can see it on that post; otherwise the photo stays on the phone. Each workout day can be posted once; the option then reads "Posted to squad feed" with **Remove post**.

**Why this priority**: Nice-to-have social loop inside the app; story sharing is the main goal.

**Independent Test**: Post a day, then sign in as another member and check it appears once in the feed with the stats and reactions; remove it and check it disappears.

**Acceptance Scenarios**:

1. **Given** the member posts a day, **Then** it appears at the top of the squad feed with the post time, and reactions that day already had are kept.
2. **Given** the day is already posted, **When** they post again, **Then** no second item appears (the existing post is updated, e.g. to add or remove the photo).
3. **Given** the member is hidden from the leaderboard, **Then** the option is shown disabled with "You're hidden from the squad, so you can't post." and the server refuses posts.
4. **Given** a post has a photo, **Then** only signed-in members see it, through links that expire, and the photo is deleted when the post is removed or when the day stops being a workout day.
5. **Given** the member later deletes every exercise of that day, **Then** the post disappears from the feed.
6. **Given** the photo option is unchecked, **Then** nothing about the photo is sent.

---

### Edge Cases

- A day with only activities (no gym sets) is still a workout day: it can be shared, shows activity names with minutes, and "0 lifts improved" is hidden rather than shown as zero.
- A headline figure of zero (no lifts improved, no duration) is not drawn; "exercises" counts gym exercises and activities together.
- Very long exercise names shrink a little, then end with "…"; text never overflows the frame.
- Dumbbell exercises use "per dumbbell" wording consistently with the app ("22.5 kg per dumbbell × 10").
- A strength exercise with no completed working set shows its sets count only if nothing better is available ("Lat Pulldown · 3 sets"); bodyweight-only sets (0 kg) show reps ("Pull-ups · 12 reps").
- Fonts not yet loaded: the image waits for them, so it never falls back to a system font.
- Important content stays out of the top 250 px and bottom 340 px of the 1920 px image (Instagram's overlays).
- The member opens Share for a future date or another member's day: not possible; the summary is only for the member's own days up to their today.
- A member flagged with an "Unusual jump" that is not yet confirmed: that set is not shown as a personal best (same rule as the squad).
- Network fails while loading the figures: the sheet shows "Couldn't load this workout. Try again." with a retry.

## Requirements *(mandatory)*

### Functional Requirements

**Entry point**

- **FR-001**: The Gym tab day view MUST show a Share button (share icon, "Share") for the viewed day when that day is a workout day for the member (gym strength with a completed set, gym cardio, or any activity entry), for today and any past day.
- **FR-002**: The member's own profile timeline day cards SHOULD offer the same Share action; other members' cards MUST NOT.

**Figures (server-computed)**

- **FR-003**: The figures on the card MUST come from the server for the member's own day and use the existing squad rules: working sets, top set per exercise, "lifts improved" (a strength session whose top set beat the previous session of that exercise, the same rule as the Lifts improved board), personal bests with their gain (excluding unconfirmed unusual jumps), the weekly streak, the week's workout days and target, and that day's synced steps.
- **FR-004**: The figures MUST be available to a member hidden from the leaderboard (it is their own data).
- **FR-005**: The figures MUST NOT include body weight, calories (in or burned), food, targets, email, username or timezone.
- **FR-006**: Duration MUST be the day's total minutes across gym exercises and activities; "exercises" MUST be the number of gym exercises plus activity entries that day.
- **FR-007**: The session label MUST be built from the day's top two muscle groups by number of working sets (cardio and activities excluded; one group if only one; omitted for activity-only days).
- **FR-008**: The exercise list MUST be ordered as logged, show at most 5 rows and "+N more" for the rest, with the best set ("60 kg × 10"), cardio minutes ("5 min") or the activity's minutes.

**Image**

- **FR-009**: The image MUST be made on the member's device at 1080 × 1920 px and MUST match the preview.
- **FR-010**: There MUST be three templates: **Card** (dark charcoal background, slightly lighter panel, off-white text, green accent, no photo), **Photo** (the member's photo fills the frame, a dark band only behind the bottom text area, white text), **Sticker** (stats block only on a transparent background, white text with a soft shadow).
- **FR-011**: Card is the default; choosing a photo switches to Photo; removing it switches back to Card. Photo is not selectable without a photo.
- **FR-012**: Every template MUST show the SquadFit wordmark and `squadfit.roshansidequest.com` (small, muted), the date as "Wed, 18 Nov" and the label.
- **FR-013**: Headline figures MUST read "69 min", "8 exercises", "3 lifts improved"; total weight lifted MUST NOT be a headline figure.
- **FR-014**: Wording MUST follow the app's plain-language strings (kg with thousands separators, "Estimated max" never "e1RM", "per dumbbell", "N weeks in a row", "N of M workouts this week"); personal bests read "New personal best" plus "Bench Press · 82.5 kg (+2.5 kg)" with a trophy icon in the accent colour.
- **FR-015**: Toggles: exercise list, personal bests, streak, duration, lifts improved, steps. Steps defaults off; the others default on. A toggle whose content does not exist for that day is not offered.
- **FR-016**: Content MUST stay out of the top 250 px and bottom 340 px; long text MUST shrink up to a limit and then be cut with "…".
- **FR-017**: Photo and Card output MUST be JPEG (quality about 0.9); Sticker MUST be PNG with transparency. File names: `squadfit-YYYY-MM-DD.jpg|png`.
- **FR-018**: The site's fonts MUST be loaded before drawing.
- **FR-019**: No gradients and no emoji icons in the image (the feed's reaction emoji are unchanged).

**Photo**

- **FR-020**: Add photo MUST open the camera/gallery picker; the photo MUST be shown the right way up per the camera's orientation data, reduced before drawing so very large photos do not crash a phone browser, and movable (drag) and zoomable (pinch and a slider) inside the frame, always covering it.
- **FR-021**: An unreadable file MUST show "Couldn't open this photo. Try a JPEG or a screenshot." without breaking the sheet.
- **FR-022**: The sheet MUST say "Your photo stays on your phone." and the photo MUST NOT be sent anywhere by Share or Download.

**Share and download**

- **FR-023**: When the browser can share files, Share MUST open the system share sheet with the image; a cancelled share MUST show no error.
- **FR-024**: When it cannot, Download MUST be the primary action with the hint "Save the image, then add it to your Instagram Story."; Download MUST always be available as a secondary action.
- **FR-025**: The preview MUST be ready within about 1 second on a mid-range phone, showing a loading state meanwhile.

**Squad feed post**

- **FR-026**: "Post to squad feed" MUST make the member's workout day appear in the squad feed list as one item per workout day, keeping any reactions it already has; posting again MUST update, not duplicate.
- **FR-027**: The feed item MUST show the date, label, headline figures, up to 5 exercises with best sets and the day's personal bests, computed when the feed is read so later edits to that day are reflected.
- **FR-028**: The member MUST be able to remove their post; removing it hides it from the feed and deletes any posted photo (reactions go with it, as for other removed feed items).
- **FR-029**: The photo MUST be posted only when the member ticks "Also post this photo to your squad" (default unticked). It MUST be checked to be an image, limited in size, stored privately, shown only to signed-in members through links that expire within an hour, and deleted with the post or when the day stops being a workout day.
- **FR-030**: A member hidden from the leaderboard MUST NOT be able to post (server-enforced); the feed already hides such members' items.
- **FR-031**: Only the member's own workout days (today or past) can be posted; a day that is not a workout day MUST be refused.

### Key Entities

- **Share summary**: the member's own figures for one day: date, label, duration, exercise count, lifts improved, exercises (name, kind, best set or minutes, dumbbell flag), personal bests (name, weight, reps, gain), streak (weeks in a row, this week's days and target), steps (if synced). No calories, body weight or targets.
- **Workout-day post**: the existing per-day feed item, now also listed in the feed when posted; has a posted time and an optional photo reference.
- **Posted photo**: one private image per posted day, visible to signed-in members only, removed with its post.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the Gym tab, a member reaches the Instagram Story editor with the image in 3 taps (Share → Share → Instagram Story) on iPhone Safari and Android Chrome.
- **SC-002**: The preview appears within 1 second on a mid-range phone for a day with 10 exercises and no photo, and within 2 seconds after picking a 48-megapixel photo.
- **SC-003**: 100% of the figures on the card match the squad's own numbers for the same day (PRs, lifts improved, streak).
- **SC-004**: No body weight, calorie or food figure ever appears on a card, and no photo is sent to SquadFit unless "Also post this photo" is ticked.
- **SC-005**: No text in any template overflows the frame for names up to 60 characters.
- **SC-006**: A workout day appears at most once in the squad feed.

## Assumptions

- Share appears wherever the member can view their own day: the Gym tab (with its day navigation) and their own profile timeline. The Activities tab and other members' cards are out of scope.
- The site follows the device's light/dark setting; the Card template always uses the dark palette, as the request describes.
- "Lifts improved" for one day = the number of that day's strength sessions that beat the previous session of the same exercise; the first session of an exercise never counts.
- The streak line shows "N weeks in a row" when the current weekly streak is at least 1, otherwise "N of M workouts this week" for the week that contains that day (for a past week, its stored target).
- "Today's steps" means the steps synced for the shared day.
- A posted feed photo is the member's own choice and is treated like an avatar: members-only, never public, never on the landing page (constitution VI). Workout photos are not food photos, so the nutrition-sharing setting does not apply.
- Instagram's native story deep link is out of scope (needs a native app id); the system share sheet is used instead.
- Feed post photos reuse the existing private picture bucket and signed-link approach used for food photos.
