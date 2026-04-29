import { useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { saveUser, getUserSettings, getWastageAll, saveStudyProgress } from "../firebase/db";
import useStore from "../store/useStore";

const GUEST_UID = "__guest__";

function migrateGuestProgressToUser(realUid) {
  if (typeof window === "undefined") return;
  const prefix = `stp:studyProgress:${GUEST_UID}:`;
  const movedDates = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const dateKey = key.slice(prefix.length);
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) || {};
        if (Object.keys(parsed).length > 0) {
          saveStudyProgress(realUid, dateKey, parsed);
          movedDates.push(dateKey);
        }
      } catch {}
    }
    movedDates.forEach(d => {
      try { window.localStorage.removeItem(`${prefix}${d}`); } catch {}
    });
  } catch {}
}

export function useAuth() {
  const { user, setUser, showToast, setSettings, setSettingsLoaded, setDarkMode, setStreak, currentExamId, currentPlanId, setIsGuest, setGuestSavePromptShown } = useStore();

  useEffect(() => {
    // Restore guest flag synchronously so the UI doesn't flash the welcome gate.
    try {
      if (localStorage.getItem("lp:isGuest") === "1") setIsGuest(true);
      if (localStorage.getItem("lp:guestPromptShown") === "1") setGuestSavePromptShown(true);
    } catch {}

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Guest → real user upgrade: migrate any locally-stored study progress.
        try {
          if (localStorage.getItem("lp:isGuest") === "1") {
            migrateGuestProgressToUser(firebaseUser.uid);
            localStorage.removeItem("lp:isGuest");
            localStorage.removeItem("lp:guestPromptShown");
          }
        } catch {}
        setIsGuest(false);
        setUser(firebaseUser);
        saveUser(firebaseUser.uid, {
          name:  firebaseUser.displayName,
          email: firebaseUser.email,
          photo: firebaseUser.photoURL,
          lastActive: Date.now(),
        });

        // Load settings + apply dark mode
        const settings = await getUserSettings(firebaseUser.uid);
        setSettings(settings);         // null if first-time user
        setSettingsLoaded(true);
        if (settings?.darkMode) setDarkMode(true);

        // Calculate streak from wastage history
        const wastage = await getWastageAll(firebaseUser.uid);
        setStreak(calcStreak(wastage));
      } else {
        setUser(null);
        setSettings(null);
        setSettingsLoaded(false);
        setDarkMode(false);
        setStreak(0);
      }
    });
    return () => unsub();
  }, []);

  // Sync currentExamId/currentPlanId to Firebase for session reminder function
  useEffect(() => {
    if (!user?.uid || !currentExamId) return;
    saveUser(user.uid, { currentExamId, currentPlanId: currentPlanId || null });
  }, [user?.uid, currentExamId, currentPlanId]);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      showToast("Login failed: " + e.message);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      showToast("Signed out");
    } catch (e) {
      showToast("Logout failed");
    }
  };

  return { user, login, logout };
}

export const GUEST_UID_PUBLIC = GUEST_UID;

function calcStreak(wastage) {
  // wastage tree is now {examId: {planId: {date: {sessionId: {...}}}}}
  // Flatten into {date: [sessionEntry, ...]} across every plan.
  const byDate = {};
  for (const examId in wastage || {}) {
    const plans = wastage[examId] || {};
    for (const planId in plans) {
      const dates = plans[planId] || {};
      for (const dateKey in dates) {
        const arr = byDate[dateKey] || (byDate[dateKey] = []);
        Object.values(dates[dateKey] || {}).forEach(s => arr.push(s));
      }
    }
  }

  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const key      = d.toISOString().split("T")[0];
    const sessions = byDate[key] || [];
    if (sessions.some(s => !s.missed)) {
      streak++;
    } else {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
