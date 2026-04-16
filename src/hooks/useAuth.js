import { useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { saveUser, getUserSettings, getWastageAll } from "../firebase/db";
import useStore from "../store/useStore";

export function useAuth() {
  const { user, setUser, showToast, setSettings, setSettingsLoaded, setDarkMode, setStreak } = useStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        saveUser(firebaseUser.uid, {
          name:  firebaseUser.displayName,
          email: firebaseUser.email,
          photo: firebaseUser.photoURL,
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

function calcStreak(wastage) {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const key      = d.toISOString().split("T")[0];
    const sessions = Object.values((wastage || {})[key] || {});
    if (sessions.some(s => !s.missed)) {
      streak++;
    } else {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
