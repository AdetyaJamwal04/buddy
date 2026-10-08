# GYM BUDDY — Premium Offline-First Fitness Companion

> **“Your gym companion, not another fitness dashboard.”**  
> *Apple Health × Strong × Hevy × Linear*

Gym Buddy is a mobile-first Progressive Web App (PWA) built from scratch to disappear into your workout session. Designed specifically for iPhone Safari ("Add to Home Screen") and responsive across tablets and desktops, it empowers serious lifters to train without friction or connectivity requirements.

---

## Key Highlights

- **100% Local-First & Offline-Ready**: Powered by IndexedDB via Dexie.js and Service Workers. Operates seamlessly in basement gyms, airplane mode, or spotty cellular reception.
- **Instant Training Access**: Open the app and begin today's scheduled split with a single tap.
- **Tactile Set Logging**: Large increment/decrement targets, automatic smart defaults prefilled from your last session, and set tagging (Warm-up, Normal, Failure).
- **Intelligent Rest Timer**: Automatically triggers upon set completion with floating countdown HUD, +15s / +30s extensions, skip action, and subtle acoustic chimes synthesized via the Web Audio API (zero audio file downloads required).
- **Automatic Progressive Overload**: Transparent suggestions based on your previous performance without pseudoscience.
- **Personal Record (PR) Engine**: Real-time detection of Heaviest Weight, Rep Record at Weight, and Estimated 1RM (Epley formula: $w \times (1 + r/30)$).
- **Weekly Workout Planner & Routine Builder**: Drag and configure splits (PPL, Upper/Lower, Bro Split, Full Body) with customizable rest days and exercise targets.
- **Supplement Tracking & Adherence**: Categorized by timing (Morning, Pre-Workout, Post-Workout, Night) with 1-tap adherence tracking and 7-day adherence scoring.
- **Private Body Measurement Log**: Track bodyweight, waist, chest, arms, and body fat percentage stored purely on-device.
- **Data Portability & Safety**: Instant full JSON export, JSON backup restoration, and safe reset capabilities.

---

## Architecture & Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Core Framework** | React 19 + TypeScript | Strict typing, component modularity, zero legacy patterns |
| **Build & Bundling** | Vite 8 + `@tailwindcss/vite` | Sub-second cold starts, instant HMR, tiny production bundles |
| **Styling & Design System** | Tailwind CSS v4 + Vanilla CSS Variables | Editorial dark theme (`#0D0E11` charcoal base), safe area padding (`env(safe-area-inset-top)` / `bottom`) |
| **Local Database** | Dexie.js (IndexedDB wrapper) | Transactional, structured local-first persistence with zero network latency |
| **PWA & Offline Caching**| `vite-plugin-pwa` (Workbox) | Offline precaching of app shell, manifest, icons, and dynamic resources |
| **Sound & Haptics** | Web Audio API + Vibration API | Clean synthetic frequency sweeps and chimes; works fully offline |
| **Testing** | Vitest + `fake-indexeddb` | Unit tests for calculations, PR engine, units conversion, and database storage |

---

## Database Architecture & Data Models

All state is maintained in IndexedDB under the database name `GymBuddyDB`.

### Tables:
1. `exercises`: Catalog of 26+ pre-seeded compound and isolation movements plus custom user exercises.
2. `workoutTemplates`: Workout routines (Push A, Pull A, Legs A, Upper Power, etc.) with ordered exercise targets.
3. `weeklySchedule`: Monday–Sunday schedule mapping days of week to routine templates or Rest Days.
4. `workoutSessions`: Training sessions (`startedAt`, `completedAt`, `durationSeconds`, `totalVolumeKg`, `totalSets`, `prCount`, `notes`, `rating`).
5. `sessionSets`: Detailed sets (`setIndex`, `weight`, `reps`, `type: normal | warmup | failure`, `isCompleted`).
6. `personalRecords`: All-time PR records (`type: weight | reps_at_weight | est_1rm`, `value`, `achievedAt`).
7. `supplements`: Active protocol entries (`name`, `dosage`, `timing: morning | pre_workout | post_workout | night`).
8. `supplementLogs`: Daily adherence logs keyed by date (`YYYY-MM-DD`).
9. `bodyMeasurements`: Private biometric records (`dateStr`, `weightKg`, `waistCm`, `chestCm`, `armsCm`, `bodyFatPct`).
10. `settings`: Preferences (`units: kg | lb`, `theme`, `defaultRestSeconds`, `soundEnabled`, `hapticsEnabled`, `autoStartTimer`).

---

## Installation & Development

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Setup
```bash
# Clone or navigate to the project directory
cd buddy

# Install dependencies
npm install

# Start development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Testing

Gym Buddy includes deterministic test suites covering core lifting math and local database persistence:

```bash
# Run unit and integration tests
npm test
```

### Tested Domains:
- **Estimated 1RM**: Accuracy of Epley formula across various rep ranges.
- **Unit Conversions**: Symmetric conversion between kilograms (`kg`) and pounds (`lb`).
- **Volume Calculations**: Strict non-zero completed working set accumulation.
- **PR Detection Engine**: Differentiation between weight records, rep records, and false positives.
- **Progressive Overload Logic**: Recommendation rules when hitting upper rep limits vs holding weights.
- **Database Seeding & Recovery**: Initial population, JSON backup export, and JSON restore integrity.

---

## Production Build & Preview

```bash
# Typecheck and build production distribution with PWA Service Worker
npm run build

# Preview production build locally
npm run preview
```

---

## How to Install on iPhone (Safari PWA)

Gym Buddy is engineered to behave as an iPhone native app:

1. Open **Safari** on your iPhone and visit the hosted URL (or local network IP during development, e.g., `http://192.168.x.x:5173`).
2. Tap the **Share** button in the Safari navigation bar (the square icon with an upward arrow).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **"Add"** in the top-right corner.
5. Launch **Gym Buddy** directly from your Home Screen. It will launch full-screen in standalone display mode without Safari's browser address bar, complete with notch safe-area handling and persistent offline caching.

---

## Production Deployment

You can deploy Gym Buddy to any static hosting provider (Vercel, Cloudflare Pages, Netlify, or GitHub Pages):

### Vercel / Netlify
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Single Page App Routing**: Automatically handled by Vite's HTML output.

---

## License
MIT
