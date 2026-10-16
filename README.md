# Workout Tracker

A phone-first workout tracker that runs entirely in the browser. Lifting log with
double-progression suggestions, cardio and interval timer, body-weight trend, progress
charts, history calendar, editable routines, multiple profiles, JSON backup, and a
client-side Apple Health importer. No backend, no accounts: data lives in IndexedDB on the
device, per profile.

Built with Vite and plain JavaScript. One runtime dependency (`fflate`, for reading the
Apple Health zip). Installable as a PWA and works offline.

## Features

- **Profiles.** Several people on one device, each with their own goal weight, units,
  routines, exercises, and history. Switch from the header.
- **Routines.** Seeded with a 3-day full-body A/B program and a winter 4-day upper/lower
  split with an optional conditioning day. Every day, exercise, rep range, rest, and cardio
  finisher is editable. Rotation order and default training days live on the routine.
- **Weekly plan.** Training days default to Mon/Tue/Thu. Tap a day to start, move it to
  another date, swap in a different routine day, or make it a rest day. Or just "Start any
  workout" today.
- **Logger.** Sets, reps, weight per exercise with pre-fill from the last session, add or
  remove sets, per-exercise notes, substitutions, and a live PR indicator.
- **Double progression.** When every set hits the top of its rep range, the next session
  suggests a heavier weight (default +5 lb lower body, +2.5 lb upper body, configurable per
  profile and per exercise). Shown before you start; accept or keep the old weight.
- **Rest timer.** Auto-starts after each set (configurable), with +15/−15 and skip.
- **Cardio.** Treadmill, bike, rower, elliptical, run, other. Duration, distance,
  intensity, incline or resistance, average heart rate, and interval structure with a
  full-screen interval timer (audio and vibration cues).
- **Body weight.** Log weigh-ins and see the trend with a 7-day average and goal line.
- **Progress.** Per-exercise top set, estimated 1RM, and volume over time. Weekly workouts,
  lifting volume, cardio minutes, and cardio miles.
- **History.** Calendar of lifting, cardio, and weigh-ins. Tap to view, edit, or delete.
- **Backup.** Export one profile or everything to JSON. Import with merge or replace.
- **Apple Health import.** Upload `export.zip` (or `export.xml`). Parsed in a Web Worker
  in chunks, so multi-hundred-MB exports work. Imports body weight, workouts, and daily
  heart-rate summaries. Safe to re-import: duplicates are skipped.

## Setup

Requires Node 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173/workout-tracker/
npm test           # unit tests (vitest)
npm run build      # production build into dist/, plus the service worker
npm run preview    # serve dist/ locally
```

The dev server and the build both use the `/workout-tracker/` base path so it matches a
GitHub Pages project site. Set `BASE_PATH=/` if you deploy at a domain root.

## Deploy to GitHub Pages

1. Create a repository on GitHub (for example `workout-tracker`) and push this code to its
   `main` branch.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main` (or run the "Deploy to GitHub Pages" workflow from the Actions tab). The
   workflow in `.github/workflows/deploy.yml` runs the tests, builds, and publishes `dist/`.
4. The site appears at `https://<your-username>.github.io/<repo-name>/`.

The workflow derives the base path from the repository name, so renaming the repo keeps
the site working. For a custom domain or a user site (`<username>.github.io`), set
`BASE_PATH: /` in the workflow's build step.

### Install on iPhone

Open the site in Safari, tap **Share**, then **Add to Home Screen**. The app then runs
full-screen and offline. Updates are picked up the next time you open it with a network
connection.

Private Browsing blocks IndexedDB on iOS, so use a normal tab or the home-screen app.

## Backup and moving between devices

Data never leaves the device on its own. To keep a copy or move to another phone:

1. **More → Settings → Backup → Export this profile** (or Export everything). On iPhone
   this opens the share sheet; save to Files, iCloud Drive, or AirDrop it.
2. On the other device, open the app, **Settings → Import backup**, choose the file, and
   pick **Merge** (adds anything new) or **Replace** (wipes that profile's data first).

Export regularly. Clearing Safari website data deletes the app's database.

## Apple Health import

This is a manual import, not live sync.

1. On the iPhone, open **Health**, tap your picture, then **Export All Health Data**.
2. Save `export.zip` to Files.
3. In the app, **More → Apple Health import**, choose the zip, and wait. A multi-year
   export takes a minute or two; the file is streamed and never uploaded.

What is imported into the active profile:

| Apple Health                                  | App                                                |
| --------------------------------------------- | -------------------------------------------------- |
| Body mass records                             | Weigh-ins                                          |
| Running, cycling, rowing, elliptical, walking… | Cardio entries with duration, distance, average HR |
| Strength-training workouts                    | History entries (duration and HR only, no sets)    |
| Heart-rate samples, resting heart rate        | One summary row per day (avg, min, max, resting)   |

Each imported record gets a stable id derived from its type and timestamps, so importing
the same export again adds nothing.

## Data model

One IndexedDB database with these stores, all keyed by `id` and indexed by `profileId`
(and `[profileId, date]` for anything dated):

- `profiles`: name, goal weight, units, settings (training days, mode, active routine,
  rest timer, increments, theme)
- `exercises`: name, equipment, region, muscles, notes, substitutions, increment override
- `routines`: days with slots (exercise, sets, rep range, rest) and a cardio finisher,
  plus the rotation order
- `plans`: per-date schedule overrides (moved or swapped days, explicit rest)
- `workouts`: entries with sets (`weightLb`, `reps`, `done`, `pr`), suggestion, notes
- `cardio`, `bodyweight`, `hrDaily`, `meta`

Weight is stored in pounds and distance in miles; the unit setting only affects display.

## Project layout

```
src/
  app.js, main.js, router.js, state.js   shell, routing, current profile
  db/        schema, IndexedDB helpers, repository functions
  domain/    seed program, progression, PRs, schedule, stats, units, dates
  import/    JSON backup, Apple Health parser/mapper/worker
  ui/        DOM helper, sheets, charts, timers, audio, exercise picker
  views/     one module per screen
tests/       vitest unit tests for the domain logic, parser, and backup
scripts/     build-sw.js (service worker precache list), make-icons.js
```

## License

MIT
