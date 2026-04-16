import React, { useState, useRef, useEffect } from "react";
import useStore from "../../store/useStore";
import { exportPDF } from "../../utils/exportPDF";
import { saveUserSettings } from "../../firebase/db";

export default function BurgerMenu({ user }) {
  const [open, setOpen] = useState(false);
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

  return (
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
          minWidth: 210, zIndex: 999, overflow: "hidden",
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
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick }) {
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
        fontSize: 14, color: "var(--ink)",
        textAlign: "left", fontFamily: "inherit",
        transition: "background .15s",
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </button>
  );
}
