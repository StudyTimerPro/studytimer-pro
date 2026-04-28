import React, { useMemo } from "react";
import { LEVEL_INTERVALS } from "../../utils/revisionScheduler";

/**
 * ForgettingCurveGraph — Ebbinghaus visualization.
 *
 * For each revision item, simulates the retention curve from creation through
 * today + 30 days. Each successful revision in history resets retention to 100%
 * and increases stability (the per-level interval). Between events retention
 * decays as R(t) = 100 * exp(-Δd / S).
 *
 * Renders an aggregate (average) curve plus thin per-item traces.
 *
 * Props:
 *   items — { slug: itemRecord }
 *   height (default 180)
 */
export default function ForgettingCurveGraph({ items, height = 180 }) {
  const { aggregate, traces, today, daysBack, daysForward } = useMemo(
    () => computeCurves(items),
    [items]
  );

  if (!aggregate.length) {
    return (
      <div className="stp-fc-empty">
        Complete a topic to start tracking your forgetting curve.
      </div>
    );
  }

  const total = daysBack + daysForward + 1;
  const W = 600;
  const H = height;
  const padX = 28;
  const padY = 16;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const xAt = (i) => padX + (i / Math.max(1, total - 1)) * innerW;
  const yAt = (v) => padY + innerH * (1 - Math.max(0, Math.min(100, v)) / 100);

  const aggPath = polylinePath(aggregate, xAt, yAt);
  const todayX  = xAt(daysBack);

  // Y-axis ticks at 0, 50, 100
  const yTicks = [0, 50, 100];

  return (
    <div className="stp-fc-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="stp-fc-svg"
        role="img"
        aria-label="Forgetting curve"
      >
        {/* Y-axis grid lines */}
        {yTicks.map(t => (
          <g key={t}>
            <line
              x1={padX} x2={W - padX} y1={yAt(t)} y2={yAt(t)}
              stroke="var(--border)" strokeDasharray="2 4" strokeWidth="1"
            />
            <text x={6} y={yAt(t) + 4} fontSize="10" fill="var(--ink3)">{t}%</text>
          </g>
        ))}

        {/* Today marker */}
        <line
          x1={todayX} x2={todayX} y1={padY} y2={H - padY}
          stroke="var(--accent)" strokeDasharray="3 3" strokeWidth="1.5"
        />
        <text
          x={todayX} y={padY - 4}
          fontSize="10" fill="var(--accent)"
          fontWeight="600" textAnchor="middle"
        >today</text>

        {/* Per-item thin traces */}
        {traces.slice(0, 8).map((trace, idx) => (
          <path
            key={idx}
            d={polylinePath(trace, xAt, yAt)}
            fill="none"
            stroke="var(--accent)"
            strokeOpacity="0.18"
            strokeWidth="1"
          />
        ))}

        {/* Aggregate curve */}
        <path
          d={aggPath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* X labels */}
        <text x={padX} y={H - 2} fontSize="10" fill="var(--ink3)">−{daysBack}d</text>
        <text x={W - padX} y={H - 2} fontSize="10" fill="var(--ink3)" textAnchor="end">+{daysForward}d</text>
      </svg>

      <div className="stp-fc-legend">
        <span><span className="dot agg" /> Average retention</span>
        <span><span className="dot trace" /> Per-topic curves</span>
        <span><span className="dot now" /> Today</span>
      </div>
    </div>
  );
}

function polylinePath(values, xAt, yAt) {
  if (!values.length) return "";
  let d = `M ${xAt(0).toFixed(2)} ${yAt(values[0]).toFixed(2)}`;
  for (let i = 1; i < values.length; i++) {
    d += ` L ${xAt(i).toFixed(2)} ${yAt(values[i]).toFixed(2)}`;
  }
  return d;
}

/**
 * Build per-item retention traces and the aggregate curve.
 * Window: 30 days back of today → 30 days forward.
 * Retention model:
 *   - 100% on createdAt
 *   - For each event (revision attempt), if correct, snap to 100% and bump stability
 *     to LEVEL_INTERVALS[level]; if wrong, snap retention to 60% (partial recall).
 *   - Between events retention decays exp(-Δdays / stability).
 */
function computeCurves(items) {
  const list = Object.values(items || {}).filter(Boolean);
  const today = todayMidnightTs();
  const daysBack = 30;
  const daysForward = 30;
  const totalDays = daysBack + daysForward + 1;

  const traces = [];
  for (const it of list) {
    const created = Number(it.createdAt) || today;
    const events = [];
    events.push({ ts: created, kind: "learn" });
    (Array.isArray(it.history) ? it.history : []).forEach(h => {
      events.push({ ts: Number(h.ts) || created, kind: "rev", correct: !!h.correct, level: h.level });
    });
    events.sort((a, b) => a.ts - b.ts);

    // Walk day by day across the window, keeping a running stability + lastEventTs.
    const trace = new Array(totalDays).fill(null);
    let stability = LEVEL_INTERVALS[0];
    let lastTs = events[0]?.ts || created;
    let retentionAtLast = 100;

    for (let i = 0; i < totalDays; i++) {
      const dayTs = today + (i - daysBack) * 86400000;
      // Apply all events that happened on or before this day, in order.
      while (events.length && events[0].ts <= dayTs) {
        const ev = events.shift();
        if (ev.kind === "learn") {
          retentionAtLast = 100;
          stability = LEVEL_INTERVALS[0];
        } else if (ev.correct) {
          retentionAtLast = 100;
          const lvl = Math.max(0, Math.min(5, Number(ev.level) || 0));
          stability = LEVEL_INTERVALS[lvl];
        } else {
          retentionAtLast = 60; // partial recall after a wrong attempt
          stability = LEVEL_INTERVALS[0];
        }
        lastTs = ev.ts;
      }
      // Topics created in the future (created > dayTs) → leave null.
      if (dayTs < created) {
        trace[i] = null;
        continue;
      }
      const deltaDays = Math.max(0, (dayTs - lastTs) / 86400000);
      const r = retentionAtLast * Math.exp(-deltaDays / Math.max(0.5, stability));
      trace[i] = r;
    }
    traces.push(trace);
  }

  // Aggregate: average across non-null values per day.
  const aggregate = new Array(totalDays).fill(0);
  const counts = new Array(totalDays).fill(0);
  traces.forEach(tr => {
    tr.forEach((v, i) => {
      if (v == null) return;
      aggregate[i] += v;
      counts[i] += 1;
    });
  });
  for (let i = 0; i < totalDays; i++) {
    aggregate[i] = counts[i] ? aggregate[i] / counts[i] : null;
  }
  // Replace leading nulls with the first known value so the line renders cleanly.
  let firstVal = aggregate.find(v => v != null);
  if (firstVal == null) firstVal = 0;
  for (let i = 0; i < totalDays; i++) if (aggregate[i] == null) aggregate[i] = firstVal;

  return { aggregate, traces, today, daysBack, daysForward };
}

function todayMidnightTs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
