import React from "react";
import { useTimer } from "../hooks/useTimer";
import useStore from "../store/useStore";

export default function LiveSession() {
  const { timerSeconds, timerRunning, activeSession, start, pause, reset, formatTime } = useTimer();
  const sessions = useStore((s) => s.sessions);

  const totalSecs  = activeSession ? (duration(activeSession.start, activeSession.end) * 60) : 0;
  const progress   = totalSecs > 0 ? Math.min((timerSeconds / totalSecs) * 100, 100) : 0;
  const remaining  = Math.max(totalSecs - timerSeconds, 0);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>

      {/* Timer Card */}
      <div style={{ background: "white", borderRadius: 16, padding: 40, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", marginBottom: 24 }}>

        {/* Session info */}
        <div style={{ fontSize: 13, color: "#6b6560", marginBottom: 6 }}>
          {activeSession ? (
            <>
              <div style={{ fontWeight: 600, fontSize: 16, color: "#1a1814", marginBottom: 4 }}>
                Session: {activeSession.name}
              </div>
              <div>
                Scheduled: {fmt12(activeSession.start)} – {fmt12(activeSession.end)}
              </div>
              <div style={{ color: timerRunning ? "#2d6a4f" : "#e67e22", marginTop: 4, fontWeight: 500 }}>
                {timerRunning ? "Running..." : "Paused"}
              </div>
            </>
          ) : (
            <div>No session active — start one from Today's Plan</div>
          )}
        </div>

        {/* Time display */}
        <div style={{ fontFamily: "monospace", fontSize: 64, fontWeight: 500, letterSpacing: -2, margin: "20px 0", color: "#1a1814" }}>
          {formatTime(timerSeconds)}
        </div>

        {/* Elapsed / Remaining */}
        {activeSession && (
          <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 16, fontSize: 14 }}>
            <div>
              <span style={{ color: "#6b6560" }}>Elapsed: </span>
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{formatTime(timerSeconds)}</span>
            </div>
            <div>
              <span style={{ color: "#6b6560" }}>Remaining: </span>
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{formatTime(remaining)}</span>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {activeSession && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ background: "#f0f0f0", borderRadius: 10, height: 8, overflow: "hidden" }}>
              <div style={{ background: "#2d6a4f", width: `${progress}%`, height: "100%", borderRadius: 10, transition: "width .5s" }} />
            </div>
            <div style={{ fontSize: 12, color: "#6b6560", marginTop: 6 }}>
              Progress: {formatTime(timerSeconds)} / {formatTime(totalSecs)} ({Math.round(progress)}%)
            </div>
          </div>
        )}

        {/* Controls */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={start}  disabled={timerRunning}  style={timerBtn("#2d6a4f", timerRunning)}>▶ Start</button>
          <button onClick={pause}  disabled={!timerRunning} style={timerBtn("#f4a261", !timerRunning)}>⏸ Pause</button>
          <button onClick={reset}  style={timerBtn("#eee", false, "#1a1814")}>↺ Reset</button>
        </div>
      </div>

      {/* Session list — quick start */}
      {sessions.length > 0 && (
        <div style={{ background: "white", borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
          <h3 style={{ fontSize: 15, marginBottom: 16, color: "#1a1814" }}>📋 Quick Start from Today's Plan</h3>
          {sessions.map(s => (
            <QuickRow key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuickRow({ session: s }) {
  const { startSession, activeSession } = useTimer();
  const isActive = activeSession?.id === s.id;

  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 14px", borderRadius: 10, marginBottom: 8,
      background: isActive ? "#eaf4ef" : "#f8f6f2",
      border: `1px solid ${isActive ? "#2d6a4f" : "#ddd9d2"}`
    }}>
      <div>
        <div style={{ fontWeight: 500, fontSize: 14 }}>{s.name}</div>
        <div style={{ fontSize: 12, color: "#6b6560" }}>{fmt12(s.start)} – {fmt12(s.end)}</div>
      </div>
      <button
        onClick={() => startSession(s)}
        style={{ background: isActive ? "#2d6a4f" : "#eaf4ef", color: isActive ? "white" : "#2d6a4f", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
      >
        {isActive ? "▶ Active" : "▶ Start"}
      </button>
    </div>
  );
}

// ── Helpers ───────────────────────────────
function duration(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}
function fmt12(t) {
  if (!t) return "—";
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}
function timerBtn(bg, disabled, color = "white") {
  return {
    background: disabled ? "#ccc" : bg,
    color: disabled ? "#999" : color,
    border: "none", borderRadius: 10,
    padding: "12px 28px", fontSize: 15,
    fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
    transition: "opacity .2s"
  };
}