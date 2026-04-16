import React, { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { listenWastage, deleteWastage, deleteAllWastage } from "../firebase/db";
import useStore from "../store/useStore";
import WastageHistoryTable from "./plan/WastageHistoryTable";

export default function WastageHistory() {
  const { user } = useAuth();
  const { showToast, setWastageHistory } = useStore();
  const [history,  setHistory]  = useState({});
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!user) return;
    const unsub = listenWastage(user.uid, (data) => {
      console.log("[WastageHistory] received from Firebase:", data);
      setHistory(data);
      setWastageHistory(data);
    });
    return () => unsub();
  }, [user]);

  const dates = Object.keys(history).sort((a, b) => b.localeCompare(a));

  // Collect unique session keys (subject or name) across all dates
  const sessionKeys = [];
  const seen = new Set();
  dates.forEach(date => {
    Object.values(history[date] || {}).forEach(s => {
      const key = s.subject || s.sessionName;
      if (!seen.has(key)) { seen.add(key); sessionKeys.push(key); }
    });
  });

  const totalMissed = dates.reduce((acc, d) =>
    acc + Object.values(history[d] || {}).filter(s => s.missed).length, 0);
  const totalMins = dates.reduce((acc, d) =>
    acc + Object.values(history[d] || {}).filter(s => s.missed).reduce((a, s) => a + (s.duration || 0), 0), 0);

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
    <p style={{ textAlign: "center", color: "#6b6560", padding: 24 }}>
      Sign in to see all-time history.
    </p>
  );

  return (
    <div style={{ marginTop: 32 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a1814" }}>All-Time Wastage By Date</h2>
        <button onClick={handleRemoveSelected} disabled={!selected} style={outlineBtn(!selected)}>
          Remove Selected {selected ? `(${selected})` : "Entry"}
        </button>
      </div>

      {/* Table / Cards */}
      <div style={{ overflowX: "auto", background: "white", borderRadius: 10, border: "1px solid #ddd9d2", boxShadow: "0 2px 12px rgba(0,0,0,.08)", marginBottom: 16 }}>
        <WastageHistoryTable
          history={history}
          dates={dates}
          sessionKeys={sessionKeys}
          selected={selected}
          onSelect={setSelected}
          totalMissed={totalMissed}
          totalMins={totalMins}
        />
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1814", margin: 0 }}>
          Total wastage:{" "}
          <span style={{ fontFamily: "monospace", color: "#e63946" }}>{toHHMMSS(totalMins)}</span>
          {" | "}Missed:{" "}
          <span style={{ color: "#e63946" }}>{totalMissed}</span>
        </p>
        <button onClick={handleResetAll} style={redBtn}>Reset All</button>
      </div>
    </div>
  );
}

function toHHMMSS(mins) {
  const m = mins || 0;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

const redBtn = {
  background: "#e63946", color: "white", border: "none",
  borderRadius: 8, padding: "9px 20px", fontSize: 14, fontWeight: 500, cursor: "pointer",
};
function outlineBtn(disabled) {
  return {
    background: disabled ? "#f8f6f2" : "white",
    color: disabled ? "#aaa" : "#e63946",
    border: `1.5px solid ${disabled ? "#ddd9d2" : "#e63946"}`,
    borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
