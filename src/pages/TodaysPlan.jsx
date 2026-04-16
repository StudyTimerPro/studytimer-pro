import React, { useEffect, useState } from "react";
import useStore from "../store/useStore";
import { useAuth } from "../hooks/useAuth";
import { useTimer } from "../hooks/useTimer";
import { listenPlans, savePlan, updatePlan, deletePlan } from "../firebase/db";
import AIPlanModal from "../components/plan/AIPlanModal";

export default function TodaysPlan() {
  const { user } = useAuth();
  const { startSession } = useTimer();
  const { sessions, setSessions, showToast } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId]  = useState(null);
  const [form, setForm] = useState(defaultForm());
  const [showAI, setShowAI] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = listenPlans(user.uid, setSessions);
    return () => unsub();
  }, [user]);

  function defaultForm() {
    return { name: "", subject: "", priority: "medium", material: "", start: "06:00", end: "06:30", breakMins: 10 };
  }

  function openAdd() { setForm(defaultForm()); setEditingId(null); setModalOpen(true); }
  function openEdit(s) {
    setForm({ name: s.name, subject: s.subject || "", priority: s.priority, material: s.material || "", start: s.start, end: s.end, breakMins: s.breakMins || 0 });
    setEditingId(s.id); setModalOpen(true);
  }

  async function handleSave() {
    if (!user)             { showToast("Please sign in first"); return; }
    if (!form.name.trim()) { showToast("Session name required"); return; }
    if (form.start >= form.end) { showToast("End time must be after start"); return; }
    const data = { ...form, createdAt: Date.now() };
    if (editingId) { await updatePlan(user.uid, editingId, data); showToast("Session updated ✓"); }
    else           { await savePlan(user.uid, data);              showToast("Session added ✓"); }
    setModalOpen(false);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this session?")) return;
    await deletePlan(user.uid, id); showToast("Deleted");
  }

  const totalMins = sessions.reduce((acc, s) => acc + duration(s.start, s.end), 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <Chip label="Sessions" value={sessions.length} />
          <Chip label="Total"    value={minsToHM(totalMins)} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowAI(true)} style={btnStyle("#7c3aed")}>✨ AI Plan</button>
          <button onClick={openAdd} style={btnStyle("var(--accent)")}>＋ Add Session</button>
        </div>
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead style={{ background: "var(--nav-bg)", color: "white" }}>
              <tr>
                {["Session","Priority","Start","End","Duration","Break After","Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 48, color: "var(--ink2)" }}>
                  <div style={{ fontSize: 40 }}>📋</div>
                  <p style={{ marginTop: 12 }}>No sessions yet. Add your first study session!</p>
                </td></tr>
              ) : sessions.map(s => (
                <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 500, color: "var(--ink)" }}>{s.name}</div>
                    {s.subject && <div style={{ fontSize: 11, color: "var(--ink2)", marginTop: 2 }}>{s.subject}</div>}
                  </td>
                  <td style={{ padding: "12px 14px" }}><Badge p={s.priority} /></td>
                  <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 13, color: "var(--ink)" }}>{fmt12(s.start)}</td>
                  <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 13, color: "var(--ink)" }}>{fmt12(s.end)}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 12, background: "var(--bg)", color: "var(--ink)", borderRadius: 6, padding: "3px 8px" }}>
                      {minsToHM(duration(s.start, s.end))}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, fontFamily: "monospace", color: "var(--ink)" }}>
                    {s.breakMins > 0 ? `${fmt12(s.end)} – ${fmt12(addMins(s.end, s.breakMins))}` : <span style={{ color: "var(--ink2)" }}>No break</span>}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => startSession(s)}    style={iconBtn("var(--accent)", "white")}>▶</button>
                      <button onClick={() => openEdit(s)}        style={iconBtn("#eaf0fb", "#2563eb")}>✏</button>
                      <button onClick={() => handleDelete(s.id)} style={iconBtn("#fde8e8", "#e63946")}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAI && user && (
        <AIPlanModal
          user={user}
          onClose={() => setShowAI(false)}
          onCreated={n => {
            showToast(`Plan created! ${n} session${n !== 1 ? "s" : ""} added`);
            setShowAI(false);
          }}
        />
      )}

      {modalOpen && (
        <div onClick={e => e.target === e.currentTarget && setModalOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: 28, width: "min(480px, 94vw)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontSize: 18, marginBottom: 20, color: "var(--ink)" }}>{editingId ? "Edit Session" : "Add Study Session"}</h3>

            <Field label="Session Name">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Calculus: limits" style={inputStyle} />
            </Field>
            <Field label="Subject / Exam">
              <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Engineering Mathematics" style={inputStyle} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Priority">
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={inputStyle}>
                  <option value="high">🔴 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🟢 Low</option>
                </select>
              </Field>
              <Field label="Study Material">
                <input value={form.material} onChange={e => setForm({ ...form, material: e.target.value })} placeholder="e.g. Chapter 3" style={inputStyle} />
              </Field>
              <Field label="Start Time">
                <input type="time" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="End Time">
                <input type="time" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} style={inputStyle} />
              </Field>
            </div>

            <Field label="Break After (minutes)">
              <input type="number" min="0" max="60" value={form.breakMins} onChange={e => setForm({ ...form, breakMins: parseInt(e.target.value) || 0 })} style={inputStyle} />
            </Field>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "1.5px solid var(--border)", borderRadius: 8, padding: "9px 20px", fontSize: 14, cursor: "pointer", color: "var(--ink)" }}>Cancel</button>
              <button onClick={handleSave} style={btnStyle("var(--accent)")}>Save Session</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function duration(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}
function minsToHM(m) {
  const h = Math.floor(m / 60), min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}
function fmt12(t) {
  if (!t) return "—";
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}
function addMins(t, mins) {
  let [h, m] = t.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2,"0")}:${String(total % 60).padStart(2,"0")}`;
}

function Chip({ label, value }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontFamily: "monospace", color: "var(--ink)" }}>
      {label}: <span style={{ fontWeight: 700, color: "var(--accent)" }}>{value}</span>
    </div>
  );
}

function Badge({ p }) {
  const map = { high: ["#fde8e8","#c0392b"], medium: ["#fff3e0","#e67e22"], low: ["#e8f5e9","#27ae60"] };
  const [bg, color] = map[p] || map.medium;
  return <span style={{ background: bg, color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>{p}</span>;
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink2)", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = { width: "100%", padding: "9px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit" };
function btnStyle(bg) { return { background: bg, color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 500, cursor: "pointer" }; }
function iconBtn(bg, color) { return { background: bg, color, border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 13, cursor: "pointer" }; }
