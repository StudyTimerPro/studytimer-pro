import React, { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { listenWastage, deleteWastage, deleteAllWastage } from "../firebase/db";
import useStore from "../store/useStore";
import WastageHistoryTable from "./plan/WastageHistoryTable";

function toHHMMSS(mins) {
  const m = mins || 0;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

/**
 * activeSessions: current plan's session objects { id, name, subject?, ... }
 * Used to determine which columns to show — only live sessions, no ghost columns
 * from deleted sessions.
 */
export default function WastageHistory({ activeSessions = [] }) {
  const { user } = useAuth();
  const { showToast, setWastageHistory } = useStore();
  const [history,  setHistory]  = useState({});
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!user) return;
    const unsub = listenWastage(user.uid, (data) => {
      setHistory(data);
      setWastageHistory(data);
    });
    return () => unsub();
  }, [user]);

  const dates = Object.keys(history).sort((a, b) => b.localeCompare(a));

  // ── Session columns: ONLY from the current active plan ───────────────────
  // Using activeSessions prop means deleted/renamed sessions won't ghost as columns.
  // Deduplicate by key in case two sessions share a subject.
  const sessionKeys = [];
  const seen = new Set();
  activeSessions.forEach(s => {
    const key = s.subject || s.name;
    if (key && !seen.has(key)) { seen.add(key); sessionKeys.push(key); }
  });

  // ── Totals: sum ALL wastage duration (missed + partial) ──────────────────
  // Previously filtered to s.missed only — wrong now that duration = actual wastage.
  const totalMissed = dates.reduce((acc, d) =>
    acc + Object.values(history[d] || {}).filter(s => s.missed).length, 0);

  const totalMins = dates.reduce((acc, d) =>
    acc + Object.values(history[d] || {}).reduce((a, s) => a + (s.duration || 0), 0), 0);

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
    <p style={{ textAlign: "center", color: "var(--ink2)", padding: 24 }}>
      Sign in to see all-time history.
    </p>
  );

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>All-Time Wastage By Date</h2>
        <button onClick={handleRemoveSelected} disabled={!selected} style={outlineBtn(!selected)}>
          Remove Selected {selected ? `(${selected})` : "Entry"}
        </button>
      </div>

      <div style={{ overflowX: "auto", background: "var(--surface)", borderRadius: 10, border: "1px solid var(--border)", boxShadow: "var(--shadow)", marginBottom: 16 }}>
        <WastageHistoryTable
          history={history} dates={dates} sessionKeys={sessionKeys}
          selected={selected} onSelect={setSelected}
          totalMissed={totalMissed} totalMins={totalMins}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
          Total wastage:{" "}
          <span style={{ fontFamily: "monospace", color: "var(--red)" }}>{toHHMMSS(totalMins)}</span>
          {" | "}Missed:{" "}
          <span style={{ color: "var(--red)" }}>{totalMissed}</span>
        </p>
        <button onClick={handleResetAll} style={redBtn}>Reset All</button>
      </div>
    </div>
  );
}

const redBtn = { background: "var(--red)", color: "white", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 14, fontWeight: 500, cursor: "pointer" };
function outlineBtn(disabled) {
  return {
    background: disabled ? "var(--bg)" : "var(--surface)",
    color: disabled ? "var(--ink2)" : "var(--red)",
    border: `1.5px solid ${disabled ? "var(--border)" : "var(--red)"}`,
    borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
