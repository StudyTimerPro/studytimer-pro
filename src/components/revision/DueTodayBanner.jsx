import React, { useEffect, useMemo, useState } from "react";
import { listenRevisionItems } from "../../firebase/revisionDb";
import {
  filterDueOn, summarize, todayISO, classifyItem,
} from "../../utils/revisionScheduler";
import SessionRevisionModal from "./SessionRevisionModal";
import ForgettingCurveGraph from "./ForgettingCurveGraph";

/**
 * DueTodayBanner — sits on the TodaysPlan page above the toolbar.
 * Shows urgent / weak / strong counts, due-today list snippet, and a quick
 * Revise CTA that opens the cross-session revision queue.
 *
 * Props: { user, examId, planId, examName, sessions, showToast }
 */
export default function DueTodayBanner({
  user, examId, planId, examName, sessions, showToast,
}) {
  const [items, setItems] = useState({});
  const [open, setOpen] = useState(false);
  const [showCurve, setShowCurve] = useState(false);

  useEffect(() => {
    if (!user || !examId || !planId) { setItems({}); return; }
    const u = listenRevisionItems(user.uid, examId, planId, setItems);
    return () => typeof u === "function" && u();
  }, [user, examId, planId]);

  const today = todayISO();
  const stats = useMemo(() => summarize(items, today), [items, today]);
  const dueAll = useMemo(() => filterDueOn(items, null, today), [items, today]);

  // Aggregate "virtual session" object so the modal lists every due topic
  // across this plan (sessionId=null inside SessionRevisionModal would still
  // require a real session). Instead pick the session whose due-list is
  // largest and pass that — keeps the modal logic simple and a per-session
  // entry point. Empty queue still shows the helpful "nothing due" state.
  const headlineSession = useMemo(() => {
    if (!sessions?.length) return null;
    const counts = {};
    dueAll.forEach(d => { if (d.sessionId) counts[d.sessionId] = (counts[d.sessionId] || 0) + 1; });
    const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return sessions.find(s => s.id === topId) || sessions[0];
  }, [dueAll, sessions]);

  if (stats.total === 0) return null;

  const bannerCls = stats.urgent > 0
    ? "stp-due-banner urgent"
    : stats.weak > 0
      ? "stp-due-banner weak"
      : stats.due > 0
        ? "stp-due-banner due"
        : "stp-due-banner strong";

  const headline = stats.urgent > 0
    ? `${stats.urgent} urgent · revise now to lock memory`
    : stats.weak > 0
      ? `${stats.weak} weak topic${stats.weak === 1 ? "" : "s"} need attention`
      : stats.due > 0
        ? `${stats.due} topic${stats.due === 1 ? "" : "s"} due today`
        : `${stats.strong} strong · long-term retention building`;

  const previewItems = dueAll.slice(0, 3);

  return (
    <>
      <div className={bannerCls}>
        <div className="stp-due-left">
          <div className="stp-due-title">Due today</div>
          <div className="stp-due-headline">{headline}</div>
          <div className="stp-due-counts">
            <span className="stp-due-count urgent">
              <span className="dot" /> {stats.urgent} urgent
            </span>
            <span className="stp-due-count weak">
              <span className="dot" /> {stats.weak} weak
            </span>
            <span className="stp-due-count strong">
              <span className="dot" /> {stats.strong} strong
            </span>
          </div>
          {previewItems.length > 0 && (
            <div className="stp-due-preview">
              {previewItems.map(it => (
                <span key={it.slug} className={`stp-due-chip ${classifyItem(it, today)}`}>
                  {it.subtopic_name}
                </span>
              ))}
              {dueAll.length > previewItems.length && (
                <span className="stp-due-chip more">+{dueAll.length - previewItems.length} more</span>
              )}
            </div>
          )}
        </div>
        <div className="stp-due-right">
          <div className="stp-due-stat">
            <div className="v">{stats.due}</div>
            <div className="l">due now</div>
          </div>
          <button
            className="stp-btn primary"
            onClick={() => setOpen(true)}
            disabled={stats.due === 0 || !headlineSession}
          >
            ⚡ Quick revise
          </button>
          <button
            className="stp-btn small"
            onClick={() => setShowCurve(v => !v)}
            title="Toggle forgetting curve"
          >
            {showCurve ? "Hide curve" : "📉 Curve"}
          </button>
        </div>
      </div>

      {showCurve && (
        <div className="stp-fc-section">
          <div className="stp-fc-head">
            <div className="stp-fc-title">Memory retention</div>
            <div className="stp-fc-sub">
              Average across {stats.total} topic{stats.total === 1 ? "" : "s"} ·
              drops as you forget, jumps back when you revise
            </div>
          </div>
          <ForgettingCurveGraph items={items} />
        </div>
      )}

      {open && headlineSession && (
        <SessionRevisionModal
          user={user}
          examId={examId}
          planId={planId}
          examName={examName}
          session={headlineSession}
          onClose={() => setOpen(false)}
          showToast={showToast}
        />
      )}
    </>
  );
}
