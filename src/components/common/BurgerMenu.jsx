import React, { useState, useRef, useEffect } from "react";
import useStore from "../../store/useStore";
import { exportPDF } from "../../utils/exportPDF";
import { saveUserSettings } from "../../firebase/db";
import SettingsModal from "./SettingsModal";
import HelpModal from "./HelpModal";
import TokensModal from "./TokensModal";

/* Redesigned burger → account menu. Same public props as before. */

export default function BurgerMenu({ user, onLogout, onSwitchAccount }) {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showTokens, setShowTokens] = useState(false);
  const menuRef = useRef(null);

  /*
   * BUG FIX (performance): previously used `useStore()` with full destructure,
   * which subscribes this component to every single store change and causes
   * unnecessary re-renders. Use fine-grained selectors instead so the component
   * only re-renders when the specific slice it cares about changes.
   */
  const exportSessions   = useStore(s => s.exportSessions);
  const wastageHistory   = useStore(s => s.wastageHistory);
  const darkMode         = useStore(s => s.darkMode);
  const setDarkMode      = useStore(s => s.setDarkMode);
  const streak           = useStore(s => s.streak);
  const tokensModalOpen  = useStore(s => s.tokensModalOpen);
  const closeTokensModal = useStore(s => s.closeTokensModal);

  // Open TokensModal when triggered from elsewhere (e.g. token-exhausted popup)
  useEffect(() => {
    if (tokensModalOpen) { setShowTokens(true); closeTokensModal(); }
  }, [tokensModalOpen]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function handleExport() { setOpen(false); exportPDF(user, exportSessions, wastageHistory); }

  function handleToggleDark() {
    const next = !darkMode;
    setDarkMode(next);
    if (user) saveUserSettings(user.uid, { darkMode: next });
  }

  function handleSettings()    { setOpen(false); setShowSettings(true); }
  function handleHelp()        { setOpen(false); setShowHelp(true); }
  function handleTokens()      { setOpen(false); setShowTokens(true); }
  function handleSwitch()      { setOpen(false); onSwitchAccount && onSwitchAccount(); }
  function handleLogoutClick() { setOpen(false); onLogout && onLogout(); }

  return (
    <>
      <div ref={menuRef} style={{ position: "relative" }}>
        <button
          onClick={() => setOpen(o => !o)}
          title="Menu"
          className="stp-icon-btn"
          style={{ width: 36, height: 36 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>

        {open && (
          <div className="stp-menu">
            <div className="stp-menu-head">
              <div className="name">{user?.displayName || "Not signed in"}</div>
              <div className="em">{user?.email || "Sign in to sync"}</div>
              {streak > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--amber)", fontWeight: 600 }}>
                  🔥 {streak}-day streak
                </div>
              )}
            </div>

            <div className="stp-menu-switch" onClick={handleToggleDark}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
                Dark mode
              </span>
              <span className={`stp-switch ${darkMode ? "on" : ""}`}></span>
            </div>

            <button className="stp-menu-item" onClick={handleExport}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
              </svg>
              Export PDF report
            </button>

            <div className="stp-menu-sep" />

            <button className="stp-menu-item" onClick={handleTokens}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9"/>
                <path d="M9 12h6M12 9v6"/>
              </svg>
              AI Tokens
            </button>

            <button className="stp-menu-item" onClick={handleSettings}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </button>

            <button className="stp-menu-item" onClick={handleHelp}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>
              </svg>
              Help & shortcuts
            </button>

            <div className="stp-menu-sep" />

            <button className="stp-menu-item" onClick={handleSwitch}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
              Switch account
            </button>

            <button className="stp-menu-item danger" onClick={handleLogoutClick}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              Log out
            </button>
          </div>
        )}
      </div>

      {showSettings && user && <SettingsModal user={user} onClose={() => setShowSettings(false)} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showTokens && user && <TokensModal user={user} onClose={() => setShowTokens(false)} />}
    </>
  );
}
