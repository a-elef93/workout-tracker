<p align="center">
  <img src="icon-512.png" alt="GymPilot logo" width="112">
</p>

<h1 align="center">GymPilot</h1>

<p align="center"><b>Lift. Push. Progress.</b><br>
A local-first tracker for workouts, steps and nutrition that runs in the browser and installs on your phone like an app.</p>

<p align="center"><a href="https://a-elef93.github.io/workout-tracker/"><b>Open the app →</b></a></p>

> The interface is in Greek. No account, no server: everything is stored on your device.

---

## Features

### 🏋️ Training log
- Log sets (kg × reps) per exercise, organised by muscle group, with your own exercises on top of the defaults.
- **Ghost values**: last session's numbers appear faintly in every field, so you always know what to beat.
- **Steppers**: −/+ next to every field (±2.5 kg, ±1 rep). Hold to repeat. An empty field starts from the ghost value.
- **Live record feedback** while you type: a box under the sets turns into *🏆 New record · +2.5kg* or *▼ Down · −5kg · record 70kg* before you save, and the record set gets a ✓.
- "+ Set" copies the last filled row and "− Set" removes the last one. There's also a progression hint, edit/delete, and confetti when you save a record.
- Rest timer (1:00–3:00, +30″) that stays on screen and beeps/vibrates when it's done.

### 📒 History
- One box per workout (same day and muscle group) with totals: exercises, sets, volume and records.
- Boxes collapse: the latest workout starts open and older ones start closed.
- Each exercise is badged as record / up / down / same against the previous session, with a filter by muscle group.

### 📊 Stats
- Weekly rings for workouts, sets and muscle groups, plus a week strip.
- Tiles: weekly streak, total workouts, total volume, records.
- Progress chart per exercise: top set, estimated 1RM (Epley) or volume.
- Sets per muscle group over the last 30 days, and a personal-records list.
- **Steps**: today vs your daily goal, 7-day bars with workout days marked, and average steps on training vs rest days.

### 🥗 Nutrition
- **Water**: a bottle sized to your daily goal fills up as you log drinks (+250 / +330 / +500 / +750 ml or a custom amount). Any drink can be undone.
- **Weigh-ins**: one per day, with the change since the last weigh-in, a weight goal, progress measured from the weight you had when you set the goal, and a 90-day chart.
- **Weekly summary**: rings for water-goal days, weigh-ins and goal progress, plus a weekly log of average weight, change vs the previous week (toward or away from the goal) and water days.
- *Coming soon*: the dietitian's plan, meal check-offs, calories and protein vs target.

### 🎵 Music (optional)
- A Spotify mini player sits above the tabs while music plays: cover, title, a progress line and ⏮ ⏯ ⏭, so you don't leave the workout.
- It works through the Spotify Web API, signing in with Spotify via PKCE straight from the page, with no server and no secret. It needs **Spotify Premium** and your own Spotify developer app (Settings → Music walks you through it). Spotify currently limits these apps to 5 allow-listed users and asks you to sign in again every 6 months.

## Your data
- Everything lives in the browser's `localStorage` on your phone: no account, no backend, no analytics. The optional Spotify sign-in is only for music; its tokens stay on the device and are never included in backups.
- **Backup / restore** from Settings (⚙️): exports a JSON file through the share sheet (Files, iCloud, Drive). Restoring merges with what's already there. If you haven't backed up in 30 days, the gear shows a dot.
- Data belongs to the address the app is opened from. If you move to another URL, back up first and restore there.

## Install on your phone
- **iPhone**: open the link in Safari → Share → *Add to Home Screen*. Running from the home screen also keeps storage more reliable.
- **Android**: open in Chrome → menu → *Install app*.

The app works offline, and a new version loads automatically the next time you open it.

## Steps from Apple Health (and Huawei, Garmin, Fitbit…)
A web app can't read HealthKit directly, so an Apple Shortcut does the bridging. Watches like Huawei reach it by syncing into Apple Health first: Health app → Steps → *Data Sources & Access* → enable the watch's app.

Create a shortcut named **`WT Steps`**:
1. **Find Health Samples**: type *Steps*, start date in the last 14 days, group by *Day*.
2. **Repeat with Each** sample: **Format Date** (custom `yyyy-MM-dd`), then **Text** `[date] [Value]`.
3. **Combine Text** of the repeat results with new lines.
4. **Text**: `WTSTEPS`, a new line, then the combined text.
5. **Copy to Clipboard**.

Then tap **↻ Συγχρονισμός** (Sync) on the Steps card in Stats. After the first time, the button runs the shortcut for you. Steps can also be entered by hand, and the same instructions are in the app (✎ → *Πώς το συνδέω*).

## Tech
- Plain **HTML, CSS and JavaScript**: no framework, no build step, no dependencies.
- **PWA**: web manifest, home-screen icons, and a service worker that is network-first, always revalidates its own files and falls back to an offline cache.
- Charts, rings, the water bottle and the logo are hand-written **SVG**.
- Hosted on **GitHub Pages**.

```
index.html      markup for all four tabs and the dialogs
style.css       theme (green + coffee on a light background) and components
app.js          all app logic: logging, history, stats, steps, water, weigh-ins, backup
sw.js           service worker (offline + updates)
manifest.json   install metadata
icon*.png/svg   app icons
```

## Run locally
Any static file server works:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. After changing files, bump `CACHE` in `sw.js` so installed copies pick up the new version.

## Roadmap
- Dietitian's plan (PDF/photo) with daily meal check-offs
- Calories and protein against the plan's targets
- Workout templates (Push / Pull / Legs) and a session mode
- Native wrapper for automatic Apple Health sync

See [CHANGELOG.md](CHANGELOG.md) for release notes.
