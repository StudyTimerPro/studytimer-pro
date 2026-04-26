import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { listenWastage, deleteWastage, deleteAllWastage } from "../firebase/db";
import useStore from "../store/useStore";

function toHM(mins) {
  const m = Math.max(0, Math.round(mins || 0));
  const h = Math.floor(m / 60), mm = m % 60;
  if (h <= 0) return `${mm}m`;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}
function toHHMMSS(mins) {
  const m = mins || 0;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}
function fmtDate(d) {
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString(undefined, { month:"short", day:"numeric" });
}

export default function WastageHistory({ activeSessions = [] }) {
  const { user } = useAuth();
  const { showToast, setWastageHistory } = useStore();
  const [history,  setHistory]  = useState({});
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!user) return;
    const unsub = listenWastage(user.uid, (data) => {
      setHistory(data);
      setWastageHistory(data);
    });
    return () => unsub();
  }, [user]); // eslint-disable-line

  const dates = useMemo(() => Object.keys(history).sort((a, b) => b.localeCompare(a)), [history]);

  const dayTotals = useMemo(() => {
    return dates.map(d => {
      const entries = Object.values(history[d] || {});
      const mins   = entries.reduce((a, s) => a + (s.duration || 0), 0);
      const missed = entries.filter(s => s.missed).length;
      const partial = entries.filter(s => !s.missed && (s.duration || 0) > 0).length;
      return { date: d, mins, missed, partial, count: entries.length };
    });
  }, [history, dates]);

  const maxMins = Math.max(1, ...dayTotals.map(d => d.mins));
  const totalMissed = dayTotals.reduce((a, d) => a + d.missed, 0);
  const totalMins   = dayTotals.reduce((a, d) => a + d.mins, 0);

  async function handleRemoveSelected() {
    if (!selected || !user) return;
    if (!confirm(`Remove wastage entry for ${selected}?`)) return;
    await deleteWastage(user.uid, selected);
    setSelected(null);
    showToast(`Removed entry for ${selected}`);
  }

  async function handleResetAll() {
    if (!user || !confirm("Reset ALL wastage history? This cannot be undone.")) return;
    await deleteAllWastage(user.uid);
    setSelected(null);
    showToast("All wastage history cleared");
  }

  if (!user) return (
    <p style={{ textAlign:"center", color:"var(--ink2)", padding:24 }}>
      Sign in to see all-time history.
    </p>
  );

  return (
    <div className="stp-panel" style={{ marginTop:24 }}>
      <div className="stp-panel-head">
        <h3>All-time <em>wastage</em></h3>
        <span className="badge">{dates.length} day{dates.length !== 1 ? "s" : ""}</span>
      </div>

      {dates.length === 0 ? (
        <div style={{ textAlign:"center", padding:"32px 16px", color:"var(--ink2)" }}>
          <div style={{ fontSize:32 }}>📊</div>
          <p style={{ marginTop:8, fontSize:13 }}>No history yet — wastage rolls up here once sessions end.</p>
        </div>
      ) : (
        <div>
          {dayTotals.map(d => {
            const pct  = (d.mins / maxMins) * 100;
            const isSel  = selected === d.date;
            const isOpen = expanded === d.date;
            const sessions = Object.values(history[d.date] || {});
            return (
              <div key={d.date} className={`stp-bar-row expandable${isOpen ? " open" : ""}`}
                style={{ cursor:"pointer", paddingLeft:8, paddingRight:8, borderRadius:8, background: isSel ? "var(--accent-bg)" : "transparent" }}
                onClick={() => {
                  setExpanded(isOpen ? null : d.date);
                  setSelected(d.date);
                }}>
                <div className="chev">▶</div>
                <div className="stp-bar-date">{fmtDate(d.date)}</div>
                <div className="stp-bar-track">
                  <div className="stp-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="stp-bar-val">{toHM(d.mins)}</div>
                <div style={{ width:64, textAlign:"right", fontSize:10, color:"var(--ink3)", fontFamily:"var(--mono)", letterSpacing:".06em", textTransform:"uppercase", flexShrink:0 }}>
                  {d.missed}m · {d.partial}p
                </div>
                {isOpen && (
                  <div className="stp-bar-detail" onClick={e => e.stopPropagation()}>
                    {sessions.length === 0 ? (
                      <div style={{ fontSize:12, color:"var(--ink2)", textAlign:"center", padding:6 }}>No data.</div>
                    ) : sessions
                        .slice()
                        .sort((a, b) => (b.duration || 0) - (a.duration || 0))
                        .map((s, i) => (
                          <div key={i} className="item">
                            <span className="nm">{s.sessionName || s.subject || "Untitled"}</span>
                            <span className={`du ${s.missed ? "miss" : "part"}`}>{toHM(s.duration || 0)}</span>
                          </div>
                        ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12, marginTop:16, paddingTop:14, borderTop:"1px solid var(--border)" }}>
        <p style={{ fontSize:13, color:"var(--ink2)", margin:0 }}>
          Total wasted{" "}
          <span style={{ fontFamily:"var(--mono)", color:"#C62828", fontWeight:600 }}>{toHHMMSS(totalMins)}</span>
          {"  ·  "}Missed{" "}
          <span style={{ color:"#C62828", fontWeight:600 }}>{totalMissed}</span>
        </p>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={handleRemoveSelected} disabled={!selected} style={outline(!selected)}>
            Remove {selected ? `(${fmtDate(selected)})` : "selected"}
          </button>
          <button onClick={handleResetAll} style={red}>Reset all</button>
        </div>
      </div>
    </div>
  );
}

const red = {
  background:"#C62828", color:"#fff", border:"none", borderRadius:8,
  padding:"8px 16px", fontSize:12, fontWeight:600, cursor:"pointer",
  letterSpacing:".02em",
};
function outline(disabled) {
  return {
    background: disabled ? "var(--bg)" : "var(--surface)",
    color: disabled ? "var(--ink3)" : "#C62828",
    border: `1px solid ${disabled ? "var(--border)" : "#E57373"}`,
    borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
