import React, { useEffect, useMemo, useState } from "react";
import { callAI } from "../../utils/aiService";
import {
  buildTopicHierarchyPrompt, safeParseJSON,
  pickActiveSubtopics, topicSlug, todayKey,
} from "../../utils/materialPrompts";
import {
  saveTopicHierarchy, listenTopicHierarchy, deleteTopicHierarchy,
  saveTopicProgress, listenAllDayProgress,
} from "../../firebase/db";
import TopicDeepDive from "./TopicDeepDive";

const STATUS_META = {
  complete: { ic: "✅", label: "Complete", cls: "ok" },
  pending:  { ic: "⌛", label: "Pending",  cls: "muted" },
  skipped:  { ic: "❌", label: "Skipped",  cls: "bad" },
};

function statusOf(rec) {
  if (!rec) return "pending";
  return rec.status || "pending";
}

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

export default function TopicHierarchyView({
  user, examId, planId, session, examName, planName, showToast,
}) {
  const [hierarchy, setHierarchy] = useState(null);   // { strategy, topics, generatedAt, ... }
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");        // all | pending | complete
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [progress, setProgress] = useState({});       // { date: { slug: {status,...} } }
  const [openTopic, setOpenTopic] = useState(null);   // {topic, importance, ...} when opened

  const today = todayKey();
  const durationMins = durationMinsOf(session);

  // Listen to hierarchy
  useEffect(() => {
    if (!user || !examId || !planId || !session?.id) return;
    const u = listenTopicHierarchy(user.uid, examId, planId, session.id, setHierarchy);
    return () => typeof u === "function" && u();
  }, [user, examId, planId, session?.id]);

  // Listen to all day progress
  useEffect(() => {
    if (!user || !examId || !planId || !session?.id) return;
    const u = listenAllDayProgress(user.uid, examId, planId, session.id, setProgress);
    return () => typeof u === "function" && u();
  }, [user, examId, planId, session?.id]);

  const activeSubtopics = useMemo(() => {
    if (!hierarchy?.topics) return [];
    return pickActiveSubtopics(hierarchy.topics, durationMins);
  }, [hierarchy, durationMins]);

  // Day list = today + any past days that have progress entries
  const dayOptions = useMemo(() => {
    const days = new Set([today]);
    Object.keys(progress || {}).forEach(d => days.add(d));
    return Array.from(days).sort().reverse(); // most recent first
  }, [progress, today]);

  const dayProgress = progress[selectedDay] || {};

  const visibleSubtopics = useMemo(() => {
    if (filter === "all") return activeSubtopics;
    return activeSubtopics.filter(st => {
      const st2 = statusOf(dayProgress[topicSlug(st.subtopic_name)]);
      if (filter === "complete") return st2 === "complete";
      return st2 !== "complete";
    });
  }, [activeSubtopics, dayProgress, filter]);

  async function generateHierarchy() {
    if (!session?.name) { showToast?.("Session has no topic name"); return; }
    setBusy(true);
    try {
      const prompt = buildTopicHierarchyPrompt({
        sessionName: session.name,
        examName: examName || "",
        planName: planName || "",
        durationMinutes: durationMins,
        daysUntilExam: null,
        currentDay: 1,
      });
      const text = await callAI(
        [
          { role: "system", content: "Return ONLY valid JSON. No markdown. No commentary." },
          { role: "user", content: prompt },
        ],
        "gpt-4o-mini", 0.4
      );
      const parsed = safeParseJSON(text);
      if (!parsed || !Array.isArray(parsed.topics)) {
        showToast?.("Couldn't parse topic JSON — try again");
        return;
      }
      await saveTopicHierarchy(user.uid, examId, planId, session.id, {
        strategy: parsed.strategy || null,
        topics: parsed.topics,
        generatedAt: Date.now(),
      });
      showToast?.("Topic hierarchy generated");
    } catch (err) {
      showToast?.("Generation failed: " + (err.message || err));
    } finally { setBusy(false); }
  }

  async function regenerate() {
    if (!confirm("Regenerate topic hierarchy? Existing structure will be replaced.")) return;
    await deleteTopicHierarchy(user.uid, examId, planId, session.id);
    generateHierarchy();
  }

  async function toggleStatus(subtopic) {
    const slug = topicSlug(subtopic.subtopic_name);
    const current = statusOf(dayProgress[slug]);
    const next = current === "complete" ? "pending" : "complete";
    await saveTopicProgress(user.uid, examId, planId, session.id, selectedDay, slug, {
      status: next,
      topic: subtopic.topic,
      subtopic_name: subtopic.subtopic_name,
      day_number: subtopic.day_number || null,
    });
  }

  async function markSkipped(subtopic) {
    const slug = topicSlug(subtopic.subtopic_name);
    await saveTopicProgress(user.uid, examId, planId, session.id, selectedDay, slug, {
      status: "skipped",
      topic: subtopic.topic,
      subtopic_name: subtopic.subtopic_name,
      day_number: subtopic.day_number || null,
    });
  }

  // Detail view
  if (openTopic) {
    return (
      <TopicDeepDive
        user={user}
        examId={examId}
        planId={planId}
        session={session}
        examName={examName}
        topic={openTopic}
        onBack={() => setOpenTopic(null)}
        showToast={showToast}
      />
    );
  }

  // Empty state
  if (!hierarchy) {
    return (
      <div className="stp-mat-section">
        <div className="stp-mat-empty-card">
          <div className="stp-mat-empty-emoji">🗂</div>
          <div className="stp-mat-empty-title">No topic hierarchy yet</div>
          <div className="stp-mat-empty-desc">
            Generate a complete priority-ordered topic breakdown for{" "}
            <strong>{session?.name || "this session"}</strong>. Subtopics activate based on your
            session duration ({durationLabel(session)}).
          </div>
          <button className="stp-btn primary" onClick={generateHierarchy} disabled={busy}>
            {busy ? "Generating…" : "✨ Generate hierarchy"}
          </button>
        </div>
      </div>
    );
  }

  const counts = activeSubtopics.reduce((acc, st) => {
    const s = statusOf(dayProgress[topicSlug(st.subtopic_name)]);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <div className="stp-mat-section">
        <div className="stp-mat-bar">
          <div className="stp-mat-day-pick">
            <label>Day</label>
            <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)}>
              {dayOptions.map(d => (
                <option key={d} value={d}>{d === today ? `Today (${d})` : d}</option>
              ))}
            </select>
          </div>
          <div className="stp-mat-filter">
            {["all", "pending", "complete"].map(f => (
              <button key={f} className={`stp-pill${filter === f ? " on" : ""}`} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "pending" ? "Pending" : "Complete"}
              </button>
            ))}
          </div>
          <button className="stp-btn small" onClick={regenerate} disabled={busy}>
            {busy ? "…" : "Regenerate"}
          </button>
        </div>

        <div className="stp-mat-summary">
          <div><span className="v">{activeSubtopics.length}</span><span className="l">Active today</span></div>
          <div className="ok"><span className="v">{counts.complete || 0}</span><span className="l">Complete</span></div>
          <div className="warn"><span className="v">{(counts.pending || 0) + (activeSubtopics.length - (counts.complete || 0) - (counts.skipped || 0) - (counts.pending || 0))}</span><span className="l">Pending</span></div>
          <div className="bad"><span className="v">{counts.skipped || 0}</span><span className="l">Skipped</span></div>
        </div>
      </div>

      <div className="stp-mat-section">
        <div className="stp-mat-section-title">Topics for this session</div>
        {visibleSubtopics.length === 0 ? (
          <div className="stp-mat-empty">No subtopics match this filter.</div>
        ) : (
          <div className="stp-topic-list">
            {visibleSubtopics.map((st, i) => {
              const slug = topicSlug(st.subtopic_name);
              const s = statusOf(dayProgress[slug]);
              const meta = STATUS_META[s] || STATUS_META.pending;
              return (
                <div key={slug + i} className={`stp-topic-card ${meta.cls}`}>
                  <div className="stp-topic-head">
                    <div className="stp-topic-pri" data-pri={String(st.importance || "Medium").toLowerCase()}>
                      {st.importance || "Medium"}
                    </div>
                    <div className="stp-topic-day">Day {st.day_number || i + 1}</div>
                    <button
                      className={`stp-topic-status ${meta.cls}`}
                      onClick={() => toggleStatus(st)}
                      title="Toggle complete"
                    >
                      <span aria-hidden>{meta.ic}</span> {meta.label}
                    </button>
                  </div>
                  <div className="stp-topic-name">{st.subtopic_name}</div>
                  <div className="stp-topic-parent">{st.topic}</div>
                  {st.focus && <div className="stp-topic-focus">{st.focus}</div>}
                  <div className="stp-topic-actions">
                    <button className="stp-btn small primary" onClick={() => setOpenTopic(st)}>🔍 Deep dive</button>
                    {s !== "skipped" && (
                      <button className="stp-btn small ghost" onClick={() => markSkipped(st)}>Mark skipped</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {hierarchy?.strategy?.why_these_topics && (
        <div className="stp-mat-section">
          <div className="stp-mat-section-title">Why these topics</div>
          <p className="stp-mat-p">{hierarchy.strategy.why_these_topics}</p>
        </div>
      )}
    </>
  );
}
