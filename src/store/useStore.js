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

}));

export default useStore;