import React, { useEffect, useMemo, useState } from "react";
import { callAI } from "../../utils/aiService";
import {
  buildTopicHierarchyPrompt, safeParseJSON,
  topicSlug, todayKey,
} from "../../utils/materialPrompts";
import {
  saveTopicHierarchy, listenTopicHierarchy, deleteTopicHierarchy,
  saveTopicProgress, listenAllDayProgress,
  saveDayMap, listenDayMap,
} from "../../firebase/db";
import { ensureRevisionItem, removeRevisionItem } from "../../firebase/revisionDb";
import TopicDeepDive from "./TopicDeepDive";

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

function statusOf(rec) {
  if (!rec) return "pending";
  return rec.status || "pending";
}

export default function TopicHierarchyView({
  user, examId, planId, session, examName, planName, showToast,
}) {
  const [hierarchy, setHierarchy] = useState(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [progress, setProgress] = useState({});
  const [dayMap, setDayMap] = useState({});  // { dateKey: studyDayNumber }
  const [openTopic, setOpenTopic] = useState(null);

  const today = todayKey();
  const durationMins = durationMinsOf(session);

  useEffect(() => {
    if (!user || !examId || !planId || !session?.id) return;
    const u = listenTopicHierarchy(user.uid, examId, planId, session.id, setHierarchy);
    return () => typeof u === "function" && u();
  }, [user, examId, planId, session?.id]);

  useEffect(() => {
    if (!user || !examId || !planId || !session?.id) return;
    const u = listenAllDayProgress(user.uid, examId, planId, session.id, setProgress);
    return () => typeof u === "function" && u();
  }, [user, examId, planId, session?.id]);

  useEffect(() => {
    if (!user || !examId || !planId || !session?.id) return;
    const u = listenDayMap(user.uid, examId, planId, session.id, setDayMap);
    return () => typeof u === "function" && u();
  }, [user, examId, planId, session?.id]);

  // Auto-assign a study-day number to today on first visit
  useEffect(() => {
    if (!hierarchy?.topics) return;
    if (dayMap[selectedDay]) return;
    if (selectedDay !== today) return; // only auto-assign for today
    const usedDays = Object.values(dayMap || {}).map(Number).filter(n => n > 0);
    const nextDay = (usedDays.length ? Math.max(...usedDays) : 0) + 1;
    saveDayMap(user.uid, examId, planId, session.id, selectedDay, nextDay).catch(() => {});
  }, [hierarchy, dayMap, selectedDay, today, user, examId, planId, session?.id]);

  const studyDay = dayMap[selectedDay] || 0;

  // Subtopics filtered by the study-day for the selected calendar date
  const activeSubtopics = useMemo(() => {
    if (!hierarchy?.topics || !studyDay) return [];
    const out = [];
    for (const t of hierarchy.topics) {
      const list = (t.subtopics || []).filter(st => Number(st.day_number) === Number(studyDay));
      for (const st of list) {
        out.push({
          topic: t.topic,
          importance: t.importance,
          ...st,
        });
      }
    }
    return out;
  }, [hierarchy, studyDay]);

  const dayProgress = progress[selectedDay] || {};

  const dayOptions = useMemo(() => {
    const days = new Set([today]);
    Object.keys(progress || {}).forEach(d => days.add(d));
    Object.keys(dayMap || {}).forEach(d => days.add(d));
    return Array.from(days).sort().reverse();
  }, [progress, dayMap, today]);

  const visibleSubtopics = useMemo(() => {
    if (filter === "all") return activeSubtopics;
    return activeSubtopics.filter(st => {
      const s = statusOf(dayProgress[topicSlug(st.subtopic_name)]);
      if (filter === "complete") return s === "complete";
      return s !== "complete";
    });
  }, [activeSubtopics, dayProgress, filter]);

  // ── Cross-day grouping ────────────────────────────────────────────────────
  // Every calendar date that has a study-day assigned, with its subtopics +
  // current per-day status. Used by the expandable per-day filter dropdown so
  // the All/Pending/Complete pills work across ALL days, not just today.
  const allDayGroups = useMemo(() => {
    if (!hierarchy?.topics) return [];
    const subtopicsByDayNumber = {};
    for (const t of hierarchy.topics) {
      for (const st of (t.subtopics || [])) {
        const dn = Number(st.day_number);
        if (!dn) continue;
        (subtopicsByDayNumber[dn] = subtopicsByDayNumber[dn] || []).push({
          topic: t.topic, importance: t.importance, ...st,
        });
      }
    }
    const groups = Object.entries(dayMap || {})
      .map(([dateKey, dayNum]) => {
        const dn = Number(dayNum) || 0;
        const subs = subtopicsByDayNumber[dn] || [];
        const dayProg = progress[dateKey] || {};
        const enriched = subs.map(st => ({
          ...st,
          _status: statusOf(dayProg[topicSlug(st.subtopic_name)]),
        }));
        const filtered = enriched.filter(st => {
          if (filter === "complete") return st._status === "complete";
          if (filter === "pending")  return st._status !== "complete";
          return true;
        });
        const completeCount = enriched.filter(s => s._status === "complete").length;
        const pendingCount  = enriched.length - completeCount;
        return {
          dateKey, dayNum: dn,
          subtopics: filtered,
          totalCount: enriched.length,
          completeCount,
          pendingCount,
          shownCount: filter === "complete" ? completeCount : filter === "pending" ? pendingCount : enriched.length,
        };
      })
      .filter(g => g.dayNum > 0)
      .sort((a, b) => a.dayNum - b.dayNum);
    return groups;
  }, [hierarchy, dayMap, progress, filter]);

  const allDayTotals = useMemo(() => {
    let all = 0, complete = 0, pending = 0;
    for (const g of allDayGroups) {
      all += g.totalCount;
      complete += g.completeCount;
      pending += g.pendingCount;
    }
    return { all, complete, pending };
  }, [allDayGroups]);

  const [expandedDays, setExpandedDays] = useState({});
  function toggleDay(dateKey) {
    setExpandedDays(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
  }

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

  async function toggleStatus(subtopic, dateKey = selectedDay) {
    const slug = topicSlug(subtopic.subtopic_name);
    const dayProg = progress[dateKey] || {};
    const current = statusOf(dayProg[slug]);
    const next = current === "complete" ? "pending" : "complete";
    await saveTopicProgress(user.uid, examId, planId, session.id, dateKey, slug, {
      status: next,
      topic: subtopic.topic,
      subtopic_name: subtopic.subtopic_name,
      day_number: subtopic.day_number || null,
    });
    // Mirror to the revision queue: completing schedules first revision Day+1;
    // un-marking removes the entry.
    try {
      if (next === "complete") {
        await ensureRevisionItem(user.uid, examId, planId, slug, {
          topic: subtopic.topic,
          subtopic_name: subtopic.subtopic_name,
          focus: subtopic.focus || subtopic.content_brief || "",
          importance: subtopic.importance || "Medium",
          sessionId: session.id,
          sessionName: session.name,
        });
      } else {
        await removeRevisionItem(user.uid, examId, planId, slug);
      }
    } catch { /* non-fatal */ }
  }

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

  if (!hierarchy) {
    return (
      <div className="stp-mat-section">
        <div className="stp-mat-empty-card">
          <div className="stp-mat-empty-emoji">🗂</div>
          <div className="stp-mat-empty-title">No topic hierarchy yet</div>
          <div className="stp-mat-empty-desc">
            Generate a complete priority-ordered topic breakdown for{" "}
            <strong>{session?.name || "this session"}</strong>. Each calendar date will reveal its
            own day's subtopics.
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
      {/* ── Cross-day filter (works across ALL days) ─────────────────────── */}
      <div className="stp-mat-section">
        <div className="lp-hier-cross">
          <div className="lp-hier-cross-head">
            <div className="lp-hier-cross-title">All days · Filter</div>
            <div className="stp-mat-filter">
              {["all", "pending", "complete"].map(f => {
                const n = f === "all" ? allDayTotals.all : f === "pending" ? allDayTotals.pending : allDayTotals.complete;
                return (
                  <button key={f} className={`stp-pill${filter === f ? " on" : ""}`} onClick={() => setFilter(f)}>
                    {f === "all" ? "All" : f === "pending" ? "Pending" : "Complete"} · {n}
                  </button>
                );
              })}
            </div>
          </div>

          {allDayGroups.length === 0 ? (
            <div className="stp-mat-empty">Open dates over time to assign study days, then they'll appear here.</div>
          ) : (
            <div className="lp-hier-day-list">
              {allDayGroups.map(g => {
                const open = !!expandedDays[g.dateKey];
                const isToday = g.dateKey === today;
                return (
                  <div key={g.dateKey} className={`lp-hier-day${open ? " open" : ""}`}>
                    <button className="lp-hier-day-row" onClick={() => toggleDay(g.dateKey)}>
                      <span className="lp-hier-day-caret" aria-hidden>{open ? "▾" : "▸"}</span>
                      <span className="lp-hier-day-name">
                        Day {g.dayNum}
                        <span className="lp-hier-day-date">
                          {isToday ? "Today" : g.dateKey}
                        </span>
                      </span>
                      <span className="lp-hier-day-counts">
                        <span className="lp-hier-cnt ok" title="Complete">{g.completeCount}</span>
                        <span className="lp-hier-cnt pend" title="Pending">{g.pendingCount}</span>
                        <span className="lp-hier-cnt total" title="Total">{g.totalCount}</span>
                      </span>
                    </button>
                    {open && (
                      <div className="lp-hier-day-body">
                        {g.subtopics.length === 0 ? (
                          <div className="lp-hier-day-empty">
                            {filter === "complete" ? "Nothing complete yet." :
                             filter === "pending"  ? "All clear — nothing pending." :
                             "No subtopics for this day."}
                          </div>
                        ) : (
                          g.subtopics.map((st, i) => {
                            const isComplete = st._status === "complete";
                            return (
                              <div key={topicSlug(st.subtopic_name) + i} className={`lp-hier-sub ${isComplete ? "ok" : "muted"}`}>
                                <div className="lp-hier-sub-head">
                                  <span className="stp-topic-pri" data-pri={String(st.importance || "Medium").toLowerCase()}>
                                    {st.importance || "Medium"}
                                  </span>
                                  <span className="lp-hier-sub-name">{st.subtopic_name}</span>
                                </div>
                                <div className="lp-hier-sub-parent">{st.topic}</div>
                                <div className="lp-hier-sub-actions">
                                  <button
                                    className={`stp-toggle-btn${isComplete ? " on" : ""}`}
                                    onClick={() => toggleStatus(st, g.dateKey)}
                                    role="switch"
                                    aria-checked={isComplete}
                                    title={isComplete ? "Mark pending" : "Mark complete"}
                                  >
                                    <span className="track"><span className="thumb" /></span>
                                    <span className="lbl">{isComplete ? "Complete" : "Pending"}</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="stp-mat-section">
        <div className="stp-mat-bar">
          <div className="stp-mat-day-pick">
            <label>Day</label>
            <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)}>
              {dayOptions.map(d => {
                const studyDay = dayMap[d];
                const label = (d === today ? `Today` : d) + (studyDay ? ` · Day ${studyDay}` : "");
                return <option key={d} value={d}>{label} ({d})</option>;
              })}
            </select>
          </div>
          <button className="stp-btn small" onClick={regenerate} disabled={busy}>
            {busy ? "…" : "Regenerate"}
          </button>
        </div>

        {studyDay > 0 && (
          <div className="stp-mat-summary">
            <div><span className="v">{activeSubtopics.length}</span><span className="l">Day {studyDay} topics</span></div>
            <div className="ok"><span className="v">{counts.complete || 0}</span><span className="l">Complete</span></div>
            <div className="warn"><span className="v">{(counts.pending || 0) + (activeSubtopics.length - (counts.complete || 0) - (counts.pending || 0))}</span><span className="l">Pending</span></div>
            <div><span className="v">{durationLabel(session)}</span><span className="l">Duration</span></div>
          </div>
        )}
      </div>

      <div className="stp-mat-section">
        <div className="stp-mat-section-title">
          {studyDay > 0 ? `Day ${studyDay} subtopics` : "Subtopics"}
        </div>
        {studyDay === 0 ? (
          <div className="stp-mat-empty">Open this date for the first time to assign a study day.</div>
        ) : visibleSubtopics.length === 0 ? (
          <div className="stp-mat-empty">
            {activeSubtopics.length === 0
              ? `No subtopics generated for Day ${studyDay}. Try regenerating with more days of coverage.`
              : "No subtopics match this filter."}
          </div>
        ) : (
          <div className="stp-topic-list">
            {visibleSubtopics.map((st, i) => {
              const slug = topicSlug(st.subtopic_name);
              const s = statusOf(dayProgress[slug]);
              const isComplete = s === "complete";
              return (
                <div key={slug + i} className={`stp-topic-card ${isComplete ? "ok" : "muted"}`}>
                  <div className="stp-topic-head">
                    <div className="stp-topic-pri" data-pri={String(st.importance || "Medium").toLowerCase()}>
                      {st.importance || "Medium"}
                    </div>
                    <div className="stp-topic-day">Day {st.day_number || studyDay}</div>
                  </div>
                  <div className="stp-topic-name">{st.subtopic_name}</div>
                  <div className="stp-topic-parent">{st.topic}</div>
                  {st.focus && <div className="stp-topic-focus">{st.focus}</div>}
                  <div className="stp-topic-actions">
                    <button className="stp-btn small primary" onClick={() => setOpenTopic(st)}>🔍 Deep dive</button>
                    <button
                      className={`stp-toggle-btn${isComplete ? " on" : ""}`}
                      onClick={() => toggleStatus(st)}
                      role="switch"
                      aria-checked={isComplete}
                      title={isComplete ? "Mark pending" : "Mark complete"}
                    >
                      <span className="track"><span className="thumb" /></span>
                      <span className="lbl">{isComplete ? "Complete" : "Pending"}</span>
                    </button>
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
