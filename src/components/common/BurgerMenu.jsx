import React, { useState, useRef, useEffect } from "react";
import useStore from "../../store/useStore";
import { exportPDF } from "../../utils/exportPDF";

export default function BurgerMenu({ user }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const { exportSessions, wastageHistory } = useStore();

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

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Menu"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 6px",
          borderRadius: 6,
          display: "flex",
          flexDirection: "column",
          gap: 5,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {[0, 1, 2].map(i => (
          <span
            key={i}
            style={{
              display: "block",
              width: 22,
              height: 2.5,
              background: "white",
              borderRadius: 2,
              transition: "transform .2s, opacity .2s",
              transform:
                open && i === 0 ? "translateY(7.5px) rotate(45deg)" :
                open && i === 2 ? "translateY(-7.5px) rotate(-45deg)" :
                open && i === 1 ? "scaleX(0)" : "none",
              opacity: open && i === 1 ? 0 : 1,
            }}
          />
        ))}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          left: 0,
          background: "white",
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,.18)",
          border: "1px solid #ddd9d2",
          minWidth: 200,
          zIndex: 999,
          overflow: "hidden",
        }}>
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
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "12px 16px",
        background: hover ? "#f0ede8" : "white",
        border: "none",
        cursor: "pointer",
        fontSize: 14,
        color: "#1a1814",
        textAlign: "left",
        fontFamily: "inherit",
        transition: "background .15s",
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </button>
  );
}
