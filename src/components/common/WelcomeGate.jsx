import React, { useState } from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../../firebase/config";
import useStore from "../../store/useStore";

export default function WelcomeGate() {
  const [busy, setBusy] = useState(false);
  const setIsGuest = useStore(s => s.setIsGuest);
  const showToast = useStore(s => s.showToast);

  async function handleGoogle() {
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      showToast("Sign-in failed: " + (e.message || "try again"));
      setBusy(false);
    }
  }

  function handleGuest() {
    try { localStorage.setItem("lp:isGuest", "1"); } catch {}
    setIsGuest(true);
  }

  return (
    <div className="lp-welcome">
      <div className="lp-welcome-card">
        <div className="lp-welcome-logo-wrap">
          <img src="/logo.jpeg" alt="Lighthouse Prep" className="lp-welcome-logo" />
        </div>
        <h1 className="lp-welcome-name">Lighthouse Prep</h1>
        <div className="lp-welcome-tag">Focus. Track. Improve.</div>

        <div className="lp-welcome-actions">
          <button className="lp-welcome-btn primary" onClick={handleGoogle} disabled={busy}>
            <GoogleIcon />
            {busy ? "Signing in…" : "Continue with Google"}
          </button>
          <button className="lp-welcome-btn ghost" onClick={handleGuest} disabled={busy}>
            Continue as Guest
          </button>
        </div>

        <div className="lp-welcome-fine">
          By continuing, you accept our terms. Guest progress is saved on this device.
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.5 29.3 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.5 29.3 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 43.5c5.2 0 9.9-2 13.5-5.2l-6.2-5.3c-2 1.5-4.6 2.4-7.3 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39 16.2 43.5 24 43.5z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.2 5.3C40.6 36.7 43.5 31 43.5 24c0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
