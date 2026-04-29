import { create } from "zustand";

const useStore = create((set) => ({

  // ── Auth ──────────────────────────────────
  user: null,
  setUser: (user) => set({ user }),
  isGuest: false,
  setIsGuest: (isGuest) => set({ isGuest }),
  guestSavePromptShown: false,
  setGuestSavePromptShown: (guestSavePromptShown) => set({ guestSavePromptShown }),
  guestSavePromptOpen: false,
  setGuestSavePromptOpen: (guestSavePromptOpen) => set({ guestSavePromptOpen }),

  // ── Sessions / Plan ───────────────────────
  sessions: [],
  setSessions: (sessions) => set({ sessions }),

  // ── Exams ─────────────────────────────────
  exams: [],
  setExams: (exams) => set({ exams }),
  currentExamId: null,
  setCurrentExamId: (currentExamId) => set({ currentExamId }),
  currentExamName: "",
  setCurrentExamName: (currentExamName) => set({ currentExamName }),

  // ── Plans ─────────────────────────────────
  plans: [],
  setPlans: (plans) => set({ plans }),
  currentPlanId: null,
  setCurrentPlanId: (currentPlanId) => set({ currentPlanId }),
  currentPlanName: "",
  setCurrentPlanName: (currentPlanName) => set({ currentPlanName }),
  // "fixed" (timeline / wastage) | "flexible" (ordered tasks / insights)
  currentPlanMode: "fixed",
  setCurrentPlanMode: (currentPlanMode) => set({ currentPlanMode }),

  // ── Active Timer Session ──────────────────
  activeSession: null,
  setActiveSession: (activeSession) => set({ activeSession }),

  // ── Study-time tracking (per session, survives tab switches) ──────
  // { [sessionId]: totalSecondsStudied }
  // Supports both plain object and functional updater: setSessionStudied(prev => ({...prev, x: y}))
  sessionStudied: {},
  setSessionStudied: (updater) =>
    set(state => ({
      sessionStudied: typeof updater === "function"
        ? updater(state.sessionStudied)
        : updater,
    })),

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

  // ── Notifications ──────────────────────────
  unreadNotifCount: 0,
  setUnreadNotifCount: (unreadNotifCount) => set({ unreadNotifCount }),
  notifications:    [],
  setNotifications: (notifications) => set({ notifications }),

  // ── Token purchase modals ─────────────────
  tokenExhaustedModal:     false,
  showTokenExhaustedModal: () => set({ tokenExhaustedModal: true }),
  hideTokenExhaustedModal: () => set({ tokenExhaustedModal: false }),
  tokensModalOpen:         false,
  openTokensModal:         () => set({ tokensModalOpen: true }),
  closeTokensModal:        () => set({ tokensModalOpen: false }),

  // ── Current Group context (for Navbar bell) ─────────────────
  currentGroupId:         null,
  setCurrentGroupId:      (currentGroupId) => set({ currentGroupId }),
  currentGroupRole:       null,
  setCurrentGroupRole:    (currentGroupRole) => set({ currentGroupRole }),
  currentGroupName:       "",
  setCurrentGroupName:    (currentGroupName) => set({ currentGroupName }),
  currentGroupMembers:    {},
  setCurrentGroupMembers: (currentGroupMembers) => set({ currentGroupMembers }),
  groupPendingCount:      0,
  setGroupPendingCount:   (groupPendingCount) => set({ groupPendingCount }),
  showGroupNotif:         false,
  setShowGroupNotif:      (showGroupNotif) => set({ showGroupNotif }),

}));

export default useStore;
