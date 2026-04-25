# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start Vite dev server (localhost:5173)
npm run build     # production build
npm run lint      # ESLint check
npm run preview   # preview production build
```

No test suite is configured.

## Rules
- Max 250 lines per component
- Max 500 lines per page
- Max 600 lines per DB file
- Separate file for every component
- Mobile + desktop responsive always
- Dark mode via CSS variables (stp-* classes)
- Ask clarifying questions before building

## Architecture

**React 19 + Vite SPA** with Firebase Realtime Database as the backend. No server-side rendering.

### Routing (src/App.jsx)
Five pages via React Router v7:
- `/` → `TodaysPlan` — exam/plan selector + session list
- `/live` → `LiveSession` — active timer + session controls
- `/wastage` → `WastageReport` — time-waste tracking & analytics
- `/groups` → `Groups` — study groups with chat, plans, and library
- `/leaderboard` → `Leaderboard` — global study-time rankings

### State Management (src/store/useStore.js)
Single Zustand store holds all app state: auth user, sessions, exams, plans, timer, leaderboard, notifications, group context, settings, and toast. Components read/write this store directly — there is no context API.

### Firebase Layer (src/firebase/)
- `config.js` — Firebase init (Realtime DB + Storage + Messaging)
- `db.js` — individual user data: exams, plans (nested under exams), sessions, wastage, settings, leaderboard
- `groupsDb.js` — groups CRUD, membership, invite codes, online presence
- `groupsLibrary.js` — shared resource library within groups
- `groupsEngagement.js` — group engagement features
- `messaging.js` — FCM push notifications

Firebase DB structure:
```
exams/{uid}/{examId}/plans/{planId}/sessions/{sessionId}
plans/{uid}/sessions/{sessionId}   ← legacy flat structure, kept for compat
groups/{gid}/members/{uid}
inviteCodes/{code} → gid
users/{uid}/groups/{gid}
```

### Timer (src/hooks/useTimer.js)
Singleton `setInterval` shared across all hook consumers to prevent multiple ticks when `TodaysPlan` and `LiveSession` are both mounted. Timer state lives in Zustand (`timerSeconds`, `timerRunning`, `activeSession`). Study time is accumulated per session in `sessionStudied[sessionId]`.

### AI Features (src/utils/aiService.js)
Calls a Firebase Cloud Function (`aiChat`) which proxies to OpenAI:
- Chat: `gpt-4o-mini`
- Analysis: `gpt-4.1`
- Function URL: `https://us-central1-leaderboard-98e8c.cloudfunctions.net/aiChat`
- Firebase functions source: `E:\my-project\functions\index.js`

### Design System
- Theme: `src/redesign/theme.css` — all CSS custom properties
- Always use `stp-*` CSS classes, never inline styles or Tailwind
- Fonts: Instrument Serif (headings), Inter (body), JetBrains Mono (timers)
- Accent: `#4E6B52` sage green
- Dark mode toggled via class on `<body>`, driven by `darkMode` in store

### Firebase Config
- Project: `leaderboard-98e8c`
- AppId: `1:952043922319:web:f94998ce71e566a07321fa`
- DB URL: `https://leaderboard-98e8c-default-rtdb.asia-southeast1.firebasedatabase.app`
- Deployed at: `webapp-rust-kappa.vercel.app`

### Utilities
- `src/utils/exportPDF.js` — jsPDF + autotable PDF export
- `src/utils/imageCompressor.js` — compress images before Firebase Storage upload
- `src/utils/imageCache.js` — in-memory cache for profile/group images
- `src/utils/notificationHelper.js` — FCM + in-app notification helpers
