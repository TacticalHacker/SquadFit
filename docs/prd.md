# PRD: Social Fitness & Nutrition Tracker

| | |
|---|---|
| Project name | SquadFit (working title) |
| Status | Draft / Discovery |
| Target audience | Friend groups who want shared accountability in fitness and nutrition |

> This is the product input for the Spec Kit flow. Each feature area below becomes its own
> spec via `/speckit-specify`. The open questions in §5 must be settled during `/speckit-clarify`.

## 1. Product overview & objective

A collaborative fitness and nutrition tracking workspace for a group of friends. Users log
workouts from simple checklists, track daily food intake, see net daily calorie metrics, and
compete on a shared leaderboard. Duolingo-style streaks and a friend nudge system drive daily
retention and group accountability.

## 2. User stories

- As a user, I want to check off the workouts I completed today so that my active minutes and calories burned are calculated automatically.
- As a user, I want to log the food I eat so I can see my total calories consumed next to the calories I burned.
- As a user, I want a global leaderboard comparing my daily/weekly totals with everyone else so we stay competitive.
- As a friend, I want to see everyone's active streaks and nudge friends who haven't logged today so we don't lose momentum.

## 3. Functional requirements

### 3.1 Workout tracker
- **Checklist interface:** select completed workouts from a predefined or customizable list via checkboxes.
- **Duration tracking:** checking a workout logs its duration in minutes (preset default per exercise, or quick manual input).
- **Calorie burn:** each workout entry shows estimated calories burned.
- **Daily workout summary:** total minutes worked out and total calories burned for the day.

### 3.2 Nutrition & calorie tracker
- **Food logging:** enter food items eaten through the day with their calories.
- **Daily consumption summary:** total calories consumed.
- **Daily calorie ledger:** calories burned, calories consumed, and net/total score (see §5.1).

### 3.3 Friends scoreboard
- **Global ranking:** one leaderboard of every user, ranked by total score. *(Decided 2026-11-11: no groups/squads.)*
- **Timeframes:** daily, weekly, all-time.
- **Row contents:** name & avatar, rank, workouts completed / active minutes, net calorie or activity score, current streak (🔥).

### 3.4 Streaks & social accountability
- **Individual streaks:** consecutive days with at least one qualifying action (see §5.3).
- **Community streak:** consecutive days where every user meets their daily logging goal. *(Was "group streak"; there are no groups.)*
- **States:** *Active* (logged today), *At risk* (not logged, approaching end-of-day cutoff), *Broken* (missed a full day → reset to 0; a "streak freeze" may come later).
- **Nudge:** one-tap button next to friends who haven't logged today. Sends a push, email or in-app alert (e.g. "Alex nudged you! Log your workout before midnight to keep your 7-day streak alive!"). Limited to 1 nudge per friend per day.

## 4. Proposed data model (high level)

- **User:** user_id, name, avatar_url, daily_calorie_target, current_streak, last_logged_date
- **Workout_Catalog:** workout_id, name, default_minutes, default_calories_burned
- **Daily_Workout_Log:** log_id, user_id, date, workout_id, is_completed, actual_minutes, calories_burned
- **Daily_Food_Log:** food_log_id, user_id, date, food_name, calories_consumed
- **Daily_Summary:** summary_id, user_id, date, total_minutes, total_calories_burned, total_calories_consumed, net_total_score
- **Nudge_Event:** nudge_id, sender_id, receiver_id, timestamp

## 5. Open questions

1. **Scoreboard formula.** "Calories burned + calories gained = total" lets someone top the board by eating 5,000 calories. Options:
   - **A. Net calorie balance:** consumed − burned, ranked by closeness to each person's daily target.
   - **B. Activity-first:** rank by calories burned (or workout minutes); nutrition ledger shown as a secondary metric.
   - **C. Points:** e.g. +1/workout minute, +1/10 calories burned, +50 for hitting the daily nutrition goal.
2. ~~**Groups.**~~ → **Decided:** no squads/groups. Everyone is in one global community with one global leaderboard (expected ~3 users).
3. **Platform.** ~~Shared sheet/Notion prototype vs standalone app~~ → **Decided:** standalone web app (Next.js on Vercel, API on AWS).
4. **Streak qualification.** Does a streak need a workout OR a meal, or both every day?
