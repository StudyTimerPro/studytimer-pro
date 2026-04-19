import React, { useEffect } from "react";
import Navbar from "./Navbar";
import useStore from "../../store/useStore";

export default function Layout({ children }) {
  const toast    = useStore((s) => s.toast);
  const darkMode = useStore((s) => s.darkMode);

  // Apply / remove dark class on <body>
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [darkMode]);

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--bg)", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ flexShrink: 0 }}><Navbar /></div>
      <div style={{ flexShrink: 0 }}><ActiveBanner /></div>

      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {children}
      </main>

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24,
          background: "var(--nav-bg)", color: "white",
          padding: "12px 20px", borderRadius: 10,
          fontSize: 13, zIndex: 9999,
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          animation: "fadeIn .3s ease",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function ActiveBanner() {
  const activeSession = useStore((s) => s.activeSession);
  const timerSeconds  = useStore((s) => s.timerSeconds);

  if (!activeSession) return null;

  const m = String(Math.floor(timerSeconds / 60)).padStart(2, "0");
  const s = String(timerSeconds % 60).padStart(2, "0");

  return (
    <div style={{
      background: "var(--accent)", color: "white",
      padding: "10px 24px", textAlign: "center",
      fontSize: 14, fontWeight: 500,
    }}>
      ▶ Now studying: <strong style={{ fontFamily: "monospace" }}>{activeSession.name}</strong>
      &nbsp;·&nbsp; {m}:{s}
    </div>
  );
}
