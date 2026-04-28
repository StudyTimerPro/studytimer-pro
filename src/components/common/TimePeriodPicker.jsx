import React, { useMemo, useState } from "react";

const HOURS_12 = Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i));
const MINUTES = ["00", "15", "30", "45"];

function to24h(h, m, ap) {
  let hh = parseInt(h, 10);
  if (ap === "AM") hh = hh === 12 ? 0 : hh;
  else hh = hh === 12 ? 12 : hh + 12;
  return `${String(hh).padStart(2, "0")}:${m}`;
}

function fromTimingString(t) {
  if (!t || !t.includes("-")) return null;
  const [a, b] = t.split("-").map(s => s.trim());
  const parse = s => {
    const [h, m] = s.split(":").map(x => parseInt(x, 10));
    const hh12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ap = h < 12 ? "AM" : "PM";
    return { h: String(hh12), m: String(m).padStart(2, "0"), ap };
  };
  try { return { start: parse(a), end: parse(b) }; } catch { return null; }
}

function diffHours(start24, end24) {
  const [sh, sm] = start24.split(":").map(Number);
  const [eh, em] = end24.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 10) / 10;
}

const PRESETS = [
  { label: "Early Morning", timing: "04:00-08:00" },
  { label: "Morning",       timing: "06:00-10:00" },
  { label: "Late Morning",  timing: "09:00-12:00" },
  { label: "Afternoon",     timing: "14:00-18:00" },
  { label: "Evening",       timing: "18:00-22:00" },
  { label: "Night",         timing: "20:00-23:00" },
];

export default function TimePeriodPicker({ value, onChange, onClose, embed = false }) {
  const initial = fromTimingString(value) || {
    start: { h: "6",  m: "00", ap: "AM" },
    end:   { h: "10", m: "00", ap: "AM" },
  };
  const [start, setStart] = useState(initial.start);
  const [end,   setEnd]   = useState(initial.end);

  const start24 = useMemo(() => to24h(start.h, start.m, start.ap), [start]);
  const end24   = useMemo(() => to24h(end.h,   end.m,   end.ap),   [end]);
  const hours   = useMemo(() => diffHours(start24, end24), [start24, end24]);

  function applyPreset(p) {
    const v = fromTimingString(p.timing);
    if (v) { setStart(v.start); setEnd(v.end); }
  }

  function confirm() {
    const timing = `${start24}-${end24}`;
    onChange?.({ timing, hours: String(hours), label: pretty(start, end) });
    onClose?.();
  }

  const inner = (
    <div style={S.card}>
      <div style={S.title}>⏰ Pick your study window</div>

      <div style={S.row}>
        <Block label="From">
          <Spinner v={start} setV={setStart} />
        </Block>
        <div style={S.dashWrap}><span style={S.dash}>→</span></div>
        <Block label="To">
          <Spinner v={end} setV={setEnd} />
        </Block>
      </div>

      <div style={S.summaryBox}>
        <div style={S.summary}>
          {pretty(start, end)}
        </div>
        <div style={S.duration}>{hours} hour{hours === 1 ? "" : "s"}</div>
      </div>

      <div style={S.presetTitle}>Quick presets</div>
      <div style={S.presets}>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => applyPreset(p)} style={S.presetBtn}>
            {p.label}
          </button>
        ))}
      </div>

      <div style={S.actions}>
        {!embed && <button onClick={onClose} style={S.cancelBtn}>Cancel</button>}
        <button onClick={confirm} style={S.okBtn}>✓ Use this time</button>
      </div>
    </div>
  );

  if (embed) return inner;

  return (
    <div style={S.scrim} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420 }}>
        {inner}
      </div>
    </div>
  );
}

function pretty(s, e) {
  const fmt = x => `${parseInt(x.h, 10)}${x.m === "00" ? "" : ":" + x.m} ${x.ap}`;
  return `${fmt(s)} → ${fmt(e)}`;
}

function Block({ label, children }) {
  return (
    <div style={S.block}>
      <div style={S.blockLabel}>{label}</div>
      {children}
    </div>
  );
}

function Spinner({ v, setV }) {
  return (
    <div style={S.spin}>
      <select value={v.h} onChange={e => setV({ ...v, h: e.target.value })} style={S.sel}>
        {HOURS_12.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span style={S.colon}>:</span>
      <select value={v.m} onChange={e => setV({ ...v, m: e.target.value })} style={S.sel}>
        {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <div style={S.ampm}>
        {["AM", "PM"].map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setV({ ...v, ap: p })}
            style={{ ...S.ampmBtn, ...(v.ap === p ? S.ampmBtnOn : {}) }}
          >{p}</button>
        ))}
      </div>
    </div>
  );
}

const S = {
  scrim:    { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  card:     { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: "20px 18px", boxShadow: "0 30px 80px rgba(0,0,0,0.35)" },
  title:    { fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 16, textAlign: "center" },
  row:      { display: "flex", alignItems: "stretch", gap: 8, marginBottom: 14 },
  block:    { flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 8px" },
  blockLabel:{ fontSize: 11, fontWeight: 700, color: "var(--ink2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, textAlign: "center" },
  spin:     { display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexWrap: "wrap" },
  sel:      { padding: "6px 4px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 16, fontWeight: 700, background: "var(--surface)", color: "var(--ink)", fontFamily: "JetBrains Mono, monospace", textAlign: "center", minWidth: 48 },
  colon:    { fontWeight: 700, color: "var(--ink)" },
  ampm:     { display: "flex", marginLeft: 4, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" },
  ampmBtn:  { padding: "6px 8px", fontSize: 11, fontWeight: 700, background: "var(--surface)", color: "var(--ink2)", border: "none", cursor: "pointer" },
  ampmBtnOn:{ background: "var(--accent)", color: "white" },
  dashWrap: { display: "flex", alignItems: "center" },
  dash:     { fontSize: 18, color: "var(--ink2)", padding: "0 4px" },
  summaryBox:{ background: "var(--bg)", borderRadius: 10, padding: "10px 12px", textAlign: "center", marginBottom: 14, border: "1px dashed var(--border)" },
  summary:  { fontSize: 14, fontWeight: 700, color: "var(--accent)", marginBottom: 2 },
  duration: { fontSize: 12, color: "var(--ink2)" },
  presetTitle:{ fontSize: 11, fontWeight: 700, color: "var(--ink2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  presets:  { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 16 },
  presetBtn:{ padding: "8px 6px", fontSize: 11, fontWeight: 600, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", color: "var(--ink)" },
  actions:  { display: "flex", gap: 8 },
  cancelBtn:{ flex: 1, padding: "10px 14px", fontSize: 13, fontWeight: 600, background: "transparent", border: "1.5px solid var(--border)", borderRadius: 10, cursor: "pointer", color: "var(--ink2)" },
  okBtn:    { flex: 2, padding: "10px 14px", fontSize: 13, fontWeight: 700, background: "var(--accent)", border: "none", borderRadius: 10, cursor: "pointer", color: "white" },
};
