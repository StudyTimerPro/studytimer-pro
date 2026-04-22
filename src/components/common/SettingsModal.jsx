import React, { useState, useEffect, useCallback } from "react";
import { updateProfile } from "firebase/auth";
import { auth } from "../../firebase/config";
import useStore from "../../store/useStore";
import { saveUserSettings, saveUser } from "../../firebase/db";
import { requestPermissionAndGetToken, testPushNotification } from "../../firebase/messaging";

export default function SettingsModal({ user, onClose }) {
  const { settings, setSettings, darkMode, setDarkMode, setUser, showToast } = useStore();

  const [displayName, setDisplayName] = useState(settings?.displayName || user?.displayName || "");
  const [dailyGoal,   setDailyGoal]   = useState(settings?.dailyGoalHours || 6);
  const [examName,    setExamName]    = useState(settings?.examName || "");
  const [examDate,    setExamDate]    = useState(settings?.examDate || "");
  const [busy,        setBusy]        = useState(false);
  const [notifStatus, setNotifStatus] = useState(() => {
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission;
  });

  // BUG FIX: added user.uid to the dependency array — previously the empty
  // deps array caused a stale closure where user.uid could be undefined/stale
  // on the first render (especially in React Strict Mode which runs effects twice).
  useEffect(() => {
    if (notifStatus === "granted" && user?.uid) {
      console.log("SettingsModal: permission already granted — auto-registering token...");
      requestPermissionAndGetToken(user.uid).then(token => {
        console.log("Enable Notifications result:", token);
      });
    }
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  // ^ intentionally omitting notifStatus so this only re-runs if uid changes

  // BUG FIX: close on Escape key — standard UX expectation for modals
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  async function handleEnableNotifications() {
    const token = await requestPermissionAndGetToken(user.uid);
    console.log("Enable Notifications result:", token);
    setNotifStatus(Notification.permission);
    if (token) showToast("Notifications enabled ✓");
    else if (Notification.permission === "denied") showToast("Enable notifications in browser settings");
  }

  async function handleSave() {
    // BUG FIX: validate displayName before hitting Firebase
    if (!displayName.trim()) {
      showToast("Display name cannot be empty");
      return;
    }

    setBusy(true);
    try {
      const updated = { ...settings, displayName: displayName.trim(), dailyGoalHours: dailyGoal, examName, examDate };
      await saveUserSettings(user.uid, updated);
      setSettings(updated);

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: displayName.trim() });

        /*
         * BUG FIX: previously spread `auth.currentUser` directly — Firebase User
         * is a class instance whose prototype methods and non-enumerable getters
         * are lost when spread into a plain object. This caused silent failures
         * anywhere the user object needed to call methods (e.g. getIdToken()).
         *
         * Fix: build a plain-object snapshot with only the fields the app reads.
         */
        setUser({
          uid:         auth.currentUser.uid,
          email:       auth.currentUser.email,
          displayName: displayName.trim(),
          photoURL:    auth.currentUser.photoURL,
          emailVerified: auth.currentUser.emailVerified,
        });
      }

      await saveUser(user.uid, { name: displayName.trim() });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", marginBottom: 24 }}>⚙️ Settings</h2>

      <Field label="Display Name">
        <input
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          style={inputS}
          placeholder="Your name"
        />
      </Field>

      <Field label={`Daily Study Goal — ${dailyGoal}h`}>
        <input
          type="range" min={1} max={12} value={dailyGoal}
          onChange={e => setDailyGoal(+e.target.value)}
          style={{ width: "100%", accentColor: "var(--accent)" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink2)", marginTop: 4 }}>
          <span>1h</span>
          <span style={{ color: "var(--accent)", fontWeight: 700 }}>{dailyGoal}h / day</span>
          <span>12h</span>
        </div>
      </Field>

      <Field label="Exam Name">
        <input value={examName} onChange={e => setExamName(e.target.value)} placeholder="e.g. TNPSC Group 4" style={inputS} />
      </Field>

      <Field label="Exam Date">
        <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} style={inputS} />
      </Field>

      <Field label="Dark Mode">
        <button
          onClick={() => setDarkMode(!darkMode)}
          style={{ ...inputS, cursor: "pointer", textAlign: "left", background: "var(--bg)" }}
        >
          {darkMode ? "☀️ Switch to Light Mode" : "🌙 Switch to Dark Mode"}
        </button>
      </Field>

      <Field label="Notifications">
        {notifStatus === "granted" ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ ...inputS, color: "#059669", background: "#d1fae5", border: "1px solid #059669", textAlign: "center", flex: 1 }}>
              ✅ Notifications enabled
            </div>
            <button
              onClick={async () => {
                const ok = await testPushNotification(user.uid);
                showToast(ok ? "Test notification sent!" : "No token — re-registering...");
                if (!ok) handleEnableNotifications();
              }}
              style={{ ...inputS, cursor: "pointer", background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--ink)", fontWeight: 600, whiteSpace: "nowrap", width: "auto", flexShrink: 0 }}>
              🧪 Test Push
            </button>
            <button
              onClick={handleEnableNotifications}
              style={{ ...inputS, cursor: "pointer", background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--ink)", fontWeight: 600, whiteSpace: "nowrap", width: "auto", flexShrink: 0 }}>
              🔄 Re-register
            </button>
          </div>
        ) : notifStatus === "denied" ? (
          <div style={{ ...inputS, color: "#dc2626", background: "#fde8e8", border: "1px solid #dc2626", fontSize: 12 }}>
            ❌ Blocked — enable in browser settings
          </div>
        ) : notifStatus === "unsupported" ? (
          <div style={{ ...inputS, color: "var(--ink2)", textAlign: "center", fontSize: 13 }}>
            Not supported in this browser
          </div>
        ) : (
          <button
            onClick={handleEnableNotifications}
            style={{ ...inputS, cursor: "pointer", background: "var(--accent)", color: "white", border: "none", textAlign: "center", fontWeight: 600 }}>
            🔔 Enable Notifications
          </button>
        )}
      </Field>

      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        <button onClick={onClose} style={cancelBtn}>Cancel</button>
        <button onClick={handleSave} disabled={busy} style={{ ...saveBtn, opacity: busy ? 0.7 : 1 }}>
          {busy ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </Overlay>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink2)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Overlay({ onClose, children }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div style={{ background: "var(--surface)", borderRadius: 16, padding: "32px 28px", width: "min(420px,100%)", boxShadow: "0 24px 64px rgba(0,0,0,.3)", maxHeight: "90vh", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

const inputS    = { width: "100%", padding: "10px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit", boxSizing: "border-box" };
const saveBtn   = { flex: 1, background: "var(--accent)", color: "white", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
const cancelBtn = { background: "none", border: "1.5px solid var(--border)", borderRadius: 10, padding: "11px 20px", fontSize: 14, cursor: "pointer", color: "var(--ink2)" };
