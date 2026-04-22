import React, { useState, useEffect } from "react";

function useIsMobile() {
  const [mobile, setMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 600 : false
  );
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 600);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

export default function WastageHistoryTable({
  history, dates, sessionKeys, selected, onSelect, totalMissed, totalMins,
}) {
  const isMobile = useIsMobile();

  if (dates.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "var(--ink2)" }}>
        <div style={{ fontSize: 32 }}>📅</div>
        <p style={{ marginTop: 8 }}>No history yet — recorded automatically each day.</p>
      </div>
    );
  }

  return isMobile
    ? <MobileCards history={history} dates={dates} selected={selected} onSelect={onSelect} />
    : <DesktopTable history={history} dates={dates} sessionKeys={sessionKeys}
        selected={selected} onSelect={onSelect} totalMissed={totalMissed} totalMins={totalMins} />;
}

function DesktopTable({ history, dates, sessionKeys, selected, onSelect, totalMissed, totalMins }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ background: "var(--nav-bg)", color: "white" }}>
          <th style={thS}>Date</th>
          {sessionKeys.map(k => <th key={k} style={thS}>{k}</th>)}
          <th style={thS}>Missed</th>
          <th style={thS}>Total</th>
        </tr>
      </thead>
      <tbody>
        {dates.map(date => {
          const sessions  = history[date] || {};
          const vals      = Object.values(sessions);
          const isActive  = selected === date;
          const rowMissed = vals.filter(s => s.missed).length;
          const rowTotal  = vals.filter(s => s.missed).reduce((a, s) => a + (s.duration || 0), 0);
          return (
            <tr key={date} onClick={() => onSelect(isActive ? null : date)}
              style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", background: isActive ? "var(--accent-light)" : "var(--surface)" }}>
              <td style={{ ...tdS, fontWeight: 600, whiteSpace: "nowrap", color: "var(--ink)" }}>{date}</td>
              {sessionKeys.map(key => {
                const s = vals.find(x => (x.subject || x.sessionName) === key);
                if (!s) return <td key={key} style={{ ...tdS, textAlign: "center" }}><span style={{ color: "var(--border)" }}>—</span></td>;
                return (
                  <td key={key} style={{ ...tdS, textAlign: "center" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: s.missed ? "var(--red)" : "var(--accent)" }}>
                      {s.missed ? toHHMMSS(s.duration) : "00:00:00"}
                    </span>
                  </td>
                );
              })}
              <td style={{ ...tdS, textAlign: "center", color: "var(--red)", fontWeight: 600 }}>{rowMissed}</td>
              <td style={{ ...tdS, fontFamily: "monospace", color: "var(--red)" }}>{toHHMMSS(rowTotal)}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr style={{ background: "var(--bg)", fontWeight: 700 }}>
          <td style={{ ...tdS, color: "var(--ink)" }}>All Time</td>
          {sessionKeys.map(k => <td key={k} />)}
          <td style={{ ...tdS, textAlign: "center", color: "var(--red)" }}>{totalMissed}</td>
          <td style={{ ...tdS, fontFamily: "monospace", color: "var(--red)" }}>{toHHMMSS(totalMins)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function MobileCards({ history, dates, selected, onSelect }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12 }}>
      {dates.map(date => {
        const sessions  = Object.values(history[date] || {});
        const isActive  = selected === date;
        const rowMissed = sessions.filter(s => s.missed).length;
        const rowTotal  = sessions.filter(s => s.missed).reduce((a, s) => a + (s.duration || 0), 0);
        return (
          <div key={date} onClick={() => onSelect(isActive ? null : date)}
            style={{
              background: isActive ? "var(--accent-light)" : "var(--surface)",
              border: `1.5px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 10, padding: "12px 14px", cursor: "pointer",
              boxShadow: "0 1px 6px rgba(0,0,0,.06)",
            }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14, fontFamily: "monospace", color: "var(--ink)" }}>{date}</span>
              <span style={{ fontSize: 11, color: "var(--ink2)" }}>
                Missed: <b style={{ color: "var(--red)" }}>{rowMissed}</b>
                {" | "}Total: <b style={{ color: "var(--red)", fontFamily: "monospace" }}>{toHHMMSS(rowTotal)}</b>
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {sessions.map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                  <span style={{ color: "var(--ink)" }}>
                    {s.sessionName}
                    {s.subject && s.subject !== s.sessionName &&
                      <span style={{ color: "var(--ink2)", fontSize: 11 }}> ({s.subject})</span>}
                  </span>
                  <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: s.missed ? "var(--red)" : "var(--accent)" }}>
                    {s.missed ? toHHMMSS(s.duration) : "00:00:00"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function toHHMMSS(mins) {
  const m = mins || 0;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}
const thS = { padding: "11px 14px", textAlign: "left", fontSize: 11, textTransform: "uppercase", whiteSpace: "nowrap", letterSpacing: 0.4 };
const tdS = { padding: "10px 14px" };
