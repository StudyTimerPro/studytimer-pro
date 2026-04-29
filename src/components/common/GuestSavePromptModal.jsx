import React, { useState } from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../../firebase/config";
import useStore from "../../store/useStore";

export default function GuestSavePromptModal() {
  const [busy, setBusy] = useState(false);
  const setGuestSavePromptOpen = useStore(s => s.setGuestSavePromptOpen);
  const showToast = useStore(s => s.showToast);

  async function handleGoogle() {
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setGuestSavePromptOpen(false);
    } catch (e) {
      showToast("Sign-in failed: " + (e.message || "try again"));
      setBusy(false);
    }
  }

  function handleNotNow() {
    setGuestSavePromptOpen(false);
  }

  return (
    <div className="stp-scrim" style={{ zIndex: 1200 }} onClick={(e) => e.target === e.currentTarget && handleNotNow()}>
      <div className="lp-guest-modal">
        <div className="lp-guest-emoji">📚</div>
        <h3>Save your progress?</h3>
        <p>You have started your study journey. Sign in to keep your plan safe across devices.</p>
        <div className="lp-guest-actions">
          <button className="lp-welcome-btn primary" onClick={handleGoogle} disabled={busy}>
            {busy ? "Signing in…" : "Continue with Google"}
          </button>
          <button className="lp-welcome-btn ghost" onClick={handleNotNow} disabled={busy}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
