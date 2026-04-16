import React, { useState, useRef, useEffect } from "react";
import useStore from "../../store/useStore";
import { exportPDF } from "../../utils/exportPDF";
import { saveUserSettings } from "../../firebase/db";
import SettingsModal from "./SettingsModal";
import HelpModal from "./HelpModal";

export default function BurgerMenu({ user, onLogout, onSwitchAccount }) {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const menuRef = useRef(null);
  const { exportSessions, wastageHistory, darkMode, setDarkMode, streak } = useStore();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function handleExport() {
    setOpen(false);
    exportPDF(user, exportSessions, wastageHistory);
  }

  function handleToggleDark() {
    setOpen(false);
    const next = !darkMode;
    setDarkMode(next);
    if (user) saveUserSettings(user.uid, { darkMode: next });
  }

  function handleSettings() {
    setOpen(false);
    setShowSettings(true);
  }

  function handleHelp() {
    setOpen(false);
    setShowHelp(true);
  }

  function handleSwitchAccount() {
    setOpen(false);
    if (onSwitchAccount) onSwitchAccount();
  }

  function handleLogout() {
    setOpen(false);
    if (onLogout) onLogout();
  }

  return (
    <>
      <div ref={menuRef} style={{ position: "relative" }}>
        {/* Hamburger button */}
        <button
          onClick={() => setOpen(o => !o)}
          title="Menu"
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "4px 6px", borderRadius: 6,
            display: "flex", flexDirection: "column",
            gap: 5, alignItems: "center", justifyContent: "center",
          }}
        >
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              display: "block", width: 22, height: 2.5,
              background: "white", borderRadius: 2,
              transition: "transform .2s, opacity .2s",
              transform:
                open && i === 0 ? "translateY(7.5px) rotate(45deg)" :
                open && i === 2 ? "translateY(-7.5px) rotate(-45deg)" : "none",
              opacity: open && i === 1 ? 0 : 1,
            }} />
          ))}
        </button>

        {/* Dropdown */}
        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", left: 0,
            background: "var(--surface)", borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,.2)",
            border: "1px solid var(--border)",
            minWidth: 220, zIndex: 999, overflow: "hidden",
          }}>
            {/* Streak badge */}
            {streak > 0 && (
              <div style={{
                padding: "10px 16px", borderBottom: "1px solid var(--border)",
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 13, color: "var(--ink2)",
              }}>
                🔥 <span><strong style={{ color: "var(--amber)" }}>{streak}</strong>-day streak</span>
              </div>
            )}

            <MenuItem icon={darkMode ? "☀️" : "🌙"} label={darkMode ? "Light Mode" : "Dark Mode"} onClick={handleToggleDark} />
            <MenuItem icon="📄" label="Export PDF Report" onClick={handleExport} />

            <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />

            <MenuItem icon="⚙️" label="Settings" onClick={handleSettings} />
            <MenuItem icon="❓" label="Help" onClick={handleHelp} />

            <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />

            <MenuItem icon="🔄" label="Switch Account" onClick={handleSwitchAccount} />
            <MenuItem icon="🚪" label="Logout" onClick={handleLogout} danger />
          </div>
        )}
      </div>

      {showSettings && user && (
        <SettingsModal user={user} onClose={() => setShowSettings(false)} />
      )}
      {showHelp && (
        <HelpModal onClose={() => setShowHelp(false)} />
      )}
    </>
  );
}

function MenuItem({ icon, label, onClick, danger }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        width: "100%", padding: "12px 16px",
        background: hover ? "var(--bg)" : "var(--surface)",
        border: "none", cursor: "pointer",
        fontSize: 14,
        color: danger ? (hover ? "#e53935" : "#ef5350") : "var(--ink)",
        textAlign: "left", fontFamily: "inherit",
        transition: "background .15s, color .15s",
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </button>
  );
}
