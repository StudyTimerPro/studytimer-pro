import React, { useEffect } from "react";
import Navbar from "./Navbar";
import useStore from "../../store/useStore";

/* Redesigned layout shell. Import redesign/theme.css once at the app entry. */

export default function Layout({ children }) {
  const toast     = useStore((s) => s.toast);
  const showToast = useStore((s) => s.showToast);
  const darkMode  = useStore((s) => s.darkMode);

  // BUG FIX: apply dark mode class to body
  useEffect(() => {
    if (darkMode) document.body.classList.add("dark");
    else          document.body.classList.remove("dark");
  }, [darkMode]);

  // BUG FIX: auto-dismiss toast after 3 s so it doesn't stick forever
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => showToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast, showToast]);

  return (
    /*
     * BUG FIX (scroll): previously minHeight:100vh on the wrapper meant the
     * document never grew beyond the viewport, so content was clipped and
     * unscrollable when there were many plan items.
     *
     * Fix: outer wrapper is exactly 100vh with overflow:hidden so the sticky
     * Navbar + ActiveBanner stay pinned, and <main> gets flex:1 + overflowY:auto
     * so it becomes the only scrolling region.
     */
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      background: "var(--bg)",
      overflow: "hidden",
    }}>
      <Navbar />
      <ActiveBanner />

      <main style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {children}
      </main>

      {toast && <div className="stp-toast">{toast}</div>}
    </div>
  );
}

function ActiveBanner() {
  const activeSession = useStore((s) => s.activeSession);
  const timerRunning  = useStore((s) => s.timerRunning);
  const timerSeconds  = useStore((s) => s.timerSeconds);
  if (!activeSession || !timerRunning) return null;

  const m = String(Math.floor(timerSeconds / 60)).padStart(2, "0");
  const s = String(timerSeconds % 60).padStart(2, "0");

  return (
    <div className="stp-active-banner">
      <div className="stp-ab-left">
        <div className="stp-ab-dot" />
        <div>
          <div className="stp-ab-title">Now studying · <em>{activeSession.name}</em></div>
          <div className="stp-ab-meta">
            {activeSession.subject || "Session in progress"}
          </div>
        </div>
      </div>
      <div className="stp-ab-timer">{m}:{s}</div>
    </div>
  );
}
