# Changelog

## Unreleased
- Weekly one-tap backup: a small prompt on the first open after 7 days ("Later" asks again the next day). The file is always named `GymPilot-backup.json`, so saving to the same iCloud folder replaces the previous one. The gear dot now shows after 7 days instead of 30.
- Compact header on every tab, level with the logo, so the sets fit on screen.
- Optional Spotify mini player above the tabs (cover, title, progress, ⏮ ⏯ ⏭) through the Spotify Web API with PKCE sign-in. It needs Premium and your own Spotify developer app (Settings → Music).

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
