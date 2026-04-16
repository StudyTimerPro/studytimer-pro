import { create } from "zustand";

const useStore = create((set) => ({

  // ── Auth ──────────────────────────────────
  user: null,
  setUser: (user) => set({ user }),

  // ── Sessions / Plan ───────────────────────
  sessions: [],
  setSessions: (sessions) => set({ sessions }),

  // ── Active Timer Session ──────────────────
  activeSession: null,
  setActiveSession: (activeSession) => set({ activeSession }),

  // ── Timer ─────────────────────────────────
  timerSeconds: 0,
  timerRunning: false,
  setTimerSeconds: (timerSeconds) => set({ timerSeconds }),
  setTimerRunning: (timerRunning) => set({ timerRunning }),
  resetTimer: () => set({ timerSeconds: 0, timerRunning: false, activeSession: null }),

  // ── Leaderboard ───────────────────────────
  leaderboard: [],
  setLeaderboard: (leaderboard) => set({ leaderboard }),

  // ── Toast ─────────────────────────────────
  toast: null,
  showToast: (msg) => {
    set({ toast: msg });
    setTimeout(() => set({ toast: null }), 3000);
  },

  // ── PDF Export data ───────────────────────
  exportSessions:    [],
  setExportSessions: (exportSessions) => set({ exportSessions }),
  wastageHistory:    {},
  setWastageHistory: (wastageHistory) => set({ wastageHistory }),

  // ── Theme / Settings ─────────────────────
  darkMode:         false,
  setDarkMode:      (darkMode) => set({ darkMode }),
  settings:         null,   // null = not yet loaded; {} or obj = loaded
  setSettings:      (settings) => set({ settings }),
  settingsLoaded:   false,
  setSettingsLoaded:(settingsLoaded) => set({ settingsLoaded }),
  streak:           0,
  setStreak:        (streak) => set({ streak }),

}));

export default useStore;