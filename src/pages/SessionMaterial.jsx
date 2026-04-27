import React, { useEffect, useState } from "react";
import MaterialHome from "../components/material/MaterialHome";
import TopicHierarchyView from "../components/material/TopicHierarchyView";
import MaterialHistory from "../components/material/MaterialHistory";

/*
 * Full-page Session Material section.
 * Mounted from TodaysPlan as a fixed full-screen surface (not a router route, to
 * preserve in-memory timer state). Tabs: Home / Topic Hierarchy / Saved.
 */

const TABS = [
  { id: "home",      label: "Home",      ic: "🏠" },
  { id: "hierarchy", label: "Hierarchy", ic: "🗂" },
  { id: "saved",     label: "Saved",     ic: "📂" },
];

function durationLabel(s) {
  if (!s) return "—";
  if (Number(s.durationMins) > 0) {
    const m = Number(s.durationMins);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  }
  if (s.start && s.end) {
    const [sh, sm] = s.start.split(":").map(Number);
    const [eh, em] = s.end.split(":").map(Number);
    const m = Math.max((eh * 60 + em) - (sh * 60 + sm), 0);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  }
  return "—";
}

function prettyPri(p) {
  if (!p) return "Medium";
  return p[0].toUpperCase() + p.slice(1);
}

export default function SessionMaterial({
  user, examId, planId, session, examName, planName,
  showToast, onClose, initialQuickType,
}) {
  const [tab, setTab] = useState("home");

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Esc closes
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose?.(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!session) return null;

  return (
    <div className="stp-mat-page">
      <div className="stp-mat-topbar">
        <button className="stp-mat-back" onClick={onClose} aria-label="Close material">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </button>
        <div className="stp-mat-titleblock">
          <div className="stp-mat-eyebrow">Session Material</div>
          <h2 className="stp-mat-title">
            {session.name || "Untitled session"}
          </h2>
          <div className="stp-mat-meta-row">
            <span className="stp-mat-chip">⏱ {durationLabel(session)}</span>
            <span className="stp-mat-chip">⚡ {prettyPri(session.priority)} priority</span>
            {examName && <span className="stp-mat-chip">🎓 {examName}</span>}
          </div>
        </div>
      </div>

      <nav className="stp-mat-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`stp-mat-tab${tab === t.id ? " on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span aria-hidden>{t.ic}</span> {t.label}
          </button>
        ))}
      </nav>

      <main className="stp-mat-main">
        {tab === "home" && (
          <MaterialHome
            user={user}
            examId={examId}
            planId={planId}
            session={session}
            examName={examName}
            showToast={showToast}
            initialQuickType={initialQuickType}
            onOpenHierarchy={() => setTab("hierarchy")}
          />
        )}
        {tab === "hierarchy" && (
          <TopicHierarchyView
            user={user}
            examId={examId}
            planId={planId}
            session={session}
            examName={examName}
            planName={planName}
            showToast={showToast}
          />
        )}
        {tab === "saved" && (
          <MaterialHistory
            user={user}
            examId={examId}
            planId={planId}
            session={session}
            showToast={showToast}
          />
        )}
      </main>
    </div>
  );
}
