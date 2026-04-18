import React, { useEffect, useState } from "react";
import useStore from "../store/useStore";
import { useAuth } from "../hooks/useAuth";
import { useTimer } from "../hooks/useTimer";
import {
  getExams, getPlans, listenPlanSessions,
  savePlanSession, updatePlanSession, deletePlanSession,
  exportPlan, importPlan,
} from "../firebase/db";
import AIPlanModal from "../components/plan/AIPlanModal";
import AddExamModal from "../components/plan/AddExamModal";
import ExamPlanSelector from "../components/plan/ExamPlanSelector";
import { LoadingOverlay } from "../components/common/LoadingAnimation";

export default function TodaysPlan() {
  const { user } = useAuth();
  const { startSession } = useTimer();
  const {
    sessions, setSessions, showToast,
    exams, setExams, currentExamId, setCurrentExamId, setCurrentExamName,
    plans, setPlans, currentPlanId, setCurrentPlanId, setCurrentPlanName,
  } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(defaultForm());
  const [showAI, setShowAI] = useState(false);
  const [showAddExam, setShowAddExam] = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);

  // Initial load: fetch exams, default to first exam + first plan
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoadingInit(true);
      const e = await getExams(user.uid);
      setExams(e);
      if (e.length && !currentExamId) {
        setCurrentExamId(e[0].id);
        setCurrentExamName(e[0].name);
      }
      setLoadingInit(false);
    })();
  }, [user]);

  // When current exam changes, reload its plans
  useEffect(() => {
    if (!user || !currentExamId) { setPlans([]); setCurrentPlanId(null); setCurrentPlanName(""); return; }
    (async () => {
      const p = await getPlans(user.uid, currentExamId);
      setPlans(p);
      if (p.length && (!currentPlanId || !p.find(pp => pp.id === currentPlanId))) {
        setCurrentPlanId(p[0].id); setCurrentPlanName(p[0].name);
      } else if (!p.length) {
        setCurrentPlanId(null); setCurrentPlanName("");
      }
    })();
  }, [user, currentExamId]);

  // Listen to sessions of current plan
  useEffect(() => {
    if (!user || !currentExamId || !currentPlanId) { setSessions([]); return; }
    const unsub = listenPlanSessions(user.uid, currentExamId, currentPlanId, setSessions);
    return () => unsub();
  }, [user, currentExamId, currentPlanId]);

  function defaultForm() {
    return { name: "", subject: "", priority: "medium", material: "", start: "06:00", end: "06:30", breakMins: 10 };
  }

  function openAdd() { setForm(defaultForm()); setEditingId(null); setModalOpen(true); }
  function openEdit(s) {
    setForm({ name: s.name, subject: s.subject || "", priority: s.priority, material: s.material || "", start: s.start, end: s.end, breakMins: s.breakMins || 0 });
    setEditingId(s.id); setModalOpen(true);
  }

  async function handleSave() {
    if (!user)                   { showToast("Please sign in first"); return; }
    if (!currentExamId)          { showToast("Add an exam first"); return; }
    if (!currentPlanId)          { showToast("Create or select a plan first"); return; }
    if (!form.name.trim())       { showToast("Session name required"); return; }
    if (form.start >= form.end)  { showToast("End time must be after start"); return; }
    const data = { ...form, createdAt: Date.now() };
    if (editingId) { await updatePlanSession(user.uid, currentExamId, currentPlanId, editingId, data); showToast("Session updated ✓"); }
    else           { await savePlanSession(user.uid, currentExamId, currentPlanId, data);              showToast("Session added ✓"); }
    setModalOpen(false);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this session?")) return;
    await deletePlanSession(user.uid, currentExamId, currentPlanId, id); showToast("Deleted");
  }

  async function handleExportCurrent() {
    if (!currentPlanId) { showToast("No plan to export"); return; }
    const data = await exportPlan(user.uid, currentExamId, currentPlanId);
    if (!data) { showToast("Nothing to export"); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${(data.plan?.name || "plan").replace(/[^a-z0-9-_]+/gi, "_")}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  async function handleImportPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !currentExamId) return;
    try {
      const json = JSON.parse(await file.text());
      await importPlan(user.uid, currentExamId, json);
      const fresh = await getPlans(user.uid, currentExamId);
      setPlans(fresh);
      showToast("Plan imported ✓");
    } catch (err) { showToast("Invalid file: " + (err.message || err)); }
  }

  const totalMins = sessions.reduce((acc, s) => acc + duration(s.start, s.end), 0);
  const hasExam = exams.length > 0 && !!currentExamId;
  const hasPlan = !!currentPlanId;

  return (
    <div style={{ paddingBottom: 80, position: "relative" }}>
      {loadingInit && <LoadingOverlay message="Loading your plans…" />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <Chip label="Sessions" value={sessions.length} />
          <Chip label="Total"    value={minsToHM(totalMins)} />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => setShowAI(true)} style={btnStyle("#7c3aed")}>✨ AI Plan</button>
          <button onClick={openAdd} style={btnStyle("var(--accent)")} disabled={!hasPlan}>＋ Add Session</button>
          <button onClick={handleExportCurrent} style={btnStyle("#0ea5e9")} disabled={!hasPlan}>⬇ Export</button>
          <label style={{ ...btnStyle("#10b981"), display: "inline-block", cursor: "pointer" }}>
            ⬆ Import
            <input type="file" accept="application/json" onChange={handleImportPick} style={{ display: "none" }} disabled={!hasExam} />
          </label>
        </div>
      </div>

      {!hasExam && (
        <EmptyState
          icon="📚"
          title="Add your first exam"
          hint="Start by creating an exam to organize your study plans."
          action={<button onClick={() => setShowAddExam(true)} style={btnStyle("var(--accent)")}>＋ Add Exam</button>}
        />
      )}

      {hasExam && !hasPlan && (
        <EmptyState
          icon="📋"
          title="No plans yet for this exam"
          hint="Create a plan with AI, or add one manually."
          action={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <button onClick={() => setShowAI(true)} style={btnStyle("#7c3aed")}>✨ Create plan with AI</button>
            </div>
          }
        />
      )}

      {hasPlan && (
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
      )}

      <ExamPlanSelector
        onAddExam={() => setShowAddExam(true)}
        onAddSession={openAdd}
      />

      {showAI && user && (
        <AIPlanModal
          user={user}
          onClose={() => setShowAI(false)}
          onCreated={(n, p) => {
            showToast(`${p ? `${p} plans, ` : ""}${n} session${n !== 1 ? "s" : ""} created`);
            setShowAI(false);
          }}
        />
      )}

      {showAddExam && (
        <AddExamModal
          onClose={() => setShowAddExam(false)}
          onCreated={async (examId, name) => {
            const fresh = await getExams(user.uid);
            setExams(fresh);
            setCurrentExamId(examId);
            setCurrentExamName(name);
            setShowAddExam(false);
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

function EmptyState({ icon, title, hint, action }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "40px 20px", textAlign: "center", color: "var(--ink)" }}>
      <div style={{ fontSize: 44 }}>{icon}</div>
      <h3 style={{ fontSize: 18, margin: "12px 0 6px" }}>{title}</h3>
      <p style={{ color: "var(--ink2)", marginBottom: 16 }}>{hint}</p>
      {action}
    </div>
  );
}

const inputStyle = { width: "100%", padding: "9px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit" };
function btnStyle(bg) { return { background: bg, color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 500, cursor: "pointer" }; }
function iconBtn(bg, color) { return { background: bg, color, border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 13, cursor: "pointer" }; }
