import React, { useState, useEffect } from "react";

// ─── Shared helpers ───────────────────────────────────────────────────────────
function toHHMMSS(mins) {
  const m = mins || 0;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

const thS = {
  padding        : "11px 14px",
  textAlign      : "left",
  fontSize       : 11,
  textTransform  : "uppercase",
  whiteSpace     : "nowrap",
  letterSpacing  : 0.4,
};
const tdS = { padding: "10px 14px" };

// ─── Mobile breakpoint hook ───────────────────────────────────────────────────
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

// ─── Root component ───────────────────────────────────────────────────────────
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
    ? <MobileAccordion history={history} dates={dates} selected={selected} onSelect={onSelect} />
    : <DesktopTable    history={history} dates={dates} sessionKeys={sessionKeys}
        selected={selected} onSelect={onSelect} totalMissed={totalMissed} totalMins={totalMins} />;
}

// ─── Desktop: full cross-tab table ───────────────────────────────────────────
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
            <tr key={date}
              onClick={() => onSelect(isActive ? null : date)}
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

// ─── Mobile: accordion list ───────────────────────────────────────────────────
function MobileAccordion({ history, dates, selected, onSelect }) {
  // Set of dates whose session list is currently expanded
  const [openDates, setOpenDates] = useState(new Set());

  function toggleOpen(date) {
    setOpenDates(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {dates.map((date, idx) => {
        const sessions  = Object.values(history[date] || {});
        const isOpen    = openDates.has(date);
        const isActive  = selected === date;
        const rowMissed = sessions.filter(s => s.missed).length;
        const rowTotal  = sessions.filter(s => s.missed).reduce((a, s) => a + (s.duration || 0), 0);
        const isLast    = idx === dates.length - 1;

        return (
          <div key={date} style={{ borderBottom: isLast && !isOpen ? "none" : "1px solid var(--border)" }}>

            {/* ── Accordion header ── */}
            <div
              onClick={() => { onSelect(isActive ? null : date); toggleOpen(date); }}
              style={{
                display        : "flex",
                alignItems     : "center",
                justifyContent : "space-between",
                padding        : "11px 14px",
                cursor         : "pointer",
                background     : isActive ? "var(--accent-light)" : "transparent",
                gap            : 10,
                userSelect     : "none",
              }}
            >
              {/* Left: chevron + date */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span
                  aria-hidden="true"
                  style={{
                    display    : "inline-block",
                    width      : 14,
                    flexShrink : 0,
                    fontSize   : 10,
                    color      : "var(--ink2)",
                    transform  : isOpen ? "rotate(90deg)" : "rotate(0deg)",
                    transition : "transform 0.18s ease",
                    lineHeight : 1,
                  }}
                >
                  ▶
                </span>
                <span style={{ fontWeight: 700, fontSize: 13, fontFamily: "monospace", color: "var(--ink)", whiteSpace: "nowrap" }}>
                  {date}
                </span>
              </div>

              {/* Right: summary badges */}
              <div style={{ fontSize: 11, color: "var(--ink2)", whiteSpace: "nowrap", flexShrink: 0 }}>
                Missed:&nbsp;<b style={{ color: "var(--red)" }}>{rowMissed}</b>
                &nbsp;|&nbsp;
                <b style={{ color: "var(--red)", fontFamily: "monospace" }}>{toHHMMSS(rowTotal)}</b>
              </div>
            </div>

            {/* ── Expanded session list ── */}
            {isOpen && (
              <div style={{ background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
                {sessions.length === 0 ? (
                  <div style={{ padding: "10px 36px", fontSize: 12, color: "var(--ink2)" }}>
                    No sessions recorded.
                  </div>
                ) : sessions.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display        : "flex",
                      justifyContent : "space-between",
                      alignItems     : "center",
                      padding        : "9px 14px 9px 36px",
                      borderBottom   : i < sessions.length - 1 ? "1px solid var(--border)" : "none",
                      fontSize       : 12,
                    }}
                  >
                    {/* Session name + subject */}
                    <span style={{ color: "var(--ink)", minWidth: 0 }}>
                      {s.sessionName}
                      {s.subject && s.subject !== s.sessionName && (
                        <span style={{ color: "var(--ink2)", fontSize: 11 }}> ({s.subject})</span>
                      )}
                    </span>

                    {/* Duration or completed tick */}
                    <span style={{
                      fontFamily : "monospace",
                      fontSize   : 11,
                      fontWeight : 700,
                      color      : s.missed ? "var(--red)" : "var(--accent)",
                      flexShrink : 0,
                      marginLeft : 12,
                    }}>
                      {s.missed ? toHHMMSS(s.duration) : "✓ done"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
