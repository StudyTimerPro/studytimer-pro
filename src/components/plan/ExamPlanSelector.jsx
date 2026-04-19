import React, { useState, useRef, useEffect } from "react";
import useStore from "../../store/useStore";
import { useAuth } from "../../hooks/useAuth";
import {
  getExams, getPlans, deleteExam, deletePlanFromExam, renamePlan,
  exportExam, exportPlan, importExam, importPlan, createEmptyPlan,
} from "../../firebase/db";
import ShareToGroupModal from "./ShareToGroupModal";

export default function ExamPlanSelector({ onAddExam, onAddSession, onAddPlan }) {
  const { user } = useAuth();
  const {
    exams, setExams, currentExamId, setCurrentExamId, setCurrentExamName,
    plans, setPlans, currentPlanId, setCurrentPlanId, setCurrentPlanName,
    showToast,
  } = useStore();
  const [examOpen,   setExamOpen]   = useState(false);
  const [planOpen,   setPlanOpen]   = useState(false);
  const [menuFor,    setMenuFor]    = useState(null);
  const [sharePlan,  setSharePlan]  = useState(null);
  const examImportRef = useRef(null);
  const planImportRef = useRef(null);

  useEffect(() => {
    const close = e => { if (!e.target.closest("[data-dropdown]")) { setExamOpen(false); setPlanOpen(false); setMenuFor(null); } };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  async function switchExam(exam) {
    setCurrentExamId(exam.id);
    setCurrentExamName(exam.name);
    setExamOpen(false);
    const fresh = await getPlans(user.uid, exam.id);
    setPlans(fresh);
    const first = fresh[0];
    setCurrentPlanId(first?.id || null);
    setCurrentPlanName(first?.name || "");
  }

  async function switchPlan(plan) {
    setCurrentPlanId(plan.id);
    setCurrentPlanName(plan.name);
    setPlanOpen(false);
  }

  function arrowNav(dir) {
    const next = plans[(plans.findIndex(p => p.id === currentPlanId) + dir + plans.length) % plans.length];
    if (next) { setCurrentPlanId(next.id); setCurrentPlanName(next.name); }
  }

  async function handleDeleteExam(exam) {
    if (!confirm(`Delete exam "${exam.name}" and all its plans?`)) return;
    await deleteExam(user.uid, exam.id);
    const fresh = await getExams(user.uid);
    setExams(fresh);
    if (currentExamId === exam.id) {
      const next = fresh[0];
      setCurrentExamId(next?.id || null);
      setCurrentExamName(next?.name || "");
      if (next) { const p = await getPlans(user.uid, next.id); setPlans(p); setCurrentPlanId(p[0]?.id || null); setCurrentPlanName(p[0]?.name || ""); }
      else { setPlans([]); setCurrentPlanId(null); setCurrentPlanName(""); }
    }
    showToast("Exam deleted");
    setMenuFor(null);
  }

  async function handleDeletePlan(plan) {
    if (!confirm(`Delete plan "${plan.name}"?`)) return;
    await deletePlanFromExam(user.uid, currentExamId, plan.id);
    const fresh = await getPlans(user.uid, currentExamId);
    setPlans(fresh);
    if (currentPlanId === plan.id) {
      const next = fresh[0];
      setCurrentPlanId(next?.id || null);
      setCurrentPlanName(next?.name || "");
    }
    showToast("Plan deleted");
    setMenuFor(null);
  }

  async function handleRenamePlan(plan) {
    const name = prompt("New plan name", plan.name);
    if (!name || !name.trim()) return;
    await renamePlan(user.uid, currentExamId, plan.id, name.trim());
    const fresh = await getPlans(user.uid, currentExamId);
    setPlans(fresh);
    if (currentPlanId === plan.id) setCurrentPlanName(name.trim());
    showToast("Plan renamed");
    setMenuFor(null);
  }

  async function handleExportExam(exam) {
    const data = await exportExam(user.uid, exam.id);
    if (!data) { showToast("Nothing to export"); return; }
    downloadJson(data, `${safeName(exam.name)}-exam.json`);
    setMenuFor(null);
  }

  async function handleExportPlanMenu(plan) {
    const data = await exportPlan(user.uid, currentExamId, plan.id);
    if (!data) { showToast("Nothing to export"); return; }
    downloadJson(data, `${safeName(plan.name)}-plan.json`);
    setMenuFor(null);
  }

  async function handleImportExamFile(file) {
    try {
      const json = JSON.parse(await file.text());
      const id = await importExam(user.uid, json);
      const fresh = await getExams(user.uid);
      setExams(fresh);
      setCurrentExamId(id);
      const created = fresh.find(e => e.id === id);
      setCurrentExamName(created?.name || "");
      const p = await getPlans(user.uid, id);
      setPlans(p);
      setCurrentPlanId(p[0]?.id || null);
      setCurrentPlanName(p[0]?.name || "");
      showToast("Exam imported ✓");
    } catch (err) { showToast("Invalid file: " + (err.message || err)); }
  }

  async function handleImportPlanFile(file) {
    try {
      if (!currentExamId) { showToast("Select an exam first"); return; }
      const json = JSON.parse(await file.text());
      await importPlan(user.uid, currentExamId, json);
      const fresh = await getPlans(user.uid, currentExamId);
      setPlans(fresh);
      showToast("Plan imported ✓");
    } catch (err) { showToast("Invalid file: " + (err.message || err)); }
  }

  return (
    <div style={S.wrap}>
      <input ref={examImportRef} type="file" accept="application/json" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleImportExamFile(f); e.target.value = ""; }} />
      <input ref={planImportRef} type="file" accept="application/json" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleImportPlanFile(f); e.target.value = ""; }} />

      {/* Left: Exam dropdown */}
      <div data-dropdown style={{ position: "relative", flex: 1, minWidth: 0 }}>
        <button style={S.selector} onClick={() => { setExamOpen(v => !v); setPlanOpen(false); }}>
          <span style={S.selectorLabel}>📚 {exams.find(e => e.id === currentExamId)?.name || "Select Exam"}</span>
          <span style={S.caret}>▾</span>
        </button>
        {examOpen && (
          <div style={{ ...S.menu, bottom: "100%", left: 0 }}>
            {exams.length === 0 && <div style={S.empty}>No exams yet</div>}
            {exams.map(e => (
              <div key={e.id} style={{ position: "relative" }}>
                <div style={{ ...S.item, ...(e.id === currentExamId ? S.itemActive : {}) }}>
                  <button style={S.itemMain} onClick={() => switchExam(e)}>{e.name}</button>
                  <button style={S.kebab} onClick={ev => { ev.stopPropagation(); setMenuFor(menuFor?.id === e.id ? null : { kind: "exam", id: e.id }); }}>⋯</button>
                </div>
                {menuFor?.kind === "exam" && menuFor.id === e.id && (
                  <div style={S.submenu}>
                    <button style={S.submenuItem} onClick={() => handleExportExam(e)}>Export Exam</button>
                    <button style={S.submenuItem} onClick={() => { examImportRef.current?.click(); setMenuFor(null); }}>Import Exam</button>
                    <button style={{ ...S.submenuItem, color: "#c0392b" }} onClick={() => handleDeleteExam(e)}>Delete Exam</button>
                  </div>
                )}
              </div>
            ))}
            <button style={{ ...S.item, color: "var(--accent)", fontWeight: 600 }} onClick={() => { setExamOpen(false); onAddExam?.(); }}>＋ Add Exam</button>
          </div>
        )}
      </div>

      {/* Arrows + Add Session */}
      <button style={S.iconBtn} onClick={() => arrowNav(-1)} title="Previous plan">◀</button>
      <button style={S.iconBtn} onClick={onAddSession} title="Add session">＋</button>
      <button style={S.iconBtn} onClick={() => arrowNav(1)} title="Next plan">▶</button>

      {/* Right: Plan dropdown */}
      <div data-dropdown style={{ position: "relative", flex: 1, minWidth: 0 }}>
        <button style={S.selector} onClick={() => { setPlanOpen(v => !v); setExamOpen(false); }} disabled={!currentExamId}>
          <span style={S.selectorLabel}>📋 {plans.find(p => p.id === currentPlanId)?.name || "Select Plan"}</span>
          <span style={S.caret}>▾</span>
        </button>
        {planOpen && (
          <div style={{ ...S.menu, bottom: "100%", right: 0 }}>
            {plans.length === 0 && <div style={S.empty}>No plans yet</div>}
            {plans.map(p => (
              <div key={p.id} style={{ position: "relative" }}>
                <div style={{ ...S.item, ...(p.id === currentPlanId ? S.itemActive : {}) }}>
                  <button style={S.itemMain} onClick={() => switchPlan(p)}>{p.name}</button>
                  <button style={S.kebab} onClick={ev => { ev.stopPropagation(); setMenuFor(menuFor?.id === p.id ? null : { kind: "plan", id: p.id }); }}>⋯</button>
                </div>
                {menuFor?.kind === "plan" && menuFor.id === p.id && (
                  <div style={S.submenu}>
                    <button style={S.submenuItem} onClick={() => handleExportPlanMenu(p)}>Export Plan</button>
                    <button style={S.submenuItem} onClick={() => { planImportRef.current?.click(); setMenuFor(null); }}>Import Plan</button>
                    <button style={S.submenuItem} onClick={() => handleRenamePlan(p)}>Rename Plan</button>
                    <button style={S.submenuItem} onClick={() => { setMenuFor(null); setSharePlan(p); }}>📤 Share to Group</button>
                    <button style={{ ...S.submenuItem, color: "#c0392b" }} onClick={() => handleDeletePlan(p)}>Delete Plan</button>
                  </div>
                )}
              </div>
            ))}
            <button style={{ ...S.item, color: "var(--accent)", fontWeight: 600 }} onClick={async () => {
              setPlanOpen(false);
              if (onAddPlan) { onAddPlan(); return; }
              const name = prompt("Plan name");
              if (!name?.trim()) return;
              await createEmptyPlan(user.uid, currentExamId, name.trim());
              const fresh = await getPlans(user.uid, currentExamId);
              setPlans(fresh);
              const created = fresh.find(pp => pp.name === name.trim());
              if (created) { setCurrentPlanId(created.id); setCurrentPlanName(created.name); }
            }}>＋ Add Plan</button>
          </div>
        )}
      </div>

      <button style={{ ...S.iconBtn, color: "#c0392b" }}
        onClick={() => { const p = plans.find(pp => pp.id === currentPlanId); if (p) handleDeletePlan(p); }}
        disabled={!currentPlanId} title="Delete current plan">🗑</button>

      {sharePlan && (
        <ShareToGroupModal
          planId={sharePlan.id} planName={sharePlan.name}
          examId={currentExamId} user={user}
          onClose={() => setSharePlan(null)} showToast={showToast}
        />
      )}
    </div>
  );
}

function safeName(s) { return String(s || "export").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 40); }
function downloadJson(obj, filename) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" })), download: filename });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

const S = {
  wrap:       { flexShrink: 0, background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "8px 10px", display: "flex", gap: 6, alignItems: "center", zIndex: 800, boxShadow: "0 -4px 12px rgba(0,0,0,0.08)" },
  selector:   { display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", cursor: "pointer", fontSize: 13, width: "100%", minWidth: 0 },
  selectorLabel: { flex: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  caret:      { fontSize: 10, color: "var(--ink2)" },
  menu:       { position: "absolute", minWidth: 220, maxWidth: 320, maxHeight: 300, overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", padding: 4, marginBottom: 6 },
  item:       { display: "flex", alignItems: "center", width: "100%", padding: 0, border: "none", background: "none", borderRadius: 6, color: "var(--ink)", fontSize: 13, cursor: "pointer" },
  itemActive: { background: "var(--bg)" },
  itemMain:   { flex: 1, textAlign: "left", padding: "8px 10px", border: "none", background: "none", color: "inherit", cursor: "pointer", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  kebab:      { border: "none", background: "none", color: "var(--ink2)", cursor: "pointer", padding: "6px 8px", fontSize: 16 },
  submenu:    { position: "absolute", right: 0, top: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,0.22)", zIndex: 2, minWidth: 150, padding: 4 },
  submenuItem:{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: "none", background: "none", color: "var(--ink)", cursor: "pointer", fontSize: 13, borderRadius: 6 },
  empty:      { padding: "10px 12px", fontSize: 12, color: "var(--ink2)" },
  iconBtn:    { border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", borderRadius: 8, width: 38, height: 38, cursor: "pointer", fontSize: 14, flexShrink: 0 },
};
