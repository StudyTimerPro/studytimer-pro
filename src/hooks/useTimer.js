import { useEffect } from "react";
import useStore from "../store/useStore";

// ── Singleton ticker ───────────────────────────────────────────────────────────
// ONE interval shared across ALL hook instances (TodaysPlan, LiveSession, etc.)
// Prevents the "10× jump" caused by multiple components each creating their own
// setInterval when they're both mounted simultaneously.
let _tickerId = null;

function normalizeSeconds(value) {
  const secs = Number(value);
  return Number.isFinite(secs) ? secs : 0;
}

function getSessionDurationSeconds(session) {
  if (!session?.start || !session?.end) return 0;
  const [sh, sm] = session.start.split(":").map(Number);
  const [eh, em] = session.end.split(":").map(Number);
  return Math.max((eh * 60 + em) - (sh * 60 + sm), 0) * 60;
}

function persistElapsedSession(state) {
  const current = state.activeSession;
  if (!current?.id) return;

  const previousSecs = normalizeSeconds(state.sessionStudied?.[current.id]);
  const elapsedSecs = normalizeSeconds(state.timerSeconds);
  const totalSecs = previousSecs + elapsedSecs;

  if (totalSecs <= 0) return;

  const sessionDurationSecs = getSessionDurationSeconds(current);
  const nextSecs = sessionDurationSecs > 0
    ? Math.min(totalSecs, sessionDurationSecs)
    : totalSecs;

  setSessionTime(current.id, nextSecs);
}

function _syncTicker(running) {
  if (running && _tickerId === null) {
    _tickerId = setInterval(() => {
      const s = useStore.getState();
      const next = s.timerSeconds + 1;
      const current = s.activeSession;
      const totalSecs = getSessionDurationSeconds(current);
      const previousSecs = normalizeSeconds(s.sessionStudied?.[current?.id]);
      // Auto-stop the moment the session reaches its full scheduled duration.
      if (current?.id && totalSecs > 0 && previousSecs + next >= totalSecs) {
        const remainder = Math.max(totalSecs - previousSecs, 0);
        s.setTimerSeconds(remainder);
        // Clamp stored studied time to exactly the session length and stop.
        setSessionTime(current.id, totalSecs);
        s.setTimerRunning(false);
        return;
      }
      s.setTimerSeconds(next);
    }, 1000);
  } else if (!running && _tickerId !== null) {
    clearInterval(_tickerId);
    _tickerId = null;
  }
}
// ──────────────────────────────────────────────────────────────────────────────

/**
 * ADD `seconds` onto the existing total for `sessionId`.
 * Called when switching away from a session mid-study.
 */
export function flushSessionTime(sessionId, seconds) {
  const nextSeconds = normalizeSeconds(seconds);
  if (!sessionId || nextSeconds <= 0) return;
  useStore.getState().setSessionStudied(prev => ({
    ...prev,
    [sessionId]: normalizeSeconds(prev[sessionId]) + nextSeconds,
  }));
}

/**
 * OVERWRITE the stored time for `sessionId` to exactly `seconds`.
 * Used by auto-complete to clamp to the session's exact duration.
 */
export function setSessionTime(sessionId, seconds) {
  const nextSeconds = normalizeSeconds(seconds);
  if (!sessionId || nextSeconds < 0) return;
  useStore.getState().setSessionStudied(prev => ({
    ...prev,
    [sessionId]: nextSeconds,
  }));
}

export function useTimer() {
  const {
    timerSeconds,
    timerRunning,
    activeSession,
    setTimerRunning,
    setActiveSession,
    resetTimer,
    showToast,
  } = useStore();

  // Keep the singleton ticker in sync with timerRunning state.
  useEffect(() => {
    _syncTicker(timerRunning);
    // Intentionally no cleanup — the ticker should survive any single component
    // unmounting (the other tab still needs it). It stops only when timerRunning
    // becomes false via pause / reset.
  }, [timerRunning]);

  const start = () => {
    const state = useStore.getState();
    const current = state.activeSession;
    if (!current?.id) return;
    const totalSecs = getSessionDurationSeconds(current);
    const stored = normalizeSeconds(state.sessionStudied?.[current.id]);
    if (totalSecs > 0 && stored + state.timerSeconds >= totalSecs) {
      // Already complete — refuse to resume.
      showToast?.("Session already complete");
      return;
    }
    setTimerRunning(true);
  };

  // Pause: just stop the ticker. timerSeconds keeps its value so the visible
  // timer shows where it paused, and resume continues counting from there.
  // Persistence relies on beforeunload + session-switch flush.
  const pause = () => setTimerRunning(false);

  const reset = () => {
    persistElapsedSession(useStore.getState());
    resetTimer();
  };

  const startSession = (session) => {
    const state = useStore.getState();
    const current = state.activeSession;

    // Guest first-start prompt: show "Save your progress?" once per guest.
    if (state.isGuest && !state.guestSavePromptShown) {
      state.setGuestSavePromptShown(true);
      state.setGuestSavePromptOpen(true);
      try { localStorage.setItem("lp:guestPromptShown", "1"); } catch {}
    }

    // Reject if the target session is already fully studied.
    const targetDur = getSessionDurationSeconds(session);
    const targetStored = normalizeSeconds(state.sessionStudied?.[session.id]);
    const targetLive = current?.id === session.id ? state.timerSeconds : 0;
    if (targetDur > 0 && targetStored + targetLive >= targetDur) {
      showToast?.("Session already complete");
      return;
    }

    if (current?.id === session.id) {
      // ── Same session, just resume — do NOT reset ──
      setTimerRunning(true);
      return;
    }

    // ── Different session: explicitly save current elapsed BEFORE resetting ──
    // This replaces the unreliable prevRunningRef flush effect in TodaysPlan.
    // React 18 batches resetTimer()+setTimerRunning(true) so the effect's
    // false→true transition was silently skipped, losing the studied time.
    if (current?.id) {
      flushSessionTime(current.id, state.timerSeconds);
    }

    resetTimer();                  // timerSeconds → 0, timerRunning → false, activeSession → null
    setActiveSession(session);
    setTimerRunning(true);
    showToast("Timer started for: " + session.name);
  };

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return {
    timerSeconds,
    timerRunning,
    activeSession,
    start,
    pause,
    reset,
    startSession,
    formatTime,
  };
}
