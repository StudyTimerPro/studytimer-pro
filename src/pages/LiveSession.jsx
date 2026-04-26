import React from "react";
import { useTimer } from "../hooks/useTimer";
import useStore from "../store/useStore";

export default function LiveSession() {
  const { timerSeconds, timerRunning, activeSession, start, pause, reset, formatTime } = useTimer();
  const sessions = useStore((s) => s.sessions);

  const totalSecs = activeSession ? duration(activeSession.start, activeSession.end) * 60 : 0;
  const progress  = totalSecs > 0 ? Math.min((timerSeconds / totalSecs) * 100, 100) : 0;
  const remaining = Math.max(totalSecs - timerSeconds, 0);

  const statusKey = !activeSession ? "idle" : timerRunning ? "running" : "paused";
  const statusLbl = !activeSession ? "Idle" : timerRunning ? "Running" : "Paused";

  return (
    <div className="stp-content">
      <section className="stp-hero">
        <div>
          <h1>Live <em>session</em></h1>
          <div className="stp-hero-sub">
            {activeSession
              ? <>Tracking <b>{activeSession.name}</b> · {fmt12(activeSession.start)} – {fmt12(activeSession.end)}</>
              : <>No session active. Pick one below or start one from Today's Plan.</>}
          </div>
        </div>
        <div className="stp-stats">
          <Stat label="Elapsed"   value={formatTime(timerSeconds)} />
          <Stat label="Remaining" value={activeSession ? formatTime(remaining) : "—"} />
          <Stat label="Progress"  value={activeSession ? Math.round(progress) : "—"} unit={activeSession ? "%" : null} />
        </div>
      </section>

      <div className="stp-live-stage">
        <div className="stp-live-head">
          <span className={`stp-live-status ${statusKey}`}>
            <span className="pulse" />
            {statusLbl}
          </span>
          {activeSession && (
            <span className="stp-live-status idle" title="Scheduled window">
              {fmt12(activeSession.start)} – {fmt12(activeSession.end)}
            </span>
          )}
        </div>

        <div className="stp-live-ring-wrap">
          <ProgressRing percent={progress} paused={!timerRunning && !!activeSession} />
          <div className="stp-live-ring-center">
            <div className="stp-live-time">{formatTime(timerSeconds)}</div>
            <div className="stp-live-pct">{activeSession ? `${Math.round(progress)}% complete` : "Ready"}</div>
          </div>
        </div>

        <h2 className="stp-live-name">{activeSession ? activeSession.name : "No session selected"}</h2>
        <div className="stp-live-sub">
          {activeSession
            ? `${formatTime(timerSeconds)} of ${formatTime(totalSecs)}`
            : "Start one from Today's Plan or below"}
        </div>

        <div className="stp-live-stats">
          <div className="cell">
            <div className="l">Elapsed</div>
            <div className="v">{formatTime(timerSeconds)}</div>
          </div>
          <div className="cell">
            <div className="l">Remaining</div>
            <div className="v">{activeSession ? formatTime(remaining) : "—"}</div>
          </div>
          <div className="cell">
            <div className="l">Total</div>
            <div className="v">{activeSession ? formatTime(totalSecs) : "—"}</div>
          </div>
        </div>

        <div className="stp-live-controls">
          <button className="stp-live-ctrl start" onClick={start} disabled={timerRunning || !activeSession}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            Start
          </button>
          <button className="stp-live-ctrl pause" onClick={pause} disabled={!timerRunning}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
            Pause
          </button>
          <button className="stp-live-ctrl reset" onClick={reset} disabled={!activeSession}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>
            </svg>
            Reset
          </button>
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="stp-live-quick">
          <h3>Quick <em>start</em></h3>
          {sessions.map(s => <QuickRow key={s.id} session={s} />)}
        </div>
      )}
    </div>
  );
}

function ProgressRing({ percent, paused }) {
  const R = 130, C = 2 * Math.PI * R;
  const offset = C - (Math.max(0, Math.min(100, percent)) / 100) * C;
  return (
    <svg className={`stp-live-ring${paused ? " paused" : ""}`} viewBox="0 0 300 300">
      <circle className="track" cx="150" cy="150" r={R} fill="none" strokeWidth="14" />
      <circle
        className="fill" cx="150" cy="150" r={R} fill="none" strokeWidth="14"
        strokeDasharray={C} strokeDashoffset={offset}
        transform="rotate(-90 150 150)"
      />
    </svg>
  );
}

function QuickRow({ session: s }) {
  const { startSession, activeSession, timerRunning } = useTimer();
  const isActive = activeSession?.id === s.id;
  const isLive   = isActive && timerRunning;

  return (
    <div className={`stp-quick-row${isActive ? " active" : ""}`}>
      <div className="info">
        <div className="name">{s.name}</div>
        <div className="meta">{fmt12(s.start)} – {fmt12(s.end)}</div>
      </div>
      <button className={`stp-live-ctrl ${isLive ? "pause" : "start"}`} onClick={() => startSession(s)}>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        {isLive ? "Active" : "Start"}
      </button>
    </div>
  );
}

function Stat({ label, value, unit }) {
  return (
    <div className="stp-stat">
      <div className="l">{label}</div>
      <div className="v">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  );
}

function duration(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max((eh * 60 + em) - (sh * 60 + sm), 0);
}
function fmt12(t) {
  if (!t) return "—";
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}
