import React, { useEffect, useState, useMemo, useRef } from "react";
import useStore from "../store/useStore";
import { useAuth } from "../hooks/useAuth";
import { useTimer, setSessionTime } from "../hooks/useTimer";
import {
  getExams, getPlans, listenPlanSessions,
  savePlanSession, updatePlanSession, deletePlanSession,
  exportPlan, importPlan,
  saveStudyProgress, getStudyProgress,
} from "../firebase/db";
import AIPlanModal from "../components/plan/AIPlanModal";
import AddExamModal from "../components/plan/AddExamModal";
import ExamPlanSelector from "../components/plan/ExamPlanSelector";
import { LoadingOverlay } from "../components/common/LoadingAnimation";

/*
 * NOTE: useIsMobile is also defined inside ExamPlanSelector.jsx.
 * When you have a shared utils file, move this there and import from one place.
 */
function useIsMobile(bp = 768) {
  const [m, setM] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < bp : false
  );
  useEffect(() => {
    const fn = () => setM(window.innerWidth < bp);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [bp]);
  return m;
}

export default function TodaysPlan() {
  const { user } = useAuth();
  const { startSession, pause, reset, timerRunning, timerSeconds, activeSession, formatTime } = useTimer();
  const {
    sessions, setSessions, showToast,
    exams, setExams, currentExamId, setCurrentExamId, setCurrentExamName,
    plans, setPlans, currentPlanId, setCurrentPlanId, setCurrentPlanName,
    sessionStudied, setSessionStudied,
  } = useStore();

  const [studiedLoaded, setStudiedLoaded] = useState(false);
  const isMobile = useIsMobile();
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editingId,    setEditingId]    = useState(null);
  const [form,         setForm]         = useState(defaultForm());
  const [showAI,       setShowAI]       = useState(false);
  const [showAddExam,  setShowAddExam]  = useState(false);
  const [loadingInit,  setLoadingInit]  = useState(true);
  const [view,         setView]         = useState("timeline"); // timeline | table
  const timelineRef = useRef(null);
  const timelineDotRefs = useRef({});
  const [timelineTrack, setTimelineTrack] = useState({
    left: 70,
    top: 8,
    height: 0,
    progress: 0,
    tip: 0,
  });

  // ── Auto-stop: when timer reaches the session's full duration ──────────────
  // Uses setSessionTime (from useTimer) to clamp to exact duration and stop.
  // NOTE: No manual setSessionStudied here — that's handled by setSessionTime.
  useEffect(() => {
    if (!timerRunning || !activeSession) return;
    const sessDurSecs = duration(activeSession.start, activeSession.end) * 60;
    if (sessDurSecs > 0 && timerSeconds >= sessDurSecs) {
      // Clamp to exact duration so progress shows 100%, then stop
      setSessionTime(activeSession.id, sessDurSecs);
      reset();
      showToast("Session complete! ✓");
    }
  }, [timerSeconds]); // eslint-disable-line

  // ── Firebase daily persistence for sessionStudied ─────────────────────────
  // Load today's saved progress when the user is known.
  const todayKey = getTodayKey();

  useEffect(() => {
    if (!user) return;
    setStudiedLoaded(false);
    getStudyProgress(user.uid, todayKey).then(saved => {
      if (saved && Object.keys(saved).length > 0) {
        const normalizedSaved = Object.fromEntries(
          Object.entries(saved).map(([sessionId, secs]) => [sessionId, Number(secs) || 0])
        );
        // Merge: persisted wins, but never regress an already-running timer
        setSessionStudied(prev => {
          const next = { ...normalizedSaved };
          Object.entries(prev).forEach(([id, secs]) => {
            next[id] = Math.max(next[id] || 0, Number(secs) || 0);
          });
          return next;
        });
      }
      setStudiedLoaded(true);
    }).catch(() => setStudiedLoaded(true));
  }, [user]); // eslint-disable-line

  // Debounced auto-save whenever sessionStudied changes
  useEffect(() => {
    if (!user || Object.keys(sessionStudied).length === 0) return;
    const t = setTimeout(() => {
      saveStudyProgress(user.uid, todayKey, sessionStudied);
    }, 2000); // 2-second debounce
    return () => clearTimeout(t);
  }, [sessionStudied, user]); // eslint-disable-line

  // On page unload (refresh / tab close), synchronously write current progress
  // — including any live timerSeconds not yet flushed — to localStorage.
  // getStudyProgress merges localStorage + Firebase on next load, so this
  // ensures a mid-run refresh never loses the current session's elapsed time.
  useEffect(() => {
    if (!user) return;
    const handleUnload = () => {
      const state = useStore.getState();
      const toSave = { ...state.sessionStudied };
      if (state.activeSession?.id && state.timerSeconds > 0) {
        toSave[state.activeSession.id] =
          (toSave[state.activeSession.id] || 0) + state.timerSeconds;
      }
      if (Object.keys(toSave).length === 0) return;
      saveStudyProgress(user.uid, todayKey, toSave);
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [user]); // eslint-disable-line

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalMins = useMemo(
    () => sessions.reduce((acc, s) => acc + duration(s.start, s.end), 0),
    [sessions]
  );
  const getSessionStudiedSecs = (sessionId) => {
    const savedSecs = Number(sessionStudied[sessionId] || 0);
    const liveSecs = activeSession?.id === sessionId ? timerSeconds : 0;
    return savedSecs + liveSecs;
  };
  const totalStudiedSecs = useMemo(
    () => sessions.reduce((sum, session) => sum + getSessionStudiedSecs(session.id), 0),
    [sessions, sessionStudied, activeSession?.id, timerSeconds]
  );
  const derivedCompletedMins = Math.round(totalStudiedSecs / 60);
  const derivedFocusScore    = totalMins > 0
    ? Math.min(100, Math.round((derivedCompletedMins / totalMins) * 100))
    : null;

  // nowMin updates every minute so "Next up in Xm" stays accurate after long idle
  const [nowMin, setNowMin] = useState(
    () => new Date().getHours() * 60 + new Date().getMinutes()
  );
  useEffect(() => {
    const tick = () => setNowMin(new Date().getHours() * 60 + new Date().getMinutes());
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const getTimelineSessionState = (session) => {
    const sessDurSecs = duration(session.start, session.end) * 60;
    const studied = getSessionStudiedSecs(session.id);
    const pct = sessDurSecs > 0 ? Math.min(studied / sessDurSecs, 1) : 0;
    const pctPct = Math.round(pct * 100);

    const isLive = timerRunning && activeSession?.id === session.id;
    const isFull = !isLive && sessDurSecs > 0 && studied >= sessDurSecs;
    const isPartial = !isLive && studied > 0 && !isFull;
    const isMissed = studiedLoaded && !isLive && studied <= 0 && toMin(session.end) <= nowMin;
    const isWindow = !isLive && pct === 0
      && toMin(session.start) <= nowMin && nowMin < toMin(session.end);

    let cardExtra = "";
    if (isLive) cardExtra = " live";
    else if (isFull) cardExtra = " completed";
    else if (isPartial) cardExtra = " partial";
    else if (isMissed) cardExtra = " missed";
    else if (isWindow) cardExtra = " window";

    const dotState = isLive
      ? "live"
      : isFull
        ? "completed"
        : isPartial
          ? "partial"
          : isMissed
            ? "missed"
            : isWindow
              ? "window"
              : "idle";

    return {
      studied,
      pct,
      pctPct,
      isLive,
      isFull,
      isPartial,
      isMissed,
      isWindow,
      rowCls: `stp-tl-row${isLive ? " live" : ""}${(isFull || isPartial) ? " done" : ""}`,
      cardCls: `stp-card${cardExtra}`,
      dotState,
      dotIcon: isFull ? "✓" : isMissed ? "!" : "",
      statusName: isFull ? "Complete" : isPartial ? "Partial" : "Missed",
      settledStatusLabel: isFull
        ? `${pctPct}% Completed`
        : isPartial
          ? `${pctPct}% Partial`
          : `${pctPct}% Missed`,
    };
  };

  const timelineTrackStyle = useMemo(
    () => ({
      "--stp-track-left": `${timelineTrack.left}px`,
      "--stp-track-top": `${timelineTrack.top}px`,
      "--stp-track-height": `${timelineTrack.height}px`,
      "--stp-track-progress": `${timelineTrack.progress}px`,
      "--stp-track-tip": `${timelineTrack.tip}px`,
    }),
    [timelineTrack]
  );

  useEffect(() => {
    if (view !== "timeline" || sessions.length === 0) {
      setTimelineTrack((prev) => (
        prev.height === 0 && prev.progress === 0 && prev.tip === 0
          ? prev
          : { left: 70, top: 8, height: 0, progress: 0, tip: 0 }
      ));
      return undefined;
    }

    let frameId = 0;
    const measure = () => {
      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const timelineNode = timelineRef.current;
        if (!timelineNode) return;

        const timelineRect = timelineNode.getBoundingClientRect();

        const dotMetrics = sessions.map((session) => {
          const node = timelineDotRefs.current[session.id];
          if (!node) return null;
          const rect = node.getBoundingClientRect();
          return {
            centerY: (rect.top - timelineRect.top) + (rect.height / 2),
            centerX: (rect.left - timelineRect.left) + (rect.width / 2),
          };
        });

        if (dotMetrics.some((metric) => metric == null)) return;

        const dotCenters = dotMetrics.map((metric) => metric.centerY);
        const trackLeft = dotMetrics[0]?.centerX ?? 70;
        const trackPadding = 0;
        const trackTop = dotCenters[0];
        const trackBottom = Math.min(dotCenters[dotCenters.length - 1], timelineNode.offsetHeight - 8);
        const trackHeight = Math.max(trackBottom - trackTop, 0);
        if (trackHeight <= 0) return;

        // ── Real-time position indicator ─────────────────────────────────────
        // The green tip shows WHERE ON THE TIMELINE the current clock time is,
        // not how much has been studied.
        let progressPoint = trackTop;
        const timelineStartMin = (([h,m]) => h*60+m)(sessions[0].start.split(":").map(Number));
        const timelineEndMin   = (([h,m]) => h*60+m)(sessions[sessions.length-1].end.split(":").map(Number));

        if (nowMin <= timelineStartMin) {
          progressPoint = trackTop;                           // before all sessions
        } else if (nowMin >= timelineEndMin) {
          progressPoint = dotCenters[sessions.length - 1];   // after all sessions
        } else {
          for (let index = 0; index < sessions.length; index += 1) {
            const sessEndMin  = (([h,m]) => h*60+m)(sessions[index].end.split(":").map(Number));
            if (nowMin <= sessEndMin) {
              // Current time is within or before this session ends → sit at its dot
              progressPoint = dotCenters[index];
              break;
            }
            if (index + 1 < sessions.length) {
              const nextStartMin = (([h,m]) => h*60+m)(sessions[index+1].start.split(":").map(Number));
              if (nowMin < nextStartMin) {
                // Current time is in the break between session[index] and session[index+1]
                const breakLen = Math.max(nextStartMin - sessEndMin, 1);
                const elapsed  = nowMin - sessEndMin;
                const frac     = Math.min(elapsed / breakLen, 1);
                progressPoint  = dotCenters[index] + frac * (dotCenters[index + 1] - dotCenters[index]);
                break;
              }
            }
          }
        }

        const clampedPoint = Math.min(Math.max(progressPoint, trackTop), trackBottom);
        const nextTrack = {
          left: trackLeft,
          top: trackTop,
          height: trackHeight,
          progress: Math.max(clampedPoint - trackTop, 0),
          tip: Math.max(clampedPoint - trackTop, 0),
        };

        setTimelineTrack((prev) => (
          prev.left === nextTrack.left
            && prev.top === nextTrack.top
            && prev.height === nextTrack.height
            && prev.progress === nextTrack.progress
            && prev.tip === nextTrack.tip
            ? prev
            : nextTrack
        ));
      });
    };

    measure();

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => measure())
      : null;

    if (resizeObserver) {
      if (timelineRef.current) resizeObserver.observe(timelineRef.current);
      sessions.forEach((session) => {
        const node = timelineDotRefs.current[session.id];
        if (node) resizeObserver.observe(node);
      });
    }

    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", measure);
      resizeObserver?.disconnect();
    };
  }, [view, sessions, timerSeconds, timerRunning, activeSession?.id, sessionStudied, nowMin]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoadingInit(true);
      const e = await getExams(user.uid);
      setExams(e);
      if (e.length && !currentExamId) { setCurrentExamId(e[0].id); setCurrentExamName(e[0].name); }
      setLoadingInit(false);
    })();
  }, [user]);

  useEffect(() => {
    if (!user || !currentExamId) { setPlans([]); setCurrentPlanId(null); setCurrentPlanName(""); return; }
    (async () => {
      const p = await getPlans(user.uid, currentExamId);
      setPlans(p);
      if (p.length && (!currentPlanId || !p.find(pp => pp.id === currentPlanId))) {
        setCurrentPlanId(p[0].id); setCurrentPlanName(p[0].name);
      } else if (!p.length) {
        setCurrentPlanId(null); setCurrentPlanName("");
      }
    })();
  }, [user, currentExamId]);

  useEffect(() => {
    if (!user || !currentExamId || !currentPlanId) { setSessions([]); return; }
    const unsub = listenPlanSessions(user.uid, currentExamId, currentPlanId, setSessions);
    return () => unsub();
  }, [user, currentExamId, currentPlanId]);

  function defaultForm() {
    return { name:"", subject:"", priority:"medium", material:"", start:"06:00", end:"06:30", breakMins:10 };
  }
  function openAdd() { setForm(defaultForm()); setEditingId(null); setModalOpen(true); }
  function openEdit(s) {
    setForm({ name:s.name, subject:s.subject||"", priority:s.priority, material:s.material||"", start:s.start, end:s.end, breakMins:s.breakMins||0 });
    setEditingId(s.id); setModalOpen(true);
  }

  async function handleSave() {
    if (!user)                   { showToast("Please sign in first"); return; }
    if (!currentExamId)          { showToast("Add an exam first"); return; }
    if (!currentPlanId)          { showToast("Create or select a plan first"); return; }
    if (!form.name.trim())       { showToast("Session name required"); return; }
    if (form.start >= form.end)  { showToast("End time must be after start"); return; }
    const data = { ...form, createdAt: Date.now() };
    if (editingId) { await updatePlanSession(user.uid, currentExamId, currentPlanId, editingId, data); showToast("Session updated ✓"); }
    else           { await savePlanSession(user.uid, currentExamId, currentPlanId, data);              showToast("Session added ✓"); }
    setModalOpen(false);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this session?")) return;
    await deletePlanSession(user.uid, currentExamId, currentPlanId, id); showToast("Deleted");
  }

  async function handleExportCurrent() {
    if (!currentPlanId) { showToast("No plan to export"); return; }
    const data = await exportPlan(user.uid, currentExamId, currentPlanId);
    if (!data) { showToast("Nothing to export"); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(data.plan?.name || "plan").replace(/[^a-z0-9-_]+/gi, "_")}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  async function handleImportPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !currentExamId) return;
    try {
      const json = JSON.parse(await file.text());
      await importPlan(user.uid, currentExamId, json);
      const fresh = await getPlans(user.uid, currentExamId);
      setPlans(fresh);
      showToast("Plan imported ✓");
    } catch (err) { showToast("Invalid file: " + (err.message || err)); }
  }

  const hasExam = exams.length > 0 && !!currentExamId;
  const hasPlan = !!currentPlanId;

  // next upcoming (by start time)
  const nextSession = sessions
    .map(s => ({ ...s, startMin: toMin(s.start) }))
    .filter(s => s.startMin >= nowMin)
    .sort((a,b) => a.startMin - b.startMin)[0];
  const nextInMin = nextSession ? nextSession.startMin - nowMin : null;

  const todayStr = new Date().toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric" });

  return (
    <div style={{ position:"relative", minHeight:"100%" }}>
      {loadingInit && <LoadingOverlay message="Loading your plans…" />}

      <ExamPlanSelector onAddExam={() => setShowAddExam(true)} onAddSession={openAdd} />

      <div className="stp-content">

        {/* HERO */}
        <section className="stp-hero">
          <div>
            <h1>Today's <em>plan</em></h1>
            <div className="stp-hero-sub">
              {todayStr} · <b>{sessions.length} session{sessions.length !== 1 ? "s" : ""}</b>
              {nextInMin !== null ? <> · Next up in <b>{fmtMin(nextInMin)}</b>.</> : ""}
            </div>
          </div>
          <div className="stp-stats">
            <Stat label="Scheduled"   value={minsToHM(totalMins)} />
            <Stat label="Completed"   value={derivedCompletedMins > 0 ? minsToHM(derivedCompletedMins) : "—"} />
            <Stat label="Focus Score" value={derivedFocusScore ?? "—"} unit={derivedFocusScore != null ? "/100" : null} />
          </div>
        </section>

        {/* TOOLBAR */}
        <div className="stp-toolbar">
          <div className="stp-toolbar-actions">
            <button className="stp-btn ai" onClick={() => setShowAI(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></svg>
              Plan with AI
            </button>
            <button className="stp-btn primary" onClick={openAdd} disabled={!hasPlan}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              Add session
            </button>
          </div>
          <div className="stp-seg">
            <button className={view === "timeline" ? "on" : ""} onClick={() => setView("timeline")}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>
              Timeline
            </button>
            <button className={view === "table" ? "on" : ""} onClick={() => setView("table")}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18"/></svg>
              Table
            </button>
          </div>
        </div>

        {/* EMPTY STATES */}
        {!hasExam && (
          <div className="stp-empty">
            <h3>Add your first exam</h3>
            <p>Start by creating an exam to organize your study plans.</p>
            <button className="stp-btn primary" onClick={() => setShowAddExam(true)}>＋ Add exam</button>
          </div>
        )}

        {hasExam && !hasPlan && (
          <div className="stp-empty">
            <h3>No plans yet for this exam</h3>
            <p>Generate one with AI, or add sessions manually.</p>
            <button className="stp-btn ai" onClick={() => setShowAI(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></svg>
              Create plan with AI
            </button>
          </div>
        )}

        {/* TIMELINE VIEW */}
        {hasPlan && view === "timeline" && (
          sessions.length === 0 ? (
            <div className="stp-empty">
              <h3>No sessions yet</h3>
              <p>Add your first study session for this plan.</p>
              <button className="stp-btn primary" onClick={openAdd}>＋ Add session</button>
            </div>
          ) : (
            <div ref={timelineRef} className="stp-timeline" style={timelineTrackStyle}>
              <div className="stp-timeline-track" aria-hidden="true">
                <span className="stp-timeline-track-base" />
                <span className="stp-timeline-track-progress" />
                <span className="stp-timeline-track-tip" />
              </div>
              {sessions.map((s, i) => {
                const sessDurSecs = duration(s.start, s.end) * 60;

                // ── FIX: include paused sessions in progress ──────────────────
                // OLD: (timerRunning && activeSession?.id === s.id ? timerSeconds : 0)
                //   → when paused, timerRunning=false so live contribution = 0 → shows "missed"
                // NEW: (activeSession?.id === s.id ? timerSeconds : 0)
                //   → paused or running, timerSeconds still holds the accumulated elapsed time
                const studied = getSessionStudiedSecs(s.id);

                const pct    = sessDurSecs > 0 ? Math.min(studied / sessDurSecs, 1) : 0;
                const pctPct = Math.round(pct * 100);

                const isLive    = timerRunning && activeSession?.id === s.id;
                const isFull    = !isLive && sessDurSecs > 0 && studied >= sessDurSecs;
                const isPartial = !isLive && studied > 0 && !isFull;
                const isMissed  = studiedLoaded && !isLive && studied <= 0 && toMin(s.end) <= nowMin;
                const isWindow  = !isLive && pct === 0
                               && toMin(s.start) <= nowMin && nowMin < toMin(s.end);

                const rowCls  = `stp-tl-row${isLive ? " live" : ""}${(isFull||isPartial) ? " done" : ""}`;
                let cardExtra = "";
                if (isLive)         cardExtra = " live";
                else if (isFull)    cardExtra = " completed";
                else if (isPartial) cardExtra = " partial";
                else if (isMissed)  cardExtra = " missed";
                else if (isWindow)  cardExtra = " window";
                const cardCls = `stp-card${cardExtra}`;
                const dotState = isLive
                  ? "live"
                  : isFull
                    ? "completed"
                    : isPartial
                      ? "partial"
                      : isMissed
                        ? "missed"
                        : isWindow
                          ? "window"
                          : "idle";
                const dotIcon = isFull ? "✓" : isMissed ? "!" : "";
                const statusName = isFull ? "Complete" : isPartial ? "Partial" : "Missed";
                const settledStatusLabel = isFull
                  ? `${pctPct}% Completed`
                  : isPartial
                    ? `${pctPct}% Partial`
                    : `${pctPct}% Missed`;

                return (
                  <React.Fragment key={s.id}>
                    <div className={rowCls}>
                      <div className="stp-tl-time">
                        {fmt12short(s.start)}<br/>
                        <span className="end">{fmt12short(s.end)}</span>
                      </div>
                      <div
                        ref={(node) => {
                          if (node) timelineDotRefs.current[s.id] = node;
                          else delete timelineDotRefs.current[s.id];
                        }}
                        className={`stp-tl-dot ${dotState}`}
                      >
                        <span className="stp-tl-dot-icon">{dotIcon}</span>
                      </div>
                      <div className={cardCls}>
                        <div style={{ minWidth:0 }}>
                          <div className="stp-top-line">
                            <span className={`stp-pri ${priClass(s.priority)}`}>
                              <span>{priLabel(s.priority)}</span>
                              <span className="stp-pri-crown">♛</span>
                            </span>
                            {(s.subject || s.material) && <>
                              <span className="stp-sep-dot" />
                              <span className="stp-subject">{[s.subject, s.material].filter(Boolean).join(" · ")}</span>
                            </>}
                            <span style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                              {isLive && (
                                <>
                                  <span className="stp-live-badge">
                                  <span className="stp-live-dot" />
                                  LIVE · {formatTime(timerSeconds)}
                                </span>
                                <span style={{ display:"flex", alignItems:"center", gap:6 }}>
                                  <span className="stp-prog-wrap live">
                                    <span className="stp-prog-fill" style={{ width: `${pctPct}%` }} />
                                  </span>
                                  <span className="stp-status-value live">{pctPct}%</span>
                                  <span className="stp-status-badge live">Live</span>
                                </span>
                                </>
                              )}
                              {!isLive && (isFull || isPartial || isMissed) && (
                                <span style={{ display:"flex", alignItems:"center", gap:6 }}>
                                  <span className={`stp-prog-wrap${isFull?" full":isPartial?" partial":" missed"}`}>
                                    <span className="stp-prog-fill" style={{ width: `${pctPct}%` }} />
                                  </span>
                                  <span className={`stp-status-value ${isFull ? "completed" : isPartial ? "partial" : "missed"}`}>{pctPct}%</span>
                                  <span className={`stp-status-badge ${isFull ? "completed" : isPartial ? "partial" : "missed"}`}>
                                    {statusName}
                                  </span>
                                </span>
                              )}
                            </span>
                          </div>
                          <div className={`stp-title${isFull ? " strikethrough" : ""}`}>{s.name}</div>
                          <div className="stp-meta">
                            <span className="stp-dur-chip">{minsToHM(duration(s.start, s.end))}</span>
                            <span>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                              {fmt12(s.start)} – {fmt12(s.end)}
                            </span>
                            {s.breakMins > 0 && <span style={{ color:"var(--ink3)" }}>· {s.breakMins}m break after</span>}
                          </div>
                        </div>
                        <div className="stp-actions">
                          {isLive ? (
                            <button className="stp-act play" title="Click to pause" style={{ background:"var(--warn)", borderColor:"var(--warn)" }} onClick={pause}>
                              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                            </button>
                          ) : (
                            <button
                              className={`stp-act play${isWindow ? " glow" : ""}`}
                              title={isWindow ? "Start now!" : "Start"}
                              onClick={() => startSession(s)}>
                              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                            </button>
                          )}
                          <button className="stp-act" title="Edit" onClick={() => openEdit(s)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button className="stp-act danger" title="Delete" onClick={() => handleDelete(s.id)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                    {s.breakMins > 0 && i < sessions.length - 1 && (
                      <div className="stp-break-note">
                        {s.breakMins} min break · {fmt12(s.end)} – {fmt12(addMins(s.end, s.breakMins))}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )
        )}

        {/* TABLE VIEW */}
        {hasPlan && view === "table" && (
          <div className="stp-table-wrap">
            <table className="stp-table">
              <thead>
                <tr>
                  <th>Session</th><th>Priority</th><th>Start</th><th>End</th>
                  <th>Duration</th><th>Break after</th><th style={{ textAlign:"right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign:"center", padding:48, color:"var(--ink2)" }}>
                    No sessions yet. Add your first study session!
                  </td></tr>
                ) : sessions.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="stp-t-title">{s.name}</div>
                      {s.subject && <div className="stp-t-sub">{s.subject}</div>}
                    </td>
                    <td><span className={`stp-pri ${priClass(s.priority)}`}>{priLabel(s.priority)}</span></td>
                    <td className="stp-t-time">{fmt12(s.start)}</td>
                    <td className="stp-t-time">{fmt12(s.end)}</td>
                    <td><span className="stp-dur-chip">{minsToHM(duration(s.start, s.end))}</span></td>
                    <td className="stp-t-time" style={{ color: s.breakMins > 0 ? "var(--ink2)" : "var(--ink3)" }}>
                      {s.breakMins > 0 ? `${fmt12(s.end)} – ${fmt12(addMins(s.end, s.breakMins))}` : "No break"}
                    </td>
                    <td>
                      <div className="stp-actions" style={{ justifyContent:"flex-end" }}>
                        <button className="stp-act play" onClick={() => startSession(s)}>
                          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                        <button className="stp-act" onClick={() => openEdit(s)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="stp-act danger" onClick={() => handleDelete(s.id)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAI && user && (
        <AIPlanModal
          user={user}
          onClose={() => setShowAI(false)}
          onCreated={(n, p) => {
            showToast(`${p ? `${p} plans, ` : ""}${n} session${n !== 1 ? "s" : ""} created`);
            setShowAI(false);
          }}
        />
      )}

      {showAddExam && (
        <AddExamModal
          onClose={() => setShowAddExam(false)}
          onCreated={async (examId, name) => {
            const fresh = await getExams(user.uid);
            setExams(fresh);
            setCurrentExamId(examId);
            setCurrentExamName(name);
            setShowAddExam(false);
          }}
        />
      )}

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div className="stp-scrim" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="stp-modal">
            <div className="stp-modal-head">
              <div>
                <h3>{editingId ? "Edit " : "New "}<em>study session</em></h3>
                <div className="sub">Block focused time on your plan. We'll queue it up.</div>
              </div>
              <button className="stp-act" onClick={() => setModalOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="stp-modal-body">
              <Field label="Session name">
                <input className="stp-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Calculus — limits" />
              </Field>
              <Field label="Subject / exam">
                <input className="stp-input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Engineering Mathematics" />
              </Field>
              <div className="stp-row-2">
                <Field label="Priority">
                  <div className="stp-pri-group">
                    {["high","medium","low"].map(p => (
                      <button
                        key={p}
                        className={`stp-pri-btn ${p === "medium" ? "med" : p} ${form.priority === p ? "on" : ""}`}
                        onClick={() => setForm({ ...form, priority: p })}>
                        <span className="d" /> {p[0].toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Material">
                  <input className="stp-input" value={form.material} onChange={e => setForm({ ...form, material: e.target.value })} placeholder="e.g. Chapter 3" />
                </Field>
                <Field label="Start">
                  <input type="time" className="stp-input" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} />
                </Field>
                <Field label="End">
                  <input type="time" className="stp-input" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} />
                </Field>
              </div>
              <Field label="Break after (minutes)">
                <input type="number" min="0" max="60" className="stp-input" value={form.breakMins}
                       onChange={e => setForm({ ...form, breakMins: parseInt(e.target.value) || 0 })} />
              </Field>
            </div>

            <div className="stp-modal-foot">
              <span style={{ fontSize:12, color:"var(--ink2)" }}>
                Tip: press <kbd style={{ fontFamily:"var(--mono)", background:"var(--chip)", padding:"2px 5px", borderRadius:4, fontSize:11 }}>⌘K</kbd> to plan faster
              </span>
              <div style={{ display:"flex", gap:8 }}>
                <button className="stp-btn" onClick={() => setModalOpen(false)}>Cancel</button>
                <button className="stp-btn primary" onClick={handleSave}>Save session</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- small helpers ---------- */
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function Stat({ label, value, unit }) {
  return (
    <div className="stp-stat">
      <div className="l">{label}</div>
      <div className="v">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div className="stp-field">
      <label>{label}</label>
      {children}
    </div>
  );
}
function priClass(p) { return p === "high" ? "high" : p === "medium" ? "med" : "low"; }
function priLabel(p) { return p === "high" ? "High" : p === "medium" ? "Medium" : "Low"; }
function duration(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}
function minsToHM(m) {
  const h = Math.floor(m / 60), min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}
function fmt12(t) {
  if (!t) return "—";
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}
function fmt12short(t) {
  if (!t) return "—";
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am"; h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")}${ap}`;
}
function addMins(t, mins) {
  let [h, m] = t.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2,"0")}:${String(total % 60).padStart(2,"0")}`;
}
function toMin(t) { const [h,m] = t.split(":").map(Number); return h*60+m; }
function fmtMin(m) { if (m < 60) return `${m}m`; const h = Math.floor(m/60), mm = m%60; return mm ? `${h}h ${mm}m` : `${h}h`; }
