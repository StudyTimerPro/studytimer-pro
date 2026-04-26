import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { listenPlanSessions, getStudyProgress } from "../firebase/db";
import useStore from "../store/useStore";

// ─── Pure helpers ─────────────────────────────────────────────────────────────
function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toHM(mins) {
  const m = Math.max(0, Math.round(mins || 0));
  const h = Math.floor(m / 60), mm = m % 60;
  if (h <= 0) return `${mm}m`;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}
function durationMinsOf(s) {
  if (Number(s.durationMins) > 0) return Number(s.durationMins);
  if (s.start && s.end) {
    const [sh, sm] = s.start.split(":").map(Number);
    const [eh, em] = s.end.split(":").map(Number);
    return Math.max((eh * 60 + em) - (sh * 60 + sm), 0);
  }
  return 0;
}
function sortFlexSessions(list) {
  // Flex sessions all share start "00:00", so fall back to createdAt then id.
  return [...list].sort((a, b) => {
    const ca = Number(a.createdAt) || 0;
    const cb = Number(b.createdAt) || 0;
    if (ca !== cb) return ca - cb;
    return (a.id || "").localeCompare(b.id || "");
  });
}

// Status: ✅ completed | ⚠️ partial | ❌ skipped | ⌛ pending
function classifySession(s, studiedSecs, anyLaterStarted, isLive) {
  const durMins = durationMinsOf(s);
  const studiedMins = studiedSecs / 60;
  if (durMins > 0 && studiedMins >= durMins) return "completed";
  if (isLive) return "active";
  if (studiedSecs > 0) {
    // started but not finished — partial only if user moved past it
    return anyLaterStarted ? "partial" : "active";
  }
  // studied == 0
  if (anyLaterStarted) return "skipped";
  return "pending";
}

const STATUS_META = {
  completed: { ic: "✅", label: "Completed", cls: "ok" },
  partial:   { ic: "⚠️", label: "Partial",   cls: "warn" },
  skipped:   { ic: "❌", label: "Skipped",   cls: "bad" },
  pending:   { ic: "⌛", label: "Pending",   cls: "muted" },
  active:    { ic: "▶️", label: "In progress", cls: "live" },
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function InsightsReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    currentExamId, currentPlanId, currentPlanName,
    sessionStudied, setSessionStudied,
    timerSeconds, activeSession, setActiveSession,
    setTimerSeconds, setTimerRunning,
  } = useStore();

  const [planSessions, setPlanSessions] = useState([]);
  const [studiedLoaded, setStudiedLoaded] = useState(false);

  // Load today's persisted study progress so insights match what the timer saved.
  useEffect(() => {
    if (!user) return;
    setStudiedLoaded(false);
    const todayKey = localDateStr(new Date());
    getStudyProgress(user.uid, todayKey)
      .then(saved => {
        if (saved && typeof saved === "object" && Object.keys(saved).length > 0) {
          const normalized = Object.fromEntries(
            Object.entries(saved).map(([id, secs]) => [id, Number(secs) || 0])
          );
          setSessionStudied(prev => {
            const next = { ...normalized };
            Object.entries(prev).forEach(([id, secs]) => {
              next[id] = Math.max(next[id] || 0, Number(secs) || 0);
            });
            return next;
          });
        }
        setStudiedLoaded(true);
      })
      .catch(() => setStudiedLoaded(true));
  }, [user]); // eslint-disable-line

  // Live subscription to plan sessions (real-time updates).
  useEffect(() => {
    if (!user || !currentExamId || !currentPlanId) {
      setPlanSessions([]);
      return;
    }
    const unsub = listenPlanSessions(
      user.uid, currentExamId, currentPlanId,
      list => setPlanSessions(sortFlexSessions(list)),
    );
    return () => typeof unsub === "function" && unsub();
  }, [user, currentExamId, currentPlanId]);

  // ── Derived data (recomputes on every store/timer tick) ──
  const rows = useMemo(() => {
    if (!studiedLoaded) return [];
    const ordered = sortFlexSessions(planSessions);
    // Pre-compute studied seconds incl. live tick, and a "any later started" flag.
    const studiedById = {};
    ordered.forEach(s => {
      const live = activeSession?.id === s.id ? Number(timerSeconds || 0) : 0;
      studiedById[s.id] = Math.max(Number(sessionStudied[s.id] || 0), 0) + live;
    });
    let laterEverStarted = false;
    const fromEnd = [];
    for (let i = ordered.length - 1; i >= 0; i--) {
      const s = ordered[i];
      const isLive = activeSession?.id === s.id;
      fromEnd.unshift({
        s, idx: i,
        studiedSecs: studiedById[s.id],
        anyLaterStarted: laterEverStarted,
        isLive,
      });
      if (studiedById[s.id] > 0) laterEverStarted = true;
    }
    return fromEnd.map(r => ({
      ...r,
      status: classifySession(r.s, r.studiedSecs, r.anyLaterStarted, r.isLive),
    }));
  }, [planSessions, sessionStudied, timerSeconds, activeSession, studiedLoaded]);

  const totalStudiedMins = rows.reduce((a, r) => a + r.studiedSecs / 60, 0);
  const completedCount = rows.filter(r => r.status === "completed").length;
  const partialCount   = rows.filter(r => r.status === "partial").length;
  const skippedCount   = rows.filter(r => r.status === "skipped").length;
  const pendingCount   = rows.filter(r => r.status === "pending").length;
  const activeCount    = rows.filter(r => r.status === "active").length;
  const efficiencyDenom = completedCount + partialCount + skippedCount;
  const efficiency = efficiencyDenom > 0
    ? Math.round((completedCount / efficiencyDenom) * 100)
    : null;

  const nextSession = rows.find(r => r.status === "pending" || r.status === "active");
  const todayStr = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  function startNext() {
    if (!nextSession) return;
    setActiveSession(nextSession.s);
    setTimerSeconds(0);
    setTimerRunning(false);
    navigate("/live");
  }

  // Guard
  if (!currentExamId || !currentPlanId) {
    return (
      <div className="stp-content">
        <section className="stp-hero">
          <div>
            <h1>Study <em>insights</em></h1>
            <div className="stp-hero-sub">{todayStr} · No active plan selected.</div>
          </div>
        </section>
        <div className="stp-groups-empty">
          <div className="ic">📋</div>
          <h3>Select a <em>plan</em> first</h3>
          <p>Pick an exam and plan to see flexible-mode insights.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stp-content">
      <section className="stp-hero">
        <div>
          <h1>Study <em>insights</em></h1>
          <div className="stp-hero-sub">
            {todayStr}
            {currentPlanName ? <> · <b>{currentPlanName}</b></> : null}
            {rows.length > 0 ? <> · <b>{rows.length}</b> session{rows.length !== 1 ? "s" : ""}</> : null}
          </div>
        </div>
        <div className="stp-stats">
          <Stat label="Studied"   value={toHM(totalStudiedMins)} />
          <Stat label="Completed" value={completedCount} />
          <Stat label="Efficiency" value={efficiency === null ? "—" : `${efficiency}%`} />
        </div>
      </section>

      {!studiedLoaded ? (
        <div className="stp-groups-empty">
          <div className="ic">⏳</div>
          <h3>Loading <em>progress</em></h3>
          <p>Reading today's study activity…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="stp-groups-empty">
          <div className="ic">🌱</div>
          <h3>No <em>sessions</em> yet</h3>
          <p>Add some flexible-mode sessions on the Plan tab to begin tracking.</p>
        </div>
      ) : (
        <>
          {/* ── Top summary card ── */}
          <div className="stp-summary-grid">
            <div className="stp-sum green">
              <div className="l">Completed</div>
              <div className="v green">{completedCount}</div>
            </div>
            <div className="stp-sum amber">
              <div className="l">Partial</div>
              <div className="v amber">{partialCount}</div>
            </div>
            <div className="stp-sum red">
              <div className="l">Skipped</div>
              <div className="v red">{skippedCount}</div>
            </div>
            <div className="stp-sum">
              <div className="l">Pending</div>
              <div className="v">{pendingCount}</div>
            </div>
          </div>

          {/* ── Key insight + Action card row ── */}
          <div className="stp-wastage-grid">
            <div className="stp-panel">
              <div className="stp-panel-head">
                <h3>Key <em>insight</em></h3>
                <span className="badge">{toHM(totalStudiedMins)} studied</span>
              </div>
              <KeyInsight
                completed={completedCount} partial={partialCount}
                skipped={skippedCount} pending={pendingCount}
                active={activeCount}
                efficiency={efficiency}
                totalStudiedMins={totalStudiedMins}
                rows={rows}
              />
            </div>

            <div className="stp-panel">
              <div className="stp-panel-head">
                <h3>What's <em>next</em></h3>
              </div>
              <ActionCard
                next={nextSession}
                onStart={startNext}
                allDone={pendingCount === 0 && activeCount === 0 && rows.length > 0}
              />
            </div>
          </div>

          {/* ── Session breakdown ── */}
          <div className="stp-panel" style={{ marginTop: 18 }}>
            <div className="stp-panel-head">
              <h3>Session <em>breakdown</em></h3>
              <span className="badge">{rows.length} total</span>
            </div>
            <div>
              {rows.map((r, i) => (
                <SessionRow key={r.s.id} row={r} order={i + 1} />
              ))}
            </div>
          </div>

          {/* ── Optional trend ── */}
          <div className="stp-panel" style={{ marginTop: 18 }}>
            <div className="stp-panel-head">
              <h3>Today's <em>trend</em></h3>
              <span className="badge">{efficiency === null ? "no data yet" : `${efficiency}% efficiency`}</span>
            </div>
            <TrendBar rows={rows} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function KeyInsight({ completed, partial, skipped, pending, active, efficiency, totalStudiedMins, rows }) {
  let msg, tone = "info";
  if (rows.length === 0) {
    msg = "Add sessions on the Plan tab to begin tracking.";
  } else if (completed === rows.length) {
    msg = "Perfect day — every session completed. Excellent focus.";
    tone = "good";
  } else if (active > 0) {
    msg = "A session is in progress — keep going.";
  } else if (efficiency !== null && efficiency >= 80) {
    msg = `Strong efficiency at ${efficiency}%. Stay consistent through the rest of the list.`;
    tone = "good";
  } else if (skipped > completed && skipped > 0) {
    msg = `${skipped} session${skipped !== 1 ? "s" : ""} skipped — try shorter sessions to lower friction.`;
    tone = "warn";
  } else if (partial > 0 && completed === 0) {
    msg = "Sessions started but none finished yet — focus on closing one out.";
    tone = "warn";
  } else if (pending === rows.length) {
    msg = "Nothing started yet — pick the next session below to begin.";
  } else {
    msg = `${completed} done, ${pending} to go. Total studied: ${toHM(totalStudiedMins)}.`;
  }

  return (
    <div className={`stp-insight stp-insight-${tone}`}>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--ink)" }}>
        {msg}
      </p>
    </div>
  );
}

function ActionCard({ next, onStart, allDone }) {
  if (allDone) {
    return (
      <div style={{ textAlign: "center", padding: "20px 12px", color: "var(--ink2)" }}>
        <div style={{ fontSize: 32 }}>🎉</div>
        <p style={{ marginTop: 6, fontSize: 13 }}>All sessions handled. Plan is complete for now.</p>
      </div>
    );
  }
  if (!next) {
    return (
      <div style={{ textAlign: "center", padding: "20px 12px", color: "var(--ink2)" }}>
        <p style={{ margin: 0, fontSize: 13 }}>No upcoming session to start.</p>
      </div>
    );
  }
  const dur = durationMinsOf(next.s);
  const studiedMins = Math.floor(next.studiedSecs / 60);
  const remaining = Math.max(dur - studiedMins, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink2)" }}>
          Up next · Session {next.idx + 1}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginTop: 4 }}>
          {next.s.name || "Untitled"}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink2)", marginTop: 2 }}>
          {next.s.subject ? <>{next.s.subject} · </> : null}
          {toHM(dur)} {studiedMins > 0 ? <>· {toHM(remaining)} left</> : null}
        </div>
      </div>
      <button className="stp-btn primary" onClick={onStart} style={{ alignSelf: "flex-start" }}>
        {studiedMins > 0 ? "Resume session" : "Start session"}
      </button>
    </div>
  );
}

function SessionRow({ row, order }) {
  const meta = STATUS_META[row.status] || STATUS_META.pending;
  const dur = durationMinsOf(row.s);
  const studiedMins = Math.floor(row.studiedSecs / 60);
  const pct = dur > 0 ? Math.min(100, Math.round((studiedMins / dur) * 100)) : 0;
  return (
    <div className={`stp-w-card stp-flex-row ${row.status}`}>
      <div>
        <div className="name">
          <span style={{ color: "var(--ink2)", marginRight: 6 }}>#{order}</span>
          {row.s.name || "Untitled"}
        </div>
        <div className="meta">
          <span><span aria-hidden>{meta.ic}</span> {meta.label}</span>
          <span>Studied <b className="studied">{toHM(studiedMins)}</b></span>
          <span>Duration <b>{toHM(dur)}</b></span>
        </div>
        <div style={{ marginTop: 8, height: 6, background: "var(--chip)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`, height: "100%",
            background: row.status === "completed" ? "#4CAF50"
              : row.status === "partial" ? "linear-gradient(90deg,#E4A62A,#E57373)"
              : row.status === "active" ? "#4E6B52"
              : row.status === "skipped" ? "#E57373"
              : "var(--ink2)",
            transition: "width .4s",
          }} />
        </div>
      </div>
      <div className="right">
        <span style={{ fontSize: 11, color: "var(--ink2)", fontFamily: "var(--mono)" }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

function TrendBar({ rows }) {
  if (rows.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "stretch", height: 36 }}>
      {rows.map(r => {
        const meta = STATUS_META[r.status] || STATUS_META.pending;
        const bg = r.status === "completed" ? "#4CAF50"
          : r.status === "partial" ? "#E4A62A"
          : r.status === "skipped" ? "#E57373"
          : r.status === "active" ? "#4E6B52"
          : "var(--chip)";
        return (
          <div
            key={r.s.id}
            title={`${r.s.name || "Untitled"} — ${meta.label}`}
            style={{
              flex: 1, background: bg, borderRadius: 4,
              minWidth: 8,
              opacity: r.status === "pending" ? 0.45 : 1,
            }}
          />
        );
      })}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stp-stat">
      <div className="l">{label}</div>
      <div className="v">{value}</div>
    </div>
  );
}
