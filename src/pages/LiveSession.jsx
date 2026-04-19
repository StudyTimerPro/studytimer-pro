import React from "react";
import { useTimer } from "../hooks/useTimer";
import useStore from "../store/useStore";

export default function LiveSession() {
  const { timerSeconds, timerRunning, activeSession, start, pause, reset, formatTime } = useTimer();
  const sessions = useStore((s) => s.sessions);

  const totalSecs = activeSession ? (duration(activeSession.start, activeSession.end) * 60) : 0;
  const progress  = totalSecs > 0 ? Math.min((timerSeconds / totalSecs) * 100, 100) : 0;
  const remaining = Math.max(totalSecs - timerSeconds, 0);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px" }}><div style={{ maxWidth: 600, margin: "0 auto" }}>

      {/* Timer Card */}
      <div style={{ background: "var(--surface)", borderRadius: 16, padding: 40, textAlign: "center", boxShadow: "var(--shadow)", marginBottom: 24 }}>

        <div style={{ fontSize: 13, color: "var(--ink2)", marginBottom: 6 }}>
          {activeSession ? (
            <>
              <div style={{ fontWeight: 600, fontSize: 16, color: "var(--ink)", marginBottom: 4 }}>
                Session: {activeSession.name}
              </div>
              <div>Scheduled: {fmt12(activeSession.start)} – {fmt12(activeSession.end)}</div>
              <div style={{ color: timerRunning ? "var(--accent)" : "#e67e22", marginTop: 4, fontWeight: 500 }}>
                {timerRunning ? "Running..." : "Paused"}
              </div>
            </>
          ) : (
            <div>No session active — start one from Today's Plan</div>
          )}
        </div>

        <div style={{ fontFamily: "monospace", fontSize: 64, fontWeight: 500, letterSpacing: -2, margin: "20px 0", color: "var(--ink)" }}>
          {formatTime(timerSeconds)}
        </div>

        {activeSession && (
          <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 16, fontSize: 14 }}>
            <div>
              <span style={{ color: "var(--ink2)" }}>Elapsed: </span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--ink)" }}>{formatTime(timerSeconds)}</span>
            </div>
            <div>
              <span style={{ color: "var(--ink2)" }}>Remaining: </span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--ink)" }}>{formatTime(remaining)}</span>
            </div>
          </div>
        )}

        {activeSession && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ background: "var(--track)", borderRadius: 10, height: 8, overflow: "hidden" }}>
              <div style={{ background: "var(--accent)", width: `${progress}%`, height: "100%", borderRadius: 10, transition: "width .5s" }} />
            </div>
            <div style={{ fontSize: 12, color: "var(--ink2)", marginTop: 6 }}>
              Progress: {formatTime(timerSeconds)} / {formatTime(totalSecs)} ({Math.round(progress)}%)
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={start}  disabled={timerRunning}  style={timerBtn("var(--accent)", timerRunning)}>▶ Start</button>
          <button onClick={pause}  disabled={!timerRunning} style={timerBtn("#f4a261", !timerRunning)}>⏸ Pause</button>
          <button onClick={reset}  style={timerBtn("var(--border)", false, "var(--ink)")}>↺ Reset</button>
        </div>
      </div>

      {sessions.length > 0 && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "var(--shadow)" }}>
          <h3 style={{ fontSize: 15, marginBottom: 16, color: "var(--ink)" }}>📋 Quick Start from Today's Plan</h3>
          {sessions.map(s => <QuickRow key={s.id} session={s} />)}
        </div>
      )}
    </div></div>
  );
}

function QuickRow({ session: s }) {
  const { startSession, activeSession } = useTimer();
  const isActive = activeSession?.id === s.id;

  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 14px", borderRadius: 10, marginBottom: 8,
      background: isActive ? "var(--accent-light)" : "var(--bg)",
      border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
    }}>
      <div>
        <div style={{ fontWeight: 500, fontSize: 14, color: "var(--ink)" }}>{s.name}</div>
        <div style={{ fontSize: 12, color: "var(--ink2)" }}>{fmt12(s.start)} – {fmt12(s.end)}</div>
      </div>
      <button
        onClick={() => startSession(s)}
        style={{ background: isActive ? "var(--accent)" : "var(--accent-light)", color: isActive ? "white" : "var(--accent)", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
      >
        {isActive ? "▶ Active" : "▶ Start"}
      </button>
    </div>
  );
}

function duration(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}
function fmt12(t) {
  if (!t) return "—";
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}
function timerBtn(bg, disabled, color = "white") {
  return {
    background: disabled ? "var(--border)" : bg,
    color: disabled ? "var(--ink2)" : color,
    border: "none", borderRadius: 10,
    padding: "12px 28px", fontSize: 15,
    fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
    transition: "opacity .2s",
  };
}
