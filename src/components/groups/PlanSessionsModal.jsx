import React from "react";

function fmt12(t) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
}

function diffMins(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

const PC = {
  high:   { bg: "#fde8e8", color: "#e63946" },
  medium: { bg: "#fef3c7", color: "#d97706" },
  low:    { bg: "#d1fae5", color: "#059669" },
};

export default function PlanSessionsModal({ plan, onClose, onEnroll, enrolled, enrollBusy }) {
  if (!plan) return null;
  const sessions  = Array.isArray(plan.sessions) ? plan.sessions : Object.values(plan.sessions || {});
  const totalMins = sessions.reduce((acc, s) => acc + diffMins(s.start, s.end), 0);
  const totalHrs  = (totalMins / 60).toFixed(1);

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 14, width: "min(500px,100%)", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>

        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)", marginBottom: 6 }}>{plan.name}</h3>
              <div style={{ display: "flex", gap: 14, fontSize: 13, color: "var(--ink2)" }}>
                <span>📋 {sessions.length} session{sessions.length !== 1 ? "s" : ""}</span>
                <span>⏱ {totalHrs}h total</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--ink2)", padding: "0 4px", lineHeight: 1 }}>✕</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {sessions.length === 0 && (
            <p style={{ color: "var(--ink2)", fontSize: 13, textAlign: "center", padding: 20 }}>No sessions in this plan.</p>
          )}
          {sessions.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  {["Session", "Start", "End", "Duration", "Priority"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontSize: 11, fontWeight: 700, color: "var(--ink2)", textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => {
                  const mins = diffMins(s.start, s.end);
                  const pc   = PC[s.priority] || PC.medium;
                  return (
                    <tr key={s.id || i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px", fontWeight: 600, color: "var(--ink)" }}>{s.name || "—"}</td>
                      <td style={{ padding: "8px", color: "var(--ink2)", fontFamily: "monospace", fontSize: 12 }}>{fmt12(s.start)}</td>
                      <td style={{ padding: "8px", color: "var(--ink2)", fontFamily: "monospace", fontSize: 12 }}>{fmt12(s.end)}</td>
                      <td style={{ padding: "8px", color: "var(--ink2)" }}>{mins > 0 ? `${mins}m` : "—"}</td>
                      <td style={{ padding: "8px" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "2px 6px", background: pc.bg, color: pc.color }}>
                          {s.priority || "medium"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end", flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: "none", border: "1.5px solid var(--border)", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", color: "var(--ink)" }}>✕ Close</button>
          <button onClick={onEnroll} disabled={enrolled || enrollBusy || !plan.approved}
            style={{ background: enrolled ? "#d1fae5" : !plan.approved ? "var(--border)" : "var(--accent)", color: enrolled ? "#059669" : !plan.approved ? "var(--ink2)" : "white", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: enrolled || enrollBusy || !plan.approved ? "default" : "pointer" }}>
            {enrolled ? "✅ Enrolled" : enrollBusy ? "Enrolling…" : "➕ Enroll"}
          </button>
        </div>
      </div>
    </div>
  );
}
