import { useEffect, useRef } from "react";
import useStore from "../store/useStore";

export function useTimer() {
  const {
    timerSeconds,
    timerRunning,
    activeSession,
    setTimerSeconds,
    setTimerRunning,
    setActiveSession,
    resetTimer,
    showToast,
  } = useStore();

  const intervalRef = useRef(null);

  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        setTimerSeconds(useStore.getState().timerSeconds + 1);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [timerRunning]);

  const start = () => setTimerRunning(true);
  const pause = () => setTimerRunning(false);
  const reset = () => resetTimer();

  const startSession = (session) => {
    resetTimer();
    setActiveSession(session);
    setTimerRunning(true);
    showToast("Timer started for: " + session.name);
  };

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    }
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
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