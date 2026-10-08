# Changelog

## v1.4.0 — 2026-10-08

A plan for the week, a coach that spots plateaus, English, dark mode, and charts you can read at a glance.

### Plan
- **Workout plan**: muscle groups (and exercises with sets × reps) for each weekday. Ready-made Push/Pull/Legs, Upper/Lower, one group a day and Full body 3×, or **import** your coach's plan from text or a file, in Greek or English.
- **Today card** on the Log screen: today's workout, **tomorrow's** ("Tomorrow: Back · Biceps"), a week strip and a month calendar. *Start* picks the group and the next planned exercise, and every save moves on to the next one.

### Training
- **Workout time** next to the date, shown in History.
- New muscle group: **Lats**, also on the recovery map.
- **Rest timer** can start by itself after each save, and its chime now ducks your music so you hear it.
- **Workout calories** on every workout, the week, the weekly report and Wrapped.

### Insights
- **Pilot Coach**: plateau and drop detection per exercise with a concrete fix, neglected muscle groups, push/pull balance and volume swings. The tip also shows under the exercise while you log.
- **Progress Every Time**: every set as a step, weight and reps, last 2 sessions or all.
- **Stay consistent**: months of training days at a glance.
- **Achievements** get their own section: 25 badges, tap one to see what it means and how to unlock it.

### App
- **English** version and **dark mode** (both in Settings).
- **Spotify removed**: its tokens are cleared from the phone.
- Home-screen shortcuts to Log, Stats and Nutrition; backups now include the workout plan.

## v1.3.0 — 2026-10-04

GymPilot now tells you what to train today, shows your year at a glance, sums up every month and rewards your milestones.

### Recovery
- **Muscle recovery map** in Stats: a front and back silhouette colours each muscle group green (ready), amber (almost) or red (still recovering), based on the time since you last trained it. A big session (12+ sets) needs an extra day.
- **"Ready today"** on the Log screen: the rested muscle groups as chips, and one tap picks one.

### Insights
- **Your year**: a 52-week heatmap of sets per day, with workouts this year, your best weekly streak and your most common training day.
- **Monthly Wrapped**: workouts, tonnes lifted (as cars, elephants or buses), favourite exercise, biggest record, heaviest set, water, steps and weight change. It appears on the first open of a new month and can be shared as a story-sized image.

### Achievements
- **20 badges**, including Club 100/150, 10 and 100 tonnes, 4- and 12-week streaks, early bird, night owl, 30 water days, 10,000 steps, weight goal and a clean eating week. Locked badges show progress bars, and a new unlock celebrates with confetti.

## v1.2.0 — 2026-10-04

Nutrition becomes a full section, the weekly report arrives, and backups get easier.

### Nutrition
- **Plan**: attach the dietitian's PDF or photo (kept on the device), set daily calorie and protein targets (a ~1.8 g/kg protein suggestion comes from your weight), and list the day's meals with time, contents, kcal and protein.
- **Food today**: check off meals as you eat them, add off-plan food, and watch two rings fill for calories and protein. Editing the plan never rewrites past days.
- The weekly summary adds plan adherence and protein days, counted from the day the plan started.

### Stats
- **Weekly report** (this week or last): workouts, sets and volume, records, steps, water days, average weight and change, adherence and protein days. You can share it as an image.
- **Strength per kg of bodyweight** on the personal-records list, e.g. *1.24× BW*.

### Music
- Optional **Spotify mini player** above the tabs: cover, title, progress and ⏮ ⏯ ⏭. It uses the Spotify Web API with PKCE sign-in, with no server and no GymPilot account. It needs Premium and your own Spotify developer app (Settings → Music).

### Backup
- **Weekly one-tap backup**: a small prompt on the first open after 7 days ("Later" asks again the next day). The file is always `GymPilot-backup.json`, so saving to the same iCloud folder replaces the previous one.
- Backups now include the nutrition plan, its file and the food log.

### App
- Compact header on every tab, level with the logo, so the sets fit on screen.

## v1.0.0 — 2026-10-02

The first release of **GymPilot** (formerly *My Workout Tracker*). Workouts, steps and nutrition are now in one local-first app.

### Training
- Live record feedback while you type, before you save.
- −/+ steppers with press-and-hold. An empty field starts from last session's ghost value.
- "+ Set" copies the last filled row and "− Set" removes the last one. A ✓ marks the record set, with confetti and vibration when you save a record.
- Rest timer, progression hint, edit and delete.

### History
- One box per workout (same day and muscle group) with totals.
- Collapsible boxes: the latest is open and older ones start closed.

### Stats
- Weekly rings, streak, volume, records, a per-exercise progress chart, sets per muscle group and a personal-records list.
- Steps from Apple Health through a Shortcut (Huawei, Garmin and Fitbit through Apple Health), or entered by hand, next to your workouts.

### Nutrition
- Water tracker: a bottle sized to your daily goal.
- Weigh-ins with a weight goal, progress and a 90-day chart.
- Weekly summary with rings and a weekly log of average weight and water days.
- Coming soon: the dietitian's plan, meals, calories and protein.

### App
- GymPilot branding: G-and-arrow logo, espresso header, green and coffee palette on a light background.
- Four tabs: Log, History, Stats, Nutrition.
- Settings: goals, backup and restore, backup reminder, and the app version.
- Installable PWA that works offline and loads new versions on the next open.
