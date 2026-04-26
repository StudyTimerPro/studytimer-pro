import React from "react";
import { useTimer } from "../hooks/useTimer";
import useStore from "../store/useStore";

export default function LiveSession() {
  const { timerSeconds, timerRunning, activeSession, start, pause, formatTime } = useTimer();
  const sessions      = useStore((s) => s.sessions);
  const sessionStudied = useStore((s) => s.sessionStudied);

  const totalSecs = activeSession ? duration(activeSession.start, activeSession.end) * 60 : 0;
  const savedForActive = activeSession ? Number(sessionStudied[activeSession.id] || 0) : 0;
  const studiedSecs = savedForActive + (activeSession ? timerSeconds : 0);
  const progress    = totalSecs > 0 ? Math.min((studiedSecs / totalSecs) * 100, 100) : 0;
  const remaining   = Math.max(totalSecs - studiedSecs, 0);
  const completed   = !!activeSession && totalSecs > 0 && studiedSecs >= totalSecs;

  const statusKey = !activeSession ? "idle" : completed ? "idle" : timerRunning ? "running" : "paused";
  const statusLbl = !activeSession ? "Idle" : completed ? "Completed" : timerRunning ? "Running" : "Paused";

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
            <div className="stp-live-time">{formatTime(studiedSecs)}</div>
            <div className="stp-live-pct">{activeSession ? `${Math.round(progress)}% complete` : "Ready"}</div>
          </div>
        </div>

        <h2 className="stp-live-name">{activeSession ? activeSession.name : "No session selected"}</h2>
        <div className="stp-live-sub">
          {activeSession
            ? `${formatTime(studiedSecs)} of ${formatTime(totalSecs)}`
            : "Start one from Today's Plan or below"}
        </div>

        <div className="stp-live-stats">
          <div className="cell">
            <div className="l">Studied</div>
            <div className="v">{formatTime(studiedSecs)}</div>
          </div>
          <div className="cell">
            <div className="l">Remaining</div>
            <div className="v">{activeSession ? formatTime(remaining) : "—"}</div>
          </div>
        </div>

        <div className="stp-live-controls">
          {completed ? (
            <button className="stp-live-mainbtn done" disabled>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              Session Complete
            </button>
          ) : timerRunning ? (
            <button className="stp-live-mainbtn pause" onClick={pause}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
              Pause Session
            </button>
          ) : (
            <button className="stp-live-mainbtn start" onClick={start} disabled={!activeSession}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              {studiedSecs > 0 ? "Resume Session" : "Start Session"}
            </button>
          )}
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="stp-live-quick">
          <h3>Quick <em>start</em></h3>
          {sessions.map(s => (
            <QuickRow
              key={s.id}
              session={s}
              activeId={activeSession?.id}
              activeRunning={timerRunning}
              activeTimerSecs={timerSeconds}
              savedSecs={Number(sessionStudied[s.id] || 0)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressRing({ percent, paused }) {
  const R = 130, C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, percent));
  const offset = C - (pct / 100) * C;
  const filledLen = (pct / 100) * C;
  const shineSeg  = 18; // length of the moving glow segment
  // Tip dot location: percent → angle around the ring
  const angle = (pct / 100) * 2 * Math.PI - Math.PI / 2;
  const tipX = 150 + R * Math.cos(angle);
  const tipY = 150 + R * Math.sin(angle);
  return (
    <svg className={`stp-live-ring${paused ? " paused" : ""}`} viewBox="0 0 300 300">
      <circle className="track" cx="150" cy="150" r={R} fill="none" strokeWidth="14" />
      <circle
        className="fill" cx="150" cy="150" r={R} fill="none" strokeWidth="14"
        strokeDasharray={C} strokeDashoffset={offset}
        transform="rotate(-90 150 150)"
      />
      {pct > 0 && (
        <circle
          className="shine" cx="150" cy="150" r={R} strokeWidth="14"
          strokeDasharray={`${shineSeg} ${C}`}
          transform="rotate(-90 150 150)"
          style={{ "--shine-end": `${-Math.max(filledLen - shineSeg, 0)}px` }}
        />
      )}
      {pct > 0 && pct < 100 && (
        <circle className="tip" cx={tipX} cy={tipY} r="9" />
      )}
    </svg>
  );
}

function QuickRow({ session: s, activeId, activeRunning, activeTimerSecs, savedSecs }) {
  const { startSession } = useTimer();
  const isActive   = activeId === s.id;
  const isLive     = isActive && activeRunning;             // light orange ONLY while running
  const liveExtra  = isActive ? activeTimerSecs : 0;
  const studiedSec = savedSecs + liveExtra;
  const sessSec    = duration(s.start, s.end) * 60;
  const pct        = sessSec > 0 ? Math.min(100, Math.round((studiedSec / sessSec) * 100)) : 0;
  const isDone     = sessSec > 0 && studiedSec >= sessSec;

  const cls = `stp-quick-row${isLive ? " active" : ""}${isDone ? " done" : ""}`;

  return (
    <div className={cls}>
      <div className="info">
        <div className="name">{s.name}</div>
        <div className="meta">{fmt12(s.start)} – {fmt12(s.end)} · {formatHM(studiedSec)} / {formatHM(sessSec)}</div>
        <div className="stp-quick-progress"><div className="fill" style={{ width: `${pct}%` }} /></div>
        <div className="pct">{pct}% studied</div>
      </div>
      {isDone ? (
        <button className="stp-live-ctrl done" disabled>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          Done
        </button>
      ) : (
        <button className={`stp-live-ctrl ${isLive ? "pause" : "start"}`} onClick={() => startSession(s)}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          {isLive ? "Active" : "Start"}
        </button>
      )}
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
  if (!start || !end) return 0;
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
function formatHM(secs) {
  const total = Math.max(0, Math.floor(secs));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
