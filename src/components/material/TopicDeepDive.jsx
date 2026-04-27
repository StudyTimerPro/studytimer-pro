import React, { useEffect, useState } from "react";
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
  const [active, setActive] = useState("objectives");
  const [cache, setCache] = useState({});      // server-cached capsules
  const [busy, setBusy] = useState({});        // { capsuleId: bool }

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

  async function loadCapsule(capsuleId) {
    setBusy(b => ({ ...b, [capsuleId]: true }));
    try {
      const prompt = buildCapsulePrompt({
        capsuleId,
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
          { role: "system", content: "Exam-focused study assistant. Plain prose with light bullets. Do not use # headings, ** bold markers, or --- separators." },
          { role: "user", content: prompt },
        ],
        "gpt-4o-mini", 0.5
      );
      await saveCapsule(user.uid, examId, planId, session.id, slug, capsuleId, text || "");
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
        <div className="stp-mat-output">
          {isBusy && !activeContent ? (
            <div className="stp-mat-empty">Working on it…</div>
          ) : (
            <MaterialContent text={activeContent} empty="Select a tab to load content." />
          )}
        </div>
      </div>
    </>
  );
}
