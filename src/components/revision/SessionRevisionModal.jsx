import React, { useEffect, useMemo, useState } from "react";
import { listenRevisionItems } from "../../firebase/revisionDb";
import {
  filterDueOn, todayISO, classifyItem, memoryHint, LEVEL_FORMATS,
} from "../../utils/revisionScheduler";
import RevisionQuiz from "./RevisionQuiz";

/**
 * SessionRevisionModal — opens from the Revise button on a session card.
 * Lists every revision item under this session that is due today (or overdue),
 * then walks the user through them via RevisionQuiz one at a time.
 *
 * Props: { user, examId, planId, examName, session, onClose, showToast }
 */
export default function SessionRevisionModal({
  user, examId, planId, examName, session, onClose, showToast,
}) {
  const [items, setItems] = useState({});
  const [activeSlug, setActiveSlug] = useState(null);
  const [done, setDone] = useState([]);     // [{slug, correct, weak, level}]
  const [view, setView] = useState("queue"); // queue | quiz | summary

  useEffect(() => {
    if (!user || !examId || !planId) return;
    const u = listenRevisionItems(user.uid, examId, planId, setItems);
    return () => typeof u === "function" && u();
  }, [user, examId, planId]);

  const today = todayISO();
  const queue = useMemo(
    () => filterDueOn(items, session?.id, today),
    [items, session?.id, today]
  );

  // Active item picked from items (so we always read latest level after recording).
  const activeItem = useMemo(() => {
    if (!activeSlug) return null;
    const it = items[activeSlug];
    return it ? { slug: activeSlug, ...it } : null;
  }, [items, activeSlug]);

  function startQuiz(slug) {
    setActiveSlug(slug);
    setView("quiz");
  }

  function handleQuizDone(result) {
    setDone(prev => [...prev, { slug: activeSlug, ...result }]);
    setActiveSlug(null);
    // Auto-pick the next undone item in the queue, else show summary.
    const remaining = queue.filter(q =>
      q.slug !== activeSlug && !done.find(d => d.slug === q.slug)
    );
    if (remaining.length > 0) {
      setView("queue");
    } else {
      setView("summary");
    }
  }

  function handleSkip() {
    setActiveSlug(null);
    setView("queue");
  }

  // Summary stats.
  const summary = useMemo(() => {
    const saved = done.filter(d => d.correct).length;
    const weakened = done.filter(d => d.weak).length;
    const totalLevels = done.reduce((acc, d) => acc + (d.level || 0), 0);
    const avgLevel = done.length ? (totalLevels / done.length).toFixed(1) : "0";
    return { saved, weakened, total: done.length, avgLevel };
  }, [done]);

  const motivation = useMemo(() => {
    if (summary.total === 0) return "";
    if (summary.weakened === 0 && summary.saved > 0) {
      return `🔥 You saved ${summary.saved} memor${summary.saved === 1 ? "y" : "ies"} today.`;
    }
    if (summary.saved > summary.weakened) {
      return `✨ Strong session — ${summary.saved} locked in, ${summary.weakened} flagged for retry.`;
    }
    return `💪 Tough one — ${summary.weakened} marked weak. They'll come back sooner.`;
  }, [summary]);

  return (
    <div className="stp-scrim" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="stp-modal stp-rev-modal">
        <div className="stp-modal-head">
          <div>
            <h3>Revise <em>{session?.name || "session"}</em></h3>
            <div className="sub">
              {view === "summary"
                ? "Session summary"
                : `${queue.length} topic${queue.length === 1 ? "" : "s"} due today`}
            </div>
          </div>
          <button className="stp-act" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="stp-modal-body">
          {view === "queue" && (
            queue.length === 0 ? (
              <div className="stp-rev-empty">
                <div className="stp-rev-empty-emoji">🎯</div>
                <div className="stp-rev-empty-title">Nothing due today</div>
                <div className="stp-rev-empty-desc">
                  Mark subtopics complete in the topic hierarchy to schedule them for revision.
                </div>
              </div>
            ) : (
              <div className="stp-rev-queue">
                {queue.map(it => {
                  const cls = classifyItem(it, today);
                  const isDone = done.find(d => d.slug === it.slug);
                  const fmt = LEVEL_FORMATS[Math.max(0, Math.min(5, it.level || 0))];
                  return (
                    <div key={it.slug} className={`stp-rev-row ${cls}${isDone ? " done" : ""}`}>
                      <div className="stp-rev-risk" data-cls={cls} />
                      <div className="stp-rev-row-body">
                        <div className="stp-rev-row-name">{it.subtopic_name}</div>
                        <div className="stp-rev-row-meta">
                          <span className="stp-rev-row-topic">{it.topic}</span>
                          <span className="stp-rev-row-level">L{(it.level || 0) + 1} · {fmt.name}</span>
                        </div>
                        <div className="stp-rev-row-hint">{memoryHint(it)}</div>
                      </div>
                      {isDone ? (
                        <span className={`stp-rev-row-tag ${isDone.correct ? "ok" : "bad"}`}>
                          {isDone.correct ? "✓ Saved" : "Weak"}
                        </span>
                      ) : (
                        <button className="stp-btn small primary" onClick={() => startQuiz(it.slug)}>
                          Revise
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {view === "quiz" && activeItem && (
            <RevisionQuiz
              user={user}
              examId={examId}
              planId={planId}
              examName={examName}
              item={activeItem}
              onDone={handleQuizDone}
              onSkip={handleSkip}
              showToast={showToast}
            />
          )}

          {view === "summary" && (
            <div className="stp-rev-summary">
              <div className="stp-rev-summary-emoji">
                {summary.saved >= summary.total ? "🎉" : summary.saved > 0 ? "💪" : "📚"}
              </div>
              <div className="stp-rev-summary-title">
                {summary.saved} of {summary.total} locked in
              </div>
              <div className="stp-rev-summary-msg">{motivation}</div>
              <div className="stp-rev-summary-stats">
                <div className="ok">
                  <div className="v">{summary.saved}</div>
                  <div className="l">Saved</div>
                </div>
                <div className="warn">
                  <div className="v">{summary.weakened}</div>
                  <div className="l">Weakened</div>
                </div>
                <div>
                  <div className="v">{summary.avgLevel}</div>
                  <div className="l">Avg level</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="stp-modal-foot">
          <span style={{ fontSize: 12, color: "var(--ink2)" }}>
            {view === "summary"
              ? "Next revisions are scheduled automatically."
              : "Wrong answers reschedule the topic sooner."}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="stp-btn" onClick={onClose}>
              {view === "summary" ? "Done" : "Close"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
