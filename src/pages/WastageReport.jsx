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
function fmt12(t) {
  if (!t) return "—";
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

/**
 * LOCAL calendar date — never use toISOString() which returns UTC.
 * In IST (+5:30), toISOString() at midnight local = 6:30 PM UTC previous day.
 * Matches the same logic used in TodaysPlan.getTodayKey().
 */
function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useIsMobile(bp = 600) {
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

// ─── Display: which sessions have wastage right now ───────────────────────────
function calcWastage(sessions, studiedSecsMap, nowMin) {
  const result = [];
  for (const s of sessions) {
    if (!s.start || !s.end) continue;
    if (toMin(s.end) > nowMin) continue;               // not finished yet
    const durMins     = dur(s.start, s.end);
    const studiedSecs = Math.max(Number(studiedSecsMap[s.id] || 0), 0);
    const studiedMins = Math.floor(studiedSecs / 60);
    const wastageMins = Math.max(durMins - studiedMins, 0);
    if (wastageMins === 0) continue;                   // fully completed
    result.push({ ...s, studiedMins, wastageMins, missed: studiedSecs === 0 });
  }
  return result;
}

// ─── Firebase wastage snapshot ────────────────────────────────────────────────
// duration = actual wasted minutes (not full session duration).
function buildSnapshot(planSessions, studiedSecsMap, activeSession, timerSeconds, nowMin) {
  const snapshot = {};
  for (const s of planSessions) {
    if (!s.start || !s.end) continue;
    if (toMin(s.end) > nowMin) continue;   // skip sessions that haven't ended yet
    const durMins     = dur(s.start, s.end);
    const liveSecs    = activeSession?.id === s.id ? Number(timerSeconds || 0) : 0;
    const totalSecs   = Math.max(Number(studiedSecsMap[s.id] || 0), 0) + liveSecs;
    const studiedMins = Math.floor(totalSecs / 60);
    const wastageMins = Math.max(durMins - studiedMins, 0);
    snapshot[s.id] = {
      sessionName : s.name,
      subject     : s.subject || s.name,
      duration    : wastageMins,
      missed      : totalSecs === 0,       // session ended and nothing was studied
    };
  }
  return snapshot;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function WastageReport() {
  const { user } = useAuth();
  const {
    setExportSessions,
    currentExamId,
    currentPlanId,
    // Single source of truth for studied seconds — shared with TodaysPlan.
    // TodaysPlan also loads into this store on mount. We do the same here
    // so both components always read from one place after a refresh.
    sessionStudied,
    setSessionStudied,
    timerSeconds,
    activeSession,
  } = useStore();

  const [planSessions,  setPlanSessions]  = useState([]);
  const [selectedId,    setSelectedId]    = useState(null);

  /**
   * studiedLoaded — blocks ALL Firebase writes until getStudyProgress resolves.
   *
   * Problem this solves:
   *   After refresh, sessionStudied in Zustand is empty ({}). planSessions arrive
   *   from Firebase within ~100ms. Without this gate, buildSnapshot would run with
   *   zero studied seconds for every session and overwrite Firebase with missed=true
   *   for all sessions — corrupting the data before getStudyProgress even resolves.
   */
  const [studiedLoaded, setStudiedLoaded] = useState(false);

  const [nowMin, setNowMin] = useState(() => {
    const n = new Date(); return n.getHours() * 60 + n.getMinutes();
  });

  const yesterdayDone = useRef(false);
  const isMobile      = useIsMobile();

  // Re-evaluate session end times every minute
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date(); setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Load study progress → put directly into Zustand sessionStudied store ──
  //
  // This is the exact same pattern TodaysPlan uses. Both components write into
  // the same Zustand store so there is only ONE source of truth.
  //
  // The merge strategy: take Math.max(persisted, current) per session so we
  // never regress in-flight timer progress when switching tabs.
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
          // Merge: persisted value wins over stale Zustand, but never regress
          // if the timer already ran ahead during this session.
          setSessionStudied(prev => {
            const next = { ...normalized };
            Object.entries(prev).forEach(([id, secs]) => {
              next[id] = Math.max(next[id] || 0, Number(secs) || 0);
            });
            return next;
          });
        }
        // Always unlock — even if today is genuinely empty (first use / no study).
        setStudiedLoaded(true);
      })
      .catch(() => {
        // Unlock even on network error so the app doesn't deadlock.
        setStudiedLoaded(true);
      });
  }, [user]); // only user — not currentPlanId, study progress is per-day not per-plan

  // ── Subscribe to active plan's sessions ──────────────────────────────────
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

  // ── SAVE: immediate when sessions load — GATED on studiedLoaded ──────────
  // This creates today's Firebase row as soon as we have both sessions AND
  // confirmed study progress. No debounce — we want this row guaranteed.
  useEffect(() => {
    if (!user || !currentExamId || !currentPlanId) return;
    if (!studiedLoaded) return;          // ← GATE: never save before progress loads
    if (planSessions.length === 0) return;

    const todayDate = localDateStr(new Date());
    const snapshot  = buildSnapshot(planSessions, sessionStudied, activeSession, timerSeconds, nowMin);
    if (Object.keys(snapshot).length === 0) return;  // no ended sessions yet — don't write empty rows

    saveWastage(user.uid, todayDate, snapshot)
      .catch(err => console.error("[WastageReport] save (sessions) failed:", err));

    // Back-fill yesterday once if entry is missing
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

  // ── SAVE: debounced on timer changes — GATED on studiedLoaded ────────────
  // Runs at most once every 2s to avoid spamming Firebase while timer ticks.
  useEffect(() => {
    if (!user || !currentExamId || !currentPlanId) return;
    if (!studiedLoaded) return;          // ← GATE
    if (planSessions.length === 0) return;

    const tid = setTimeout(() => {
      const todayDate = localDateStr(new Date());
      const snapshot  = buildSnapshot(planSessions, sessionStudied, activeSession, timerSeconds, nowMin);
      if (Object.keys(snapshot).length === 0) return;  // no ended sessions — don't write empty rows
      saveWastage(user.uid, todayDate, snapshot)
        .catch(err => console.error("[WastageReport] save (timer) failed:", err));
    }, 2_000);

    return () => clearTimeout(tid);
  }, [sessionStudied, timerSeconds, nowMin]); // eslint-disable-line

  // ── Remove selected session from active plan ──────────────────────────────
  async function handleRemoveSelected() {
    if (!selectedId || !user || !currentExamId || !currentPlanId) return;
    if (!confirm("Remove this session from the active plan?")) return;
    await deletePlanSession(user.uid, currentExamId, currentPlanId, selectedId);
    setSelectedId(null);
  }

  // ── Derived display data ──────────────────────────────────────────────────
  // Only compute once studiedLoaded=true so the UI never flickers to "missed"
  // state while waiting for getStudyProgress to resolve.
  const studiedSecsForDisplay = {};
  if (studiedLoaded) {
    for (const s of planSessions) {
      const liveSecs = activeSession?.id === s.id ? Number(timerSeconds || 0) : 0;
      studiedSecsForDisplay[s.id] = Math.max(Number(sessionStudied[s.id] || 0), 0) + liveSecs;
    }
  }
  const todayWastage = studiedLoaded ? calcWastage(planSessions, studiedSecsForDisplay, nowMin) : [];
  const totalWastage = todayWastage.reduce((acc, s) => acc + s.wastageMins, 0);

  // ── Guard: no active plan ────────────────────────────────────────────────
  if (!currentExamId || !currentPlanId) {
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, color: "var(--ink)" }}>Today's Wastage</h2>
        <div style={{ textAlign: "center", padding: 48, color: "var(--ink2)", background: "var(--surface)", borderRadius: 10, border: "1px solid var(--border)", marginBottom: 20 }}>
          <div style={{ fontSize: 32 }}>📋</div>
          <p style={{ marginTop: 8 }}>Select an exam and plan first to track wastage.</p>
        </div>
        <WastageHistory activeSessions={[]} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, color: "var(--ink)" }}>Today's Wastage</h2>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button onClick={handleRemoveSelected} disabled={!selectedId} style={outlineRed(!selectedId)}>
          Remove Selected Entry
        </button>
      </div>

      {/* Suppress the table entirely until study progress is loaded —
          prevents the "all missed" flash on refresh */}
      {!studiedLoaded ? (
        <div style={{ textAlign: "center", padding: 32, color: "var(--ink2)", background: "var(--surface)", borderRadius: 10, border: "1px solid var(--border)", marginBottom: 20 }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>⏳</div>
          Loading study progress…
        </div>
      ) : isMobile ? (
        <TodayMobileCards sessions={todayWastage} selectedId={selectedId} onSelect={setSelectedId} user={user} />
      ) : (
        <TodayDesktopTable sessions={todayWastage} selectedId={selectedId} onSelect={setSelectedId} user={user} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, marginBottom: 8 }}>
        <SummaryCard label="Missed Today"  value={todayWastage.filter(s => s.missed).length}  color="var(--red)"  />
        <SummaryCard label="Partial Today" value={todayWastage.filter(s => !s.missed).length} color="#e67e22"     />
        <SummaryCard label="Total Wastage" value={toHHMMSS(totalWastage)}                     color="var(--red)"  />
      </div>

      <WastageHistory activeSessions={planSessions} />
    </div>
  );
}

// ─── Desktop full table ───────────────────────────────────────────────────────
function TodayDesktopTable({ sessions, selectedId, onSelect, user }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 20, boxShadow: "var(--shadow)" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead style={{ background: "var(--nav-bg)", color: "white" }}>
            <tr>
              {["Session", "Scheduled", "Duration", "Studied", "Wasted", "Status"].map(h => (
                <th key={h} style={thHead}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--ink2)" }}>
                  <div style={{ fontSize: 32 }}>✅</div>
                  <p style={{ marginTop: 8 }}>{user ? "No wastage yet — sessions appear here once their scheduled end time passes." : "Sign in to see your wastage."}</p>
                </td>
              </tr>
            ) : sessions.map(s => {
              const isSel = selectedId === s.id;
              return (
                <tr key={s.id} onClick={() => onSelect(isSel ? null : s.id)}
                  style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", background: isSel ? "var(--accent-light)" : "var(--surface)" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 500, color: "var(--ink)" }}>
                    {s.name}
                    {s.subject && <div style={{ fontSize: 11, color: "var(--ink2)", marginTop: 2 }}>{s.subject}</div>}
                  </td>
                  <td style={{ padding: "12px 14px", fontFamily: "monospace", color: "var(--ink)", fontSize: 13 }}>
                    {fmt12(s.start)}–{fmt12(s.end)}
                  </td>
                  <td style={{ padding: "12px 14px", fontFamily: "monospace", color: "var(--ink2)", fontSize: 13 }}>
                    {toHHMMSS(dur(s.start, s.end))}
                  </td>
                  <td style={{ padding: "12px 14px", fontFamily: "monospace", color: "var(--accent)", fontWeight: 600, fontSize: 13 }}>
                    {toHHMMSS(s.studiedMins)}
                  </td>
                  <td style={{ padding: "12px 14px", fontFamily: "monospace", color: "var(--red)", fontWeight: 700, fontSize: 13 }}>
                    {toHHMMSS(s.wastageMins)}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <StatusBadge missed={s.missed} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Mobile compact cards ─────────────────────────────────────────────────────
function TodayMobileCards({ sessions, selectedId, onSelect, user }) {
  if (sessions.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "var(--ink2)", background: "var(--surface)", borderRadius: 10, border: "1px solid var(--border)", marginBottom: 20, boxShadow: "var(--shadow)" }}>
        <div style={{ fontSize: 32 }}>✅</div>
        <p style={{ marginTop: 8 }}>{user ? "No wastage yet — sessions appear here once their scheduled end time passes." : "Sign in to see your wastage."}</p>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
      {sessions.map(s => {
        const isSel = selectedId === s.id;
        return (
          <div key={s.id} onClick={() => onSelect(isSel ? null : s.id)}
            style={{ background: isSel ? "var(--accent-light)" : "var(--surface)", border: `1.5px solid ${isSel ? "var(--accent)" : "var(--border)"}`, borderRadius: 10, padding: "11px 14px", cursor: "pointer", boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                {s.subject && <div style={{ fontSize: 11, color: "var(--ink2)", marginTop: 1 }}>{s.subject}</div>}
              </div>
              <StatusBadge missed={s.missed} />
            </div>
            <div style={{ fontSize: 11, color: "var(--ink2)", marginTop: 5, fontFamily: "monospace" }}>
              {fmt12(s.start)} – {fmt12(s.end)} ({toHHMMSS(dur(s.start, s.end))} scheduled)
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 6, fontSize: 12 }}>
              <span><span style={{ color: "var(--ink2)" }}>Studied </span><b style={{ color: "var(--accent)", fontFamily: "monospace" }}>{toHHMMSS(s.studiedMins)}</b></span>
              <span><span style={{ color: "var(--ink2)" }}>Wasted </span><b style={{ color: "var(--red)", fontFamily: "monospace" }}>{toHHMMSS(s.wastageMins)}</b></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────
function StatusBadge({ missed }) {
  return missed
    ? <span style={{ background: "#fde8e8", color: "var(--red)", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>MISSED</span>
    : <span style={{ background: "#fdf3e8", color: "#c0621a",    padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>PARTIAL</span>;
}
function SummaryCard({ label, value, color }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 10, padding: "20px 16px", textAlign: "center", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 4 }}>{label}</div>
    </div>
  );
}
const thHead = { padding: "12px 14px", textAlign: "left", fontSize: 12, textTransform: "uppercase", whiteSpace: "nowrap", letterSpacing: 0.4 };
function outlineRed(disabled) {
  return { background: disabled ? "var(--bg)" : "var(--surface)", color: disabled ? "var(--ink2)" : "var(--red)", border: `1.5px solid ${disabled ? "var(--border)" : "var(--red)"}`, borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer" };
}
