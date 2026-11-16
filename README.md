# Workout Tracker

A personal workout log you install on your phone's home screen (a PWA). No accounts, no server. Data stays on the device and works offline.

## Features

- **Exercise library**: 130+ built-in exercises, grouped by muscle, with filters by equipment (filters are remembered). You can add custom exercises.
- **Logging**: weight and reps per set, with straight, pyramid, and drop-set styles. Supersets ("do one set of each, then rest"): select several exercises and tap *Add as superset*, or tap *Superset with next*.
- **Rest timer**: pops up when you check off a set. Each workout has a default rest, and each exercise or superset can override it. Supports ±15s, skip, and minimize. It stays accurate if the phone sleeps. Drop sets and mid-superset sets don't start a timer.
- **Templates**: save any finished workout as a template. Starting one pre-fills each exercise with your last weights and reps. If you change the exercises, the app offers to update the template when you finish.
- **Plateau suggestions**: if you've used the same top weight for 3 sessions in a row and hit your rep goal every time, the next workout bumps the weight automatically (+5 lb upper body, +10 lb lower body, or +2 reps for bodyweight moves), marked with ↑. You can tap *Undo*. If you're stuck at a weight without gaining reps, it suggests similar exercises to swap in.
- **Cardio**: a free-form notes field on every workout. You can log a cardio-only session too.
- **History**: a calendar of active days (lifting, cardio, or both) plus a list view. There's per-exercise history with a top-weight chart, best set, and estimated 1RM.
- **Backup**: export or import JSON from Settings.

## Install on your phone

1. Open the hosted URL in Safari (iPhone) or Chrome (Android).
2. iPhone: tap Share, then *Add to Home Screen*. Android: tap ⋮, then *Install app*.
3. Launch it from the home screen icon. It runs full-screen and works offline.

Data is stored in the browser's IndexedDB for that installed app. **Export a backup now and then.** Deleting the app or clearing site data erases it.

## Development

No build step and no dependencies: plain HTML, CSS, and ES modules.

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

When you ship changes, bump `VERSION` in `sw.js` so installed copies pick up the new files.

```
index.html            app shell + tab bar
css/app.css           styles (dark/light)
js/app.js             router
js/store.js           IndexedDB persistence, export/import
js/exercises.js       built-in exercise library
js/logic.js           history, plateau detection, prefill, templates
js/timer.js           rest timer overlay
js/ui.js              sheets, toasts, exercise picker, custom exercise form
js/views/*.js         screens
sw.js                 offline cache
```
