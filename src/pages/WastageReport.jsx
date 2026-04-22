import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { saveWastage, getWastageDate, getPlans, listenPlanSessions, deletePlanSession } from "../firebase/db";
import WastageHistory from "../components/WastageHistory";
import useStore from "../store/useStore";

// ─── Shared helpers ──────────────────────────────────────────────────────────
function dur(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
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
function dateStr(d) { return d.toISOString().split("T")[0]; }
function normalizePlans(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Object.entries(raw).map(([id, v]) => ({ id, ...v }));
}
function normalizeSessions(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Object.entries(raw).map(([id, v]) => ({ id, ...v }));
}

// ─── Mobile breakpoint hook ───────────────────────────────────────────────────
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function WastageReport() {
  const { user } = useAuth();
  const { setExportSessions } = useStore();
  const [allSessions,  setAllSessions]  = useState([]);
  const [todayWastage, setTodayWastage] = useState([]);
  const [totalWastage, setTotalWastage] = useState(0);
  // selectedId is a composite: "planId::sessionId"
  const [selectedId,   setSelectedId]   = useState(null);
  const yesterdayDone = useRef(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!user) return;
    yesterdayDone.current = false;

    // planId → sessions[] map; updated as each plan's listener fires
    const allPlanSessions = {};
    const unsubscribers   = {};
    let   isActive        = true;

    function processAll() {
      if (!isActive) return;

      // Merge sessions from all plans, namespace each session ID to avoid collisions
      const merged = Object.entries(allPlanSessions).flatMap(([planId, sessions]) =>
        sessions.map(s => ({ ...s, _planId: planId, _compositeId: `${planId}::${s.id}` }))
      );

      if (merged.length === 0) {
        setAllSessions([]); setTodayWastage([]); setTotalWastage(0); return;
      }

      const now = new Date();
      const withStatus = merged.map(s => {
        const [h, m] = (s.start || "00:00").split(":").map(Number);
        const t = new Date(); t.setHours(h, m, 0, 0);
        return { ...s, missed: t < now && !s.completed };
      });

      const missed = withStatus.filter(s => s.missed);
      setAllSessions(withStatus);
      setExportSessions(withStatus);
      setTodayWastage(missed);
      setTotalWastage(missed.reduce((acc, s) => acc + dur(s.start, s.end), 0));

      // Build wastage snapshot keyed by compositeId so each session is unique
      const buildObj = (forceMissed) => {
        const obj = {};
        withStatus.forEach(s => {
          obj[s._compositeId] = {
            sessionName : s.name,
            subject     : s.subject || s.name,
            duration    : dur(s.start, s.end),
            missed      : forceMissed !== undefined ? forceMissed : s.missed,
          };
        });
        return obj;
      };

      const todayDate = dateStr(new Date());
      saveWastage(user.uid, todayDate, buildObj(undefined))
        .catch(err => console.error("[WastageReport] save FAILED:", err));

      if (!yesterdayDone.current) {
        yesterdayDone.current = true;
        const yesterday = dateStr(new Date(Date.now() - 86400000));
        getWastageDate(user.uid, yesterday).then(existing => {
          if (!existing) saveWastage(user.uid, yesterday, buildObj(true));
        });
      }
    }

    // Load all plans, subscribe to each plan's sessions
    getPlans(user.uid)
      .then(raw => {
        if (!isActive) return;
        const plans = normalizePlans(raw);

        if (plans.length === 0) {
          // No plans yet — nothing to show
          setAllSessions([]); setTodayWastage([]); setTotalWastage(0);
          return;
        }

        plans.forEach(plan => {
          const unsub = listenPlanSessions(user.uid, plan.id, (rawSessions) => {
            if (!isActive) return;
            allPlanSessions[plan.id] = normalizeSessions(rawSessions);
            processAll();
          });
          if (typeof unsub === "function") unsubscribers[plan.id] = unsub;
        });
      })
      .catch(err => {
        console.error("[WastageReport] getPlans FAILED:", err);
        setAllSessions([]); setTodayWastage([]); setTotalWastage(0);
      });

    return () => {
      isActive = false;
      Object.values(unsubscribers).forEach(u => typeof u === "function" && u());
    };
  }, [user]); // eslint-disable-line

  async function handleRemoveSelected() {
    if (!selectedId || !user) return;
    if (!confirm("Remove this session from its plan?")) return;

    // Composite ID: "planId::sessionId"
    const [planId, sessionId] = selectedId.split("::");
    if (planId && sessionId) {
      await deletePlanSession(user.uid, planId, sessionId);
    }
    setSelectedId(null);
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, color: "var(--ink)" }}>
        Today's Wastage
      </h2>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button
          onClick={handleRemoveSelected}
          disabled={!selectedId}
          style={outlineRed(!selectedId)}
        >
          Remove Selected Entry
        </button>
      </div>

      {/* ── Today's table — desktop full table, mobile compact cards ── */}
      {isMobile ? (
        <TodayMobileCards
          sessions={todayWastage}
          selectedId={selectedId}
          onSelect={setSelectedId}
          user={user}
        />
      ) : (
        <div style={{ background: "var(--surface)", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 20, boxShadow: "var(--shadow)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead style={{ background: "var(--nav-bg)", color: "white" }}>
                <tr>
                  {["Session", "Scheduled Start", "Actual Start", "Wastage", "Missed"].map(h => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todayWastage.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--ink2)" }}>
                      <div style={{ fontSize: 32 }}>✅</div>
                      <p style={{ marginTop: 8 }}>{user ? "No wastage today! Great job!" : "Sign in to see your wastage."}</p>
                    </td>
                  </tr>
                ) : todayWastage.map(s => {
                  const isSel = selectedId === s._compositeId;
                  return (
                    <tr key={s._compositeId}
                      onClick={() => setSelectedId(isSel ? null : s._compositeId)}
                      style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", background: isSel ? "var(--accent-light)" : "var(--surface)" }}>
                      <td style={{ padding: "12px 14px", fontWeight: 500, color: "var(--ink)" }}>
                        {s.name}
                        {s.subject && <div style={{ fontSize: 11, color: "var(--ink2)", marginTop: 2 }}>{s.subject}</div>}
                      </td>
                      <td style={{ padding: "12px 14px", fontFamily: "monospace", color: "var(--ink)" }}>{fmt12(s.start)}</td>
                      <td style={{ padding: "12px 14px", color: "var(--red)", fontWeight: 600 }}>MISSED</td>
                      <td style={{ padding: "12px 14px", fontFamily: "monospace", color: "var(--red)" }}>{toHHMMSS(dur(s.start, s.end))}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ background: "#fde8e8", color: "var(--red)", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>YES</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 8 }}>
        <SummaryCard label="Missed Today"  value={todayWastage.length}    color="var(--red)" />
        <SummaryCard label="Total Wastage" value={toHHMMSS(totalWastage)} color="#e67e22"    />
      </div>

      <WastageHistory />
    </div>
  );
}

// ─── Mobile compact card view for today's wastage ─────────────────────────────
function TodayMobileCards({ sessions, selectedId, onSelect, user }) {
  if (sessions.length === 0) {
    return (
      <div style={{
        textAlign: "center", padding: 40, color: "var(--ink2)",
        background: "var(--surface)", borderRadius: 10,
        border: "1px solid var(--border)", marginBottom: 20,
        boxShadow: "var(--shadow)",
      }}>
        <div style={{ fontSize: 32 }}>✅</div>
        <p style={{ marginTop: 8 }}>
          {user ? "No wastage today! Great job!" : "Sign in to see your wastage."}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
      {sessions.map(s => {
        const isSel = selectedId === s._compositeId;
        return (
          <div
            key={s._compositeId}
            onClick={() => onSelect(isSel ? null : s._compositeId)}
            style={{
              background   : isSel ? "var(--accent-light)" : "var(--surface)",
              border       : `1.5px solid ${isSel ? "var(--accent)" : "var(--border)"}`,
              borderRadius : 10,
              padding      : "11px 14px",
              cursor       : "pointer",
              boxShadow    : "var(--shadow)",
            }}
          >
            {/* Top row: name + MISSED badge */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.name}
                </div>
                {s.subject && (
                  <div style={{ fontSize: 11, color: "var(--ink2)", marginTop: 1 }}>{s.subject}</div>
                )}
              </div>
              <span style={{ background: "#fde8e8", color: "var(--red)", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
                MISSED
              </span>
            </div>

            {/* Bottom row: scheduled time + wastage duration */}
            <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12 }}>
              <span style={{ color: "var(--ink2)" }}>
                🕐 {fmt12(s.start)}
              </span>
              <span style={{ color: "var(--red)", fontFamily: "monospace", fontWeight: 700 }}>
                ⏱ {toHHMMSS(dur(s.start, s.end))}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tiny sub-components ──────────────────────────────────────────────────────
function SummaryCard({ label, value, color }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 10, padding: "20px 16px", textAlign: "center", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function outlineRed(disabled) {
  return {
    background  : disabled ? "var(--bg)" : "var(--surface)",
    color       : disabled ? "var(--ink2)" : "var(--red)",
    border      : `1.5px solid ${disabled ? "var(--border)" : "var(--red)"}`,
    borderRadius: 8,
    padding     : "9px 20px",
    fontSize    : 13,
    fontWeight  : 500,
    cursor      : disabled ? "not-allowed" : "pointer",
  };
}
