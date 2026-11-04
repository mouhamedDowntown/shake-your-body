# Bouge 🏃

Move more, sit less, rest your eyes. A break reminder for office workers with
guided desk exercises (squats, desk push-ups, stretches) and 20-20-20 eye breaks.

## Features (v0.1)

- **Move reminders** every 20–90 min with a pop-up bubble and system notification
- **Guided routines** — Quick break, Full reset, Quiet stretch — with an animated
  figure showing the body position, reps or a countdown, and form tips
- **Eye breaks** — 20-second "look 6 m away" countdown every 20 min
- **Meeting mode** (pause 1 h), pause/resume, snooze 5 min
- **Stats** — breaks today, day streak, last 7 days. Stored locally (IndexedDB), nothing leaves the device

## Run it in GitHub Codespaces

1. Create a new empty repo on GitHub and push this folder:
   ```bash
   git init && git add . && git commit -m "Bouge v0.1"
   git branch -M main
   git remote add origin https://github.com/<you>/bouge.git
   git push -u origin main
   ```
2. On the repo page: **Code → Codespaces → Create codespace on main**.
   Dependencies install automatically.
3. In the Codespace terminal:
   ```bash
   npm run dev
   ```
   The app opens in a new browser tab. Click **Enable** to allow notifications.

> Tip: in ⚙️ Settings, pick **1 min (testing)** to see the reminders fire quickly.

## Run it locally

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # unit tests
npm run build   # production build in dist/
```

## Project layout

```
src/
  App.tsx                 main screen, overlays, settings
  components/
    Figure.tsx            animated stick figure (interpolates between 2 poses)
    RoutinePlayer.tsx     steps through a routine
    EyeBreak.tsx          20-20-20 countdown
  lib/
    exercises.ts          exercise library + routines  ← add new exercises here
    useScheduler.ts       move/eye timers (timestamp-based, survives tab throttling)
    stats.ts              streak & daily stats (+ tests)
    db.ts                 IndexedDB via Dexie
    notify.ts             notifications + chime (swap for Tauri later)
    settings.ts
  pose/README.md          plan for webcam rep counting (v2)
```

### Adding an exercise

In `src/lib/exercises.ts`, add an entry with two poses (A and B). The figure
animates between them. Coordinates are in a 200×200 box, side view facing right,
ground at y≈180. Then add its id to a routine's `steps`.

## Roadmap

- [ ] v0.2 — PWA install (`vite-plugin-pwa`), French translation, progressive reps
- [ ] v0.3 — Webcam rep counting & posture check with MediaPipe (see `src/pose/`)
- [ ] v0.4 — Desktop app with Tauri 2: tray icon, always-on-top bubble, start on boot,
      pause automatically during video calls
- [ ] Later — Team / office challenges (Supabase)

## Note on browsers

Browsers slow down timers in background tabs. Bouge uses timestamps, so the
countdown stays correct, but a reminder can arrive up to ~1 min late when the
tab has been hidden a long time. The Tauri desktop version removes this limit.
