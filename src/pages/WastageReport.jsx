import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  saveWastage, getWastageDate, getStudyProgress,
  deletePlanSession, listenPlanSessions,
} from "../firebase/db";
import WastageHistory from "../components/WastageHistory";
import useStore from "../store/useStore";

// ─── Pure helpers ─────────────────────────────────────────────────────────────
function dur(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max((eh * 60 + em) - (sh * 60 + sm), 0);
}
function toMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function toHHMMSS(mins) {
  const m = mins || 0;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}
function toHM(mins) {
  const m = Math.max(0, Math.round(mins || 0));
  const h = Math.floor(m / 60), mm = m % 60;
  if (h <= 0) return `${mm}m`;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}
function fmt12(t) {
  if (!t) return "—";
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}
function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Display: which sessions have wastage right now ───────────────────────────
function calcWastage(sessions, studiedSecsMap, nowMin) {
  const result = [];
  for (const s of sessions) {
    if (!s.start || !s.end) continue;
    if (toMin(s.end) > nowMin) continue;
    const durMins     = dur(s.start, s.end);
    const studiedSecs = Math.max(Number(studiedSecsMap[s.id] || 0), 0);
    const studiedMins = Math.floor(studiedSecs / 60);
    const wastageMins = Math.max(durMins - studiedMins, 0);
    if (wastageMins === 0) continue;
    result.push({ ...s, durMins, studiedMins, wastageMins, missed: studiedSecs === 0 });
  }
  return result;
}

function buildSnapshot(planSessions, studiedSecsMap, activeSession, timerSeconds, nowMin) {
  const snapshot = {};
  for (const s of planSessions) {
    if (!s.start || !s.end) continue;
    if (toMin(s.end) > nowMin) continue;
    const durMins     = dur(s.start, s.end);
    const liveSecs    = activeSession?.id === s.id ? Number(timerSeconds || 0) : 0;
    const totalSecs   = Math.max(Number(studiedSecsMap[s.id] || 0), 0) + liveSecs;
    const studiedMins = Math.floor(totalSecs / 60);
    const wastageMins = Math.max(durMins - studiedMins, 0);
    snapshot[s.id] = {
      sessionName : s.name,
      subject     : s.subject || s.name,
      duration    : wastageMins,
      missed      : totalSecs === 0,
    };
  }
  return snapshot;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function WastageReport() {
  const { user } = useAuth();
  const {
    setExportSessions,
    currentExamId, currentPlanId,
    sessionStudied, setSessionStudied,
    timerSeconds, activeSession,
  } = useStore();

  const [planSessions,  setPlanSessions]  = useState([]);
  const [selectedId,    setSelectedId]    = useState(null);
  const [studiedLoaded, setStudiedLoaded] = useState(false);
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date(); return n.getHours() * 60 + n.getMinutes();
  });

  const yesterdayDone = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date(); setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Load study progress
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

  useEffect(() => {
    if (!user || !currentExamId || !currentPlanId) {
      setPlanSessions([]);
      return;
    }
    yesterdayDone.current = false;

    const unsub = listenPlanSessions(
      user.uid, currentExamId, currentPlanId,
      (list) => { setPlanSessions(list); setExportSessions(list); }
    );
    return () => typeof unsub === "function" && unsub();
  }, [user, currentExamId, currentPlanId]); // eslint-disable-line

  useEffect(() => {
    if (!user || !currentExamId || !currentPlanId) return;
    if (!studiedLoaded || planSessions.length === 0) return;

    const todayDate = localDateStr(new Date());
    const snapshot  = buildSnapshot(planSessions, sessionStudied, activeSession, timerSeconds, nowMin);
    if (Object.keys(snapshot).length === 0) return;

    saveWastage(user.uid, todayDate, snapshot)
      .catch(err => console.error("[WastageReport] save (sessions) failed:", err));

    if (!yesterdayDone.current) {
      yesterdayDone.current = true;
      const yesterday = localDateStr(new Date(Date.now() - 86_400_000));
      getWastageDate(user.uid, yesterday).then(existing => {
        if (!existing) {
          const ySnap = {};
          planSessions.forEach(s => {
            ySnap[s.id] = { sessionName: s.name, subject: s.subject || s.name, duration: dur(s.start, s.end), missed: true };
          });
          saveWastage(user.uid, yesterday, ySnap);
        }
      });
    }
  }, [planSessions, studiedLoaded]); // eslint-disable-line

  useEffect(() => {
    if (!user || !currentExamId || !currentPlanId) return;
    if (!studiedLoaded || planSessions.length === 0) return;

    const tid = setTimeout(() => {
      const todayDate = localDateStr(new Date());
      const snapshot  = buildSnapshot(planSessions, sessionStudied, activeSession, timerSeconds, nowMin);
      if (Object.keys(snapshot).length === 0) return;
      saveWastage(user.uid, todayDate, snapshot)
        .catch(err => console.error("[WastageReport] save (timer) failed:", err));
    }, 2_000);

    return () => clearTimeout(tid);
  }, [sessionStudied, timerSeconds, nowMin]); // eslint-disable-line

  async function handleRemoveSelected() {
    if (!selectedId || !user || !currentExamId || !currentPlanId) return;
    if (!confirm("Remove this session from the active plan?")) return;
    await deletePlanSession(user.uid, currentExamId, currentPlanId, selectedId);
    setSelectedId(null);
  }

  // ── Derived data ─────────────────────────────────────────────────────────
  const studiedSecsForDisplay = {};
  if (studiedLoaded) {
    for (const s of planSessions) {
      const liveSecs = activeSession?.id === s.id ? Number(timerSeconds || 0) : 0;
      studiedSecsForDisplay[s.id] = Math.max(Number(sessionStudied[s.id] || 0), 0) + liveSecs;
    }
  }
  const todayWastage = studiedLoaded ? calcWastage(planSessions, studiedSecsForDisplay, nowMin) : [];
  const totalWastage = todayWastage.reduce((a, s) => a + s.wastageMins, 0);
  const totalStudied = todayWastage.reduce((a, s) => a + s.studiedMins, 0);
  const missedCount  = todayWastage.filter(s => s.missed).length;
  const partialCount = todayWastage.filter(s => !s.missed).length;
  const completedScheduled = planSessions.filter(s => toMin(s.end) <= nowMin).length;
  const completedFull = completedScheduled - todayWastage.length;

  const todayStr = new Date().toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric" });

  // Guard
  if (!currentExamId || !currentPlanId) {
    return (
      <div className="stp-content">
        <section className="stp-hero">
          <div>
            <h1>Wastage <em>report</em></h1>
            <div className="stp-hero-sub">{todayStr} · No active plan selected.</div>
          </div>
        </section>
        <div className="stp-groups-empty">
          <div className="ic">📋</div>
          <h3>Select a <em>plan</em> first</h3>
          <p>Pick an exam and plan to start tracking your wastage.</p>
        </div>
        <WastageHistory activeSessions={[]} />
      </div>
    );
  }

  return (
    <div className="stp-content">
      <section className="stp-hero">
        <div>
          <h1>Wastage <em>report</em></h1>
          <div className="stp-hero-sub">
            {todayStr} · <b>{completedScheduled}</b> session{completedScheduled !== 1 ? "s" : ""} ended
            {totalWastage > 0 ? <> · <b>{toHM(totalWastage)}</b> wasted</> : <> · clean record so far</>}
          </div>
        </div>
        <div className="stp-stats">
          <Stat label="Studied"  value={toHM(totalStudied)} />
          <Stat label="Wasted"   value={toHM(totalWastage)} />
          <Stat label="Missed"   value={missedCount} />
        </div>
      </section>

      {!studiedLoaded ? (
        <div className="stp-groups-empty">
          <div className="ic">⏳</div>
          <h3>Loading <em>progress</em></h3>
          <p>Reading today's study activity…</p>
        </div>
      ) : (
        <>
          <div className="stp-summary-grid">
            <div className="stp-sum red">
              <div className="l">Missed today</div>
              <div className="v red">{missedCount}</div>
            </div>
            <div className="stp-sum amber">
              <div className="l">Partial today</div>
              <div className="v amber">{partialCount}</div>
            </div>
            <div className="stp-sum green">
              <div className="l">Completed</div>
              <div className="v green">{Math.max(completedFull, 0)}</div>
            </div>
          </div>

          <div className="stp-wastage-grid">
            <div className="stp-panel">
              <div className="stp-panel-head">
                <h3>Today's <em>breakdown</em></h3>
                <span className="badge">{toHM(totalStudied + totalWastage)} elapsed</span>
              </div>
              <BreakdownDonut studied={totalStudied} wasted={totalWastage} missed={missedCount} partial={partialCount} />
            </div>

            <div className="stp-panel">
              <div className="stp-panel-head">
                <h3>Wasted <em>sessions</em></h3>
                {selectedId && (
                  <button className="stp-btn" onClick={handleRemoveSelected}
                    style={{ fontSize:12, padding:"6px 12px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--ink)", cursor:"pointer" }}>
                    Remove
                  </button>
                )}
              </div>
              {todayWastage.length === 0 ? (
                <EmptyClean />
              ) : (
                <div>
                  {todayWastage.map(s => (
                    <WastageCard
                      key={s.id} s={s}
                      selected={selectedId === s.id}
                      onSelect={() => setSelectedId(selectedId === s.id ? null : s.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <WastageHistory activeSessions={planSessions} />
    </div>
  );
}

// ─── Donut breakdown ─────────────────────────────────────────────────────────
function BreakdownDonut({ studied, wasted, missed, partial }) {
  const total = Math.max(studied + wasted, 1);
  const studiedPct = (studied / total) * 100;
  const wastedPct  = (wasted  / total) * 100;

  const R = 64, C = 2 * Math.PI * R;
  const segStudied = (studiedPct / 100) * C;
  const segWasted  = (wastedPct  / 100) * C;

  return (
    <div className="stp-donut-wrap">
      <div className="stp-donut">
        <svg viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={R} fill="none" stroke="var(--chip)" strokeWidth="18" />
          <circle
            cx="80" cy="80" r={R} fill="none" stroke="#4CAF50" strokeWidth="18"
            strokeDasharray={`${segStudied} ${C}`} strokeLinecap="butt"
          />
          <circle
            cx="80" cy="80" r={R} fill="none" stroke="#E57373" strokeWidth="18"
            strokeDasharray={`${segWasted} ${C}`}
            strokeDashoffset={-segStudied}
            strokeLinecap="butt"
          />
        </svg>
        <div className="stp-donut-center">
          <div className="stp-donut-val">{Math.round((studied / total) * 100)}%</div>
          <div className="stp-donut-lbl">studied</div>
        </div>
      </div>
      <div className="stp-legend">
        <div className="stp-legend-row">
          <span className="lbl"><span className="sw" style={{ background:"#4CAF50" }} /> Studied</span>
          <span className="v">{toHM(studied)}</span>
        </div>
        <div className="stp-legend-row">
          <span className="lbl"><span className="sw" style={{ background:"#E57373" }} /> Wasted</span>
          <span className="v">{toHM(wasted)}</span>
        </div>
        <div className="stp-legend-row">
          <span className="lbl"><span className="sw" style={{ background:"#E4A62A" }} /> Partial</span>
          <span className="v">{partial}</span>
        </div>
        <div className="stp-legend-row">
          <span className="lbl"><span className="sw" style={{ background:"#C62828" }} /> Missed</span>
          <span className="v">{missed}</span>
        </div>
      </div>
    </div>
  );
}

function WastageCard({ s, selected, onSelect }) {
  const wastePct = s.durMins > 0 ? Math.min(100, Math.round((s.wastageMins / s.durMins) * 100)) : 0;
  const cls = `stp-w-card ${selected ? "selected " : ""}${s.missed ? "missed" : "partial"}`;
  return (
    <div className={cls} onClick={onSelect}>
      <div>
        <div className="name">{s.name}</div>
        <div className="meta">
          <span>{fmt12(s.start)}–{fmt12(s.end)}</span>
          <span>Studied <b className="studied">{toHHMMSS(s.studiedMins)}</b></span>
          <span>Wasted <b className="wasted">{toHHMMSS(s.wastageMins)}</b></span>
        </div>
        <div style={{ marginTop:8, height:6, background:"var(--chip)", borderRadius:999, overflow:"hidden" }}>
          <div style={{
            width:`${wastePct}%`, height:"100%",
            background: s.missed ? "#E57373" : "linear-gradient(90deg,#E4A62A,#E57373)",
            transition:"width .4s",
          }} />
        </div>
      </div>
      <div className="right">
        <StatusBadge missed={s.missed} />
        <span style={{ fontSize:11, color:"var(--ink2)", fontFamily:"var(--mono)" }}>{wastePct}% wasted</span>
      </div>
    </div>
  );
}

function EmptyClean() {
  return (
    <div style={{ textAlign:"center", padding:"32px 16px", color:"var(--ink2)" }}>
      <div style={{ fontSize:36 }}>✅</div>
      <p style={{ marginTop:8, fontSize:13 }}>No wastage yet — sessions appear here once their scheduled end passes.</p>
    </div>
  );
}

function StatusBadge({ missed }) {
  return missed
    ? <span style={{ background:"#fde8e8", color:"#C62828", padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase" }}>Missed</span>
    : <span style={{ background:"#fdf3e8", color:"#B7791F", padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase" }}>Partial</span>;
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
