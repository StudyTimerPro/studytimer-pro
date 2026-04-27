import React, { useEffect, useRef, useState } from "react";
import { callAI } from "../../utils/aiService";
import { CAPSULES, buildCapsulePrompt, topicSlug } from "../../utils/materialPrompts";
import { saveCapsule, listenCapsules } from "../../firebase/db";
import MaterialContent from "./MaterialContent";

function durationMinsOf(s) {
  if (!s) return 60;
  if (Number(s.durationMins) > 0) return Number(s.durationMins);
  if (s.start && s.end) {
    const [sh, sm] = s.start.split(":").map(Number);
    const [eh, em] = s.end.split(":").map(Number);
    return Math.max((eh * 60 + em) - (sh * 60 + sm), 0);
  }
  return 60;
}

export default function TopicDeepDive({
  user, examId, planId, session, examName, topic, onBack, showToast,
}) {
  const slug = topicSlug(topic.subtopic_name || topic.topic || "topic");
  const [active, setActive] = useState("important_notes");
  const [cache, setCache] = useState({});      // server-cached capsules
  const [busy, setBusy] = useState({});        // { capsuleId: bool }
  const [showLoadMore, setShowLoadMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const contentRef = useRef(null);

  // Subscribe to cached capsule content
  useEffect(() => {
    if (!user || !examId || !planId || !session?.id || !slug) return;
    const u = listenCapsules(user.uid, examId, planId, session.id, slug, setCache);
    return () => typeof u === "function" && u();
  }, [user, examId, planId, session?.id, slug]);

  // Auto-load the active capsule if not cached
  useEffect(() => {
    if (!active) return;
    if (cache[active]?.content) return;
    if (busy[active]) return;
    loadCapsule(active);
    // eslint-disable-next-line
  }, [active, cache]);

  // Scroll-bottom detection for "Load more" on important_notes
  useEffect(() => {
    setShowLoadMore(false);
    if (active !== "important_notes") return;
    const el = contentRef.current;
    if (!el) return;
    function onScroll() {
      const fromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
      setShowLoadMore(fromBottom <= 24);
    }
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, [active, cache]);

  async function loadCapsule(capsuleId, opts = {}) {
    setBusy(b => ({ ...b, [capsuleId]: true }));
    try {
      // For "load more" we generate with the *_more variant prompt and append.
      const promptId = opts.more ? `${capsuleId}_more` : capsuleId;
      const prompt = buildCapsulePrompt({
        capsuleId: promptId,
        topicName: topic.subtopic_name || topic.topic,
        sessionName: session?.name || "",
        examName: examName || "",
        contentBrief: topic.content_brief || topic.focus || "",
        currentDay: topic.day_number || 1,
        daysUntilExam: null,
        durationMinutes: durationMinsOf(session),
      });
      const text = await callAI(
        [
          { role: "system", content: "Exam-focused study assistant. Plain prose with light bullets. Do not use # headings or --- separators. You MAY use **bold** to highlight key terms and facts." },
          { role: "user", content: prompt },
        ],
        "gpt-4o-mini", 0.5
      );
      const existing = cache[capsuleId]?.content || "";
      const merged = opts.more && existing
        ? `${existing}\n\n--more--\n\n${text || ""}`
        : (text || "");
      await saveCapsule(user.uid, examId, planId, session.id, slug, capsuleId, merged);
    } catch (err) {
      showToast?.("Capsule failed: " + (err.message || err));
    } finally {
      setBusy(b => ({ ...b, [capsuleId]: false }));
    }
  }

  async function regenerate() {
    if (!confirm("Regenerate this capsule?")) return;
    await loadCapsule(active);
  }

  async function handleLoadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      await loadCapsule("important_notes", { more: true });
    } finally {
      setLoadingMore(false);
    }
  }

  const activeContent = cache[active]?.content || "";
  const isBusy = !!busy[active];

  return (
    <>
      <div className="stp-mat-section">
        <div className="stp-mat-detail-head">
          <button className="stp-btn small ghost" onClick={onBack}>← Back to topics</button>
          <div className="stp-mat-detail-meta">
            <div className="stp-mat-detail-name">{topic.subtopic_name || topic.topic}</div>
            <div className="stp-mat-detail-sub">
              {topic.topic && topic.topic !== topic.subtopic_name ? `${topic.topic} · ` : ""}
              Day {topic.day_number || 1}
              {topic.importance ? ` · ${topic.importance} priority` : ""}
            </div>
          </div>
        </div>

        <div className="stp-capsule-tabs">
          {CAPSULES.map(c => {
            const cached = !!cache[c.id]?.content;
            const loading = !!busy[c.id];
            return (
              <button
                key={c.id}
                className={`stp-capsule-tab${active === c.id ? " on" : ""}${cached ? " has" : ""}`}
                onClick={() => setActive(c.id)}
                title={c.title}
              >
                <span className="ic" aria-hidden>{c.emoji}</span>
                <span className="lb">{c.title}</span>
                {loading && <span className="spinner" />}
                {!loading && cached && <span className="dot" aria-hidden>•</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="stp-mat-section">
        <div className="stp-mat-section-title">
          {CAPSULES.find(c => c.id === active)?.title || "Deep dive"}
          {isBusy && <span style={{ marginLeft: 10, fontSize: 12, color: "var(--ink2)" }}>generating…</span>}
          {!isBusy && activeContent && (
            <button className="stp-btn small ghost" style={{ marginLeft: "auto" }} onClick={regenerate}>
              ↻ Regenerate
            </button>
          )}
        </div>
        <div className="stp-mat-output" ref={contentRef}>
          {isBusy && !activeContent ? (
            <div className="stp-mat-empty">Working on it…</div>
          ) : (
            <MaterialContent text={activeContent} empty="Select a tab to load content." />
          )}
          {active === "important_notes" && activeContent && showLoadMore && (
            <div className="stp-loadmore-row">
              <button
                className="stp-btn small primary"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading more notes…" : "↓ Load more notes"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
