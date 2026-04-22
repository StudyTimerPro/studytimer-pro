import React, { useState, useRef, useEffect } from "react";
import useStore from "../../store/useStore";
import { useAuth } from "../../hooks/useAuth";
import {
  getExams, getPlans, deleteExam, deletePlanFromExam, renamePlan,
  exportExam, exportPlan, importExam, importPlan, createEmptyPlan,
} from "../../firebase/db";
import ShareToGroupModal from "./ShareToGroupModal";

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function useIsMobile(bp = 768) {
  const [m, setM] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < bp : false
  );
  useEffect(() => {
    const fn = () => setM(window.innerWidth < bp);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [bp]);
  return m;
}

function daysAway(dateStr) {
  if (!dateStr) return null;
  const d = Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
  return d >= 0 ? d : null;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function safeName(s) {
  return String(s || "export").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 40);
}

function downloadJson(obj, filename) {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(
      new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" })
    ),
    download: filename,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

/* ─── Main Export ─────────────────────────────────────────────────────────── */
/*
 * LAYOUT NOTE (desktop):
 * This component renders a fixed left sidebar (268 px) and adds the CSS class
 * "stp-has-sidebar" to <body>. theme.css must include:
 *
 *   body.stp-has-sidebar main { padding-left: 268px; }
 *
 * so the page content is offset correctly.
 *
 * LAYOUT NOTE (mobile):
 * Renders a compact two-column bar. Place it above the stats / timeline area
 * in your Today's Plan page — it replaces the old bottom-bar selector.
 */
export default function ExamPlanSelector({ onAddExam, onAddSession, onAddPlan }) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const {
    exams, setExams,
    currentExamId, setCurrentExamId, setCurrentExamName,
    plans,  setPlans,
    currentPlanId,  setCurrentPlanId,  setCurrentPlanName,
    showToast,
  } = useStore();

  // optional: array[7] of 0..1 representing this-week study intensity per day
  const weekActivity = useStore(s => s.weekActivity);

  const [menuFor,   setMenuFor]   = useState(null);   // { kind:"exam"|"plan", id }
  const [sharePlan, setSharePlan] = useState(null);
  const [examOpen,  setExamOpen]  = useState(false);  // mobile dropdown
  const [planOpen,  setPlanOpen]  = useState(false);  // mobile dropdown
  const examImportRef = useRef(null);
  const planImportRef = useRef(null);

  /* body class → main padding offset on desktop */
  useEffect(() => {
    if (!isMobile) document.body.classList.add("stp-has-sidebar");
    else           document.body.classList.remove("stp-has-sidebar");
    return () => document.body.classList.remove("stp-has-sidebar");
  }, [isMobile]);

  /* close context menus / dropdowns on outside click.
     ctxPos lives inside MobileSelector; clearing menuFor here is sufficient
     because the fixed ctx panel is conditioned on menuFor. */
  useEffect(() => {
    const fn = e => {
      if (!e.target.closest("[data-dropdown]") && !e.target.closest("[data-ctx]")) {
        setMenuFor(null); setExamOpen(false); setPlanOpen(false);
      }
    };
    document.addEventListener("click", fn);
    return () => document.removeEventListener("click", fn);
  }, []);

  /* ── handlers (shared between desktop / mobile) ─────────────────────────── */
  async function switchExam(exam) {
    setCurrentExamId(exam.id); setCurrentExamName(exam.name);
    setExamOpen(false);
    const fresh = await getPlans(user.uid, exam.id);
    setPlans(fresh);
    const first = fresh[0];
    setCurrentPlanId(first?.id || null);
    setCurrentPlanName(first?.name || "");
  }

  async function switchPlan(plan) {
    setCurrentPlanId(plan.id); setCurrentPlanName(plan.name);
    setPlanOpen(false);
  }

  async function handleDeleteExam(exam) {
    if (!confirm(`Delete exam "${exam.name}" and all its plans?`)) return;
    await deleteExam(user.uid, exam.id);
    const fresh = await getExams(user.uid);
    setExams(fresh);
    if (currentExamId === exam.id) {
      const next = fresh[0];
      setCurrentExamId(next?.id || null); setCurrentExamName(next?.name || "");
      if (next) {
        const p = await getPlans(user.uid, next.id);
        setPlans(p); setCurrentPlanId(p[0]?.id || null); setCurrentPlanName(p[0]?.name || "");
      } else { setPlans([]); setCurrentPlanId(null); setCurrentPlanName(""); }
    }
    showToast("Exam deleted"); setMenuFor(null);
  }

  async function handleDeletePlan(plan) {
    if (!confirm(`Delete plan "${plan.name}"?`)) return;
    await deletePlanFromExam(user.uid, currentExamId, plan.id);
    const fresh = await getPlans(user.uid, currentExamId);
    setPlans(fresh);
    if (currentPlanId === plan.id) {
      const next = fresh[0];
      setCurrentPlanId(next?.id || null); setCurrentPlanName(next?.name || "");
    }
    showToast("Plan deleted"); setMenuFor(null);
  }

  async function handleRenamePlan(plan) {
    const name = prompt("New plan name", plan.name);
    if (!name?.trim()) return;
    await renamePlan(user.uid, currentExamId, plan.id, name.trim());
    const fresh = await getPlans(user.uid, currentExamId);
    setPlans(fresh);
    if (currentPlanId === plan.id) setCurrentPlanName(name.trim());
    showToast("Plan renamed"); setMenuFor(null);
  }

  async function handleExportExam(exam) {
    const data = await exportExam(user.uid, exam.id);
    if (!data) { showToast("Nothing to export"); return; }
    downloadJson(data, `${safeName(exam.name)}-exam.json`);
    setMenuFor(null);
  }

  async function handleExportPlan(plan) {
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
      setExams(fresh); setCurrentExamId(id);
      const created = fresh.find(e => e.id === id);
      setCurrentExamName(created?.name || "");
      const p = await getPlans(user.uid, id);
      setPlans(p); setCurrentPlanId(p[0]?.id || null); setCurrentPlanName(p[0]?.name || "");
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

  async function handleAddPlan() {
    if (onAddPlan) { onAddPlan(); return; }
    const name = prompt("Plan name");
    if (!name?.trim()) return;
    await createEmptyPlan(user.uid, currentExamId, name.trim());
    const fresh = await getPlans(user.uid, currentExamId);
    setPlans(fresh);
    const created = fresh.find(p => p.name === name.trim());
    if (created) { setCurrentPlanId(created.id); setCurrentPlanName(created.name); }
  }

  /* bundle everything for child components */
  const shared = {
    user, exams, currentExamId, plans, currentPlanId, weekActivity,
    menuFor, setMenuFor, sharePlan, setSharePlan,
    examOpen, setExamOpen, planOpen, setPlanOpen,
    examImportRef, planImportRef,
    switchExam, switchPlan,
    handleDeleteExam, handleDeletePlan, handleRenamePlan,
    handleExportExam, handleExportPlan,
    handleAddPlan, onAddExam, onAddSession, showToast,
  };

  return (
    <>
      {/* hidden file inputs (shared) */}
      <input ref={examImportRef} type="file" accept="application/json"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleImportExamFile(f); e.target.value = ""; }} />
      <input ref={planImportRef} type="file" accept="application/json"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleImportPlanFile(f); e.target.value = ""; }} />

      {isMobile
        ? <MobileSelector {...shared} />
        : <DesktopSidebar {...shared} />}

      {sharePlan && (
        <ShareToGroupModal
          planId={sharePlan.id} planName={sharePlan.name}
          examId={currentExamId} user={user}
          onClose={() => setSharePlan(null)} showToast={showToast}
        />
      )}
    </>
  );
}

/* ─── Desktop Sidebar ─────────────────────────────────────────────────────── */
function DesktopSidebar({
  exams, currentExamId, plans, currentPlanId, weekActivity,
  menuFor, setMenuFor, setSharePlan,
  examImportRef, planImportRef,
  switchExam, switchPlan,
  handleDeleteExam, handleDeletePlan, handleRenamePlan,
  handleExportExam, handleExportPlan,
  handleAddPlan, onAddExam,
}) {
  const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <aside style={D.sidebar}>

      {/* ── EXAM ────────────────────────────────────────────── */}
      <div style={D.section}>
        <div style={D.sectionLabel}>Exam</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {exams.map(exam => {
            const isActive = exam.id === currentExamId;
            const dateStr  = exam.examDate || exam.date || null;
            const da       = daysAway(dateStr);

            return (
              <div key={exam.id} data-ctx style={{ position: "relative" }}>
                {/* card */}
                <div
                  style={{ ...D.examCard, ...(isActive ? D.examCardActive : {}) }}
                  onClick={() => switchExam(exam)}
                >
                  <div style={{
                    fontFamily: "var(--serif)", fontSize: 20, fontWeight: 400,
                    lineHeight: 1.2, color: "var(--ink)",
                    paddingRight: 22, letterSpacing: "-0.015em",
                  }}>{exam.name}</div>

                  {dateStr && (
                    <div style={{
                      fontSize: 11, marginTop: 5,
                      color: "var(--ink2)",
                      display: "flex", alignItems: "center", gap: 5,
                    }}>
                      <span>{formatDate(dateStr)}</span>
                      {da !== null && (
                        <><span style={{ color: "var(--ink3)" }}>·</span>
                        <span style={{ color: "var(--ink2)" }}>{da} days away</span></>
                      )}
                    </div>
                  )}

                  {/* kebab */}
                  <button style={{ ...D.kebab, color: "var(--ink3)" }}
                    onClick={ev => {
                      ev.stopPropagation();
                      setMenuFor(menuFor?.id === exam.id ? null : { kind: "exam", id: exam.id });
                    }}>⋯</button>
                </div>

                {/* context menu */}
                {menuFor?.kind === "exam" && menuFor.id === exam.id && (
                  <div style={D.ctxMenu}>
                    <button style={D.ctxItem} onClick={() => handleExportExam(exam)}>Export Exam</button>
                    <button style={D.ctxItem} onClick={() => { examImportRef.current?.click(); setMenuFor(null); }}>Import Exam</button>
                    <div style={D.ctxSep} />
                    <button style={{ ...D.ctxItem, color: "#c0392b" }} onClick={() => handleDeleteExam(exam)}>Delete Exam</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button style={D.addBtn} onClick={onAddExam}>＋ Add exam</button>
      </div>

      <div style={D.divider} />

      {/* ── PLANS ───────────────────────────────────────────── */}
      <div style={D.section}>
        <div style={D.sectionLabel}>Plans</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {plans.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--ink3)", padding: "8px 0" }}>No plans yet</div>
          )}

          {plans.map(plan => {
            const isActive = plan.id === currentPlanId;
            const count    = plan.sessionCount ?? plan.count ?? null;

            return (
              <div key={plan.id} data-ctx style={{ position: "relative" }} className="stp-plan-row">
                <div
                  style={{ ...D.planItem, ...(isActive ? D.planItemActive : {}) }}
                  onClick={() => switchPlan(plan)}
                >
                  <span style={{
                    flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    fontSize: 13, fontWeight: isActive ? 500 : 400,
                    color: isActive ? "#F0EBD8" : "var(--ink)",
                    letterSpacing: isActive ? "-0.01em" : 0,
                  }}>{plan.name}</span>

                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    {count !== null && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, borderRadius: 6,
                        padding: "1px 7px",
                        background: isActive ? "rgba(255,255,255,0.14)" : "var(--chip)",
                        color:      isActive ? "#F6F1E2"                : "var(--ink2)",
                        border:     `1px solid ${isActive ? "rgba(255,255,255,0.08)" : "var(--border)"}`,
                      }}>{count}</span>
                    )}
                    {/* kebab — revealed via CSS on hover (class stp-plan-kebab) */}
                    <button
                      style={{ ...D.kebab, position: "static", color: isActive ? "#BDB49E" : "var(--ink3)" }}
                      className="stp-plan-kebab"
                      onClick={ev => {
                        ev.stopPropagation();
                        setMenuFor(menuFor?.id === plan.id ? null : { kind: "plan", id: plan.id });
                      }}>⋯</button>
                  </div>
                </div>

                {menuFor?.kind === "plan" && menuFor.id === plan.id && (
                  <div style={D.ctxMenu}>
                    <button style={D.ctxItem} onClick={() => handleExportPlan(plan)}>Export Plan</button>
                    <button style={D.ctxItem} onClick={() => { planImportRef.current?.click(); setMenuFor(null); }}>Import Plan</button>
                    <button style={D.ctxItem} onClick={() => handleRenamePlan(plan)}>Rename Plan</button>
                    <button style={D.ctxItem} onClick={() => { setMenuFor(null); setSharePlan(plan); }}>📤 Share to Group</button>
                    <div style={D.ctxSep} />
                    <button style={{ ...D.ctxItem, color: "#c0392b" }} onClick={() => handleDeletePlan(plan)}>Delete Plan</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button style={{ ...D.addBtn, marginTop: 8 }} onClick={handleAddPlan} disabled={!currentExamId}>
          ＋ New plan
        </button>
      </div>

      {/* ── THIS WEEK (pushed to bottom) ────────────────────── */}
      <div style={{ marginTop: "auto" }}>
        <div style={D.divider} />
        <div style={D.section}>
          <div style={D.sectionLabel}>This Week</div>
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
            {DAYS.map((d, i) => {
              const intensity = weekActivity?.[i] ?? 0;  // 0..1
              const isToday = i === (new Date().getDay() + 6) % 7;
              return (
                <div key={i} style={{
                  flex: 1, display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 5,
                }}>
                  <div style={{
                    width: "100%", aspectRatio: "1",
                    borderRadius: 4,
                    background: intensity > 0
                      ? `color-mix(in oklab, var(--accent), var(--bg) ${Math.round((1 - intensity) * 60)}%)`
                      : "var(--chip)",
                    border: isToday ? "1.5px solid var(--ink3)" : "1.5px solid transparent",
                    transition: "background 0.3s ease",
                  }} />
                  <span style={{ fontSize: 9, color: "var(--ink3)", fontWeight: 600, letterSpacing: "0.04em" }}>{d}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ─── Mobile Selector (two-column bar) ───────────────────────────────────── */
function MobileSelector({
  exams, currentExamId, plans, currentPlanId,
  examOpen, setExamOpen, planOpen, setPlanOpen,
  switchExam, switchPlan,
  menuFor, setMenuFor,
  handleDeleteExam, handleExportExam,
  handleDeletePlan, handleExportPlan, handleRenamePlan, setSharePlan,
  examImportRef, planImportRef,
  onAddExam, handleAddPlan,
}) {
  const currentExam = exams.find(e => e.id === currentExamId);
  const currentPlan = plans.find(p => p.id === currentPlanId);

  // Track pixel position of the tapped kebab button so we can render
  // the context menu as a fixed-position overlay (never clipped by overflow:auto).
  const [ctxPos, setCtxPos] = React.useState(null);

  function openCtx(ev, kind, id) {
    ev.stopPropagation();
    const alreadyOpen = menuFor?.kind === kind && menuFor.id === id;
    if (alreadyOpen) { setMenuFor(null); setCtxPos(null); return; }
    const rect = ev.currentTarget.getBoundingClientRect();
    // Anchor the menu to the right edge of the kebab button
    setCtxPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setMenuFor({ kind, id });
  }

  // Build context menu content based on menuFor
  function CtxItems() {
    if (!menuFor) return null;
    if (menuFor.kind === "exam") {
      const e = exams.find(ex => ex.id === menuFor.id);
      if (!e) return null;
      return (<>
        <button style={D.ctxItem} onClick={() => { handleExportExam(e); setCtxPos(null); }}>Export Exam</button>
        <button style={D.ctxItem} onClick={() => { examImportRef.current?.click(); setMenuFor(null); setCtxPos(null); }}>Import Exam</button>
        <div style={D.ctxSep} />
        <button style={{ ...D.ctxItem, color: "#c0392b" }} onClick={() => { handleDeleteExam(e); setCtxPos(null); }}>Delete Exam</button>
      </>);
    }
    if (menuFor.kind === "plan") {
      const p = plans.find(pl => pl.id === menuFor.id);
      if (!p) return null;
      return (<>
        <button style={D.ctxItem} onClick={() => { handleExportPlan(p); setCtxPos(null); }}>Export Plan</button>
        <button style={D.ctxItem} onClick={() => { planImportRef.current?.click(); setMenuFor(null); setCtxPos(null); }}>Import Plan</button>
        <button style={D.ctxItem} onClick={() => { handleRenamePlan(p); setCtxPos(null); }}>Rename Plan</button>
        <button style={D.ctxItem} onClick={() => { setMenuFor(null); setCtxPos(null); setSharePlan(p); }}>📤 Share to Group</button>
        <div style={D.ctxSep} />
        <button style={{ ...D.ctxItem, color: "#c0392b" }} onClick={() => { handleDeletePlan(p); setCtxPos(null); }}>Delete Plan</button>
      </>);
    }
    return null;
  }

  return (
    <>
      <div style={M.wrap}>

        {/* ── Exam column ─────────────────── */}
        <div data-dropdown style={{ flex: 1, minWidth: 0, position: "relative" }}>
          <button style={M.col} onClick={() => { setExamOpen(v => !v); setPlanOpen(false); setMenuFor(null); setCtxPos(null); }}>
            <span style={M.colLabel}>Exam</span>
            <div style={M.colRow}>
              <span style={M.colValue}>{currentExam?.name || "Select Exam"}</span>
              <span style={M.caret}>▾</span>
            </div>
          </button>

          {examOpen && (
            <div style={{ ...M.menu, left: 0 }}>
              {exams.length === 0 && <div style={M.empty}>No exams yet</div>}
              {exams.map(e => {
                const isActive = e.id === currentExamId;
                return (
                  <div key={e.id} data-ctx style={{ ...M.menuItem, ...(isActive ? M.menuItemActive : {}), padding: 0 }}>
                    <span
                      style={{ flex: 1, padding: "9px 4px 9px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                      onClick={() => switchExam(e)}
                    >
                      {e.name}
                      {(e.examDate || e.date) && (
                        <span style={{ marginLeft: "auto", fontSize: 10, color: isActive ? "#BDB49E" : "var(--ink3)" }}>
                          {daysAway(e.examDate || e.date) ?? "—"}d
                        </span>
                      )}
                    </span>
                    <button
                      style={{ ...D.kebab, position: "static", color: isActive ? "#BDB49E" : "var(--ink3)", padding: "9px 10px", fontSize: 15 }}
                      onClick={ev => openCtx(ev, "exam", e.id)}
                    >⋯</button>
                  </div>
                );
              })}
              <div style={M.sep} />
              <button style={{ ...M.menuItem, color: "var(--accent)", fontWeight: 600 }}
                onClick={() => { setExamOpen(false); onAddExam?.(); }}>＋ Add Exam</button>
            </div>
          )}
        </div>

        {/* vertical divider */}
        <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />

        {/* ── Plan column ──────────────────── */}
        <div data-dropdown style={{ flex: 1, minWidth: 0, position: "relative" }}>
          <button
            style={{ ...M.col, opacity: currentExamId ? 1 : 0.45 }}
            onClick={() => { if (!currentExamId) return; setPlanOpen(v => !v); setExamOpen(false); setMenuFor(null); setCtxPos(null); }}
          >
            <span style={M.colLabel}>Plan</span>
            <div style={M.colRow}>
              <span style={M.colValue}>{currentPlan?.name || "Select Plan"}</span>
              <span style={M.caret}>▾</span>
            </div>
          </button>

          {planOpen && (
            <div style={{ ...M.menu, right: 0 }}>
              {plans.length === 0 && <div style={M.empty}>No plans yet</div>}
              {plans.map(p => {
                const isActive = p.id === currentPlanId;
                const count    = p.sessionCount ?? p.count ?? null;
                return (
                  <div key={p.id} data-ctx style={{ ...M.menuItem, ...(isActive ? M.menuItemActive : {}), padding: 0 }}>
                    <span
                      style={{ flex: 1, padding: "9px 4px 9px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                      onClick={() => switchPlan(p)}
                    >
                      {p.name}
                      {count !== null && (
                        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: isActive ? "#BDB49E" : "var(--ink3)" }}>
                          {count}
                        </span>
                      )}
                    </span>
                    <button
                      style={{ ...D.kebab, position: "static", color: isActive ? "#BDB49E" : "var(--ink3)", padding: "9px 10px", fontSize: 15 }}
                      onClick={ev => openCtx(ev, "plan", p.id)}
                    >⋯</button>
                  </div>
                );
              })}
              <div style={M.sep} />
              <button style={{ ...M.menuItem, color: "var(--accent)", fontWeight: 600 }}
                onClick={() => { setPlanOpen(false); handleAddPlan(); }}>＋ New Plan</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Fixed-position context menu (rendered outside the overflow:auto dropdown) ── */}
      {menuFor && ctxPos && (
        <div
          data-ctx
          style={{
            position: "fixed",
            top: ctxPos.top,
            right: ctxPos.right,
            zIndex: 200,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
            padding: 4,
            minWidth: 188,
          }}
        >
          <CtxItems />
        </div>
      )}
    </>
  );
}

/* ─── Style objects ───────────────────────────────────────────────────────── */

/* Desktop */
const D = {
  sidebar: {
    position: "fixed",
    left: 0,
    top: "var(--stp-nav-h, 104px)",
    bottom: 0,
    width: 268,
    background: "var(--bg)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    overflowX: "hidden",
    zIndex: 30,
    paddingTop: 24,
    paddingBottom: 16,
  },
  section: {
    padding: "0 16px 12px",
  },
  sectionLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
    textTransform: "uppercase", color: "var(--ink3)",
    marginBottom: 12,
  },
  examCard: {
    position: "relative",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "14px 38px 14px 14px",
    cursor: "pointer",
    transition: "border-color 0.15s, box-shadow 0.15s",
    userSelect: "none",
  },
  examCardActive: {
    borderColor: "var(--ink)",
    boxShadow: "0 0 0 0.5px var(--ink)",
  },
  planItem: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "9px 10px",
    borderRadius: 8, cursor: "pointer",
    userSelect: "none", transition: "background 0.1s",
  },
  planItemActive: {
    background: "var(--nav-bg)",
  },
  addBtn: {
    display: "flex", alignItems: "center", gap: 6,
    marginTop: 10, padding: "8px 10px", width: "100%",
    border: "1.5px dashed var(--border)", borderRadius: 8,
    background: "none", color: "var(--ink3)",
    fontSize: 12, fontWeight: 500, cursor: "pointer",
    fontFamily: "inherit", transition: "border-color 0.15s, color 0.15s",
    letterSpacing: "0.01em",
  },
  divider: {
    height: 1, background: "var(--border)", margin: "8px 16px 16px",
  },
  kebab: {
    position: "absolute", top: 8, right: 6,
    border: "none", background: "none",
    cursor: "pointer", padding: "3px 6px",
    fontSize: 15, lineHeight: 1, borderRadius: 4,
    fontFamily: "inherit",
  },
  ctxMenu: {
    position: "absolute", right: 0, top: "calc(100% + 2px)", zIndex: 50,
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.14)",
    padding: 4, minWidth: 156,
  },
  ctxItem: {
    display: "block", width: "100%", textAlign: "left",
    padding: "7px 10px", border: "none", background: "none",
    color: "var(--ink)", cursor: "pointer",
    fontSize: 12, borderRadius: 5, fontFamily: "inherit",
  },
  ctxSep: {
    height: 1, background: "var(--border)", margin: "3px 0",
  },
};

/* Mobile */
const M = {
  /*
   * LAYOUT NOTE: On mobile, render <MobileSelector> directly above your
   * stats section (Scheduled / Sessions). The selectors replace that row
   * visually; move the stats cards to a smaller row beneath it.
   *
   * Example in TodaysPlan.jsx:
   *   {isMobile && <MobileSelector {...} />}
   *   <div className="stp-stats-row">…</div>   ← now sits below selectors
   */
  wrap: {
    display: "flex",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    margin: "12px 16px 0",           /* breathe inside the page, not full-bleed */
    flexShrink: 0,
    boxShadow: "0 1px 3px rgba(30,24,10,.06)",
    /* NOTE: do NOT add overflow:hidden here — it clips the absolute-position
       dropdown menus that open below each column button. */
  },
  col: {
    width: "100%", padding: "11px 14px 12px",
    border: "none", background: "none",
    cursor: "pointer", textAlign: "left",
    display: "flex", flexDirection: "column", gap: 3,
    fontFamily: "inherit",
  },
  colLabel: {
    fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
    textTransform: "uppercase", color: "var(--ink3)",
  },
  colRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  colValue: {
    /* Match desktop exam card — Instrument Serif, prominent size */
    fontFamily: "var(--serif)", fontSize: 17, fontWeight: 400,
    color: "var(--ink)", letterSpacing: "-0.01em",
    overflow: "hidden", textOverflow: "ellipsis",
    whiteSpace: "nowrap", flex: 1, lineHeight: 1.2,
  },
  caret: { fontSize: 13, color: "var(--ink3)", marginLeft: 4 },
  menu: {
    position: "absolute", top: "100%", zIndex: 60,
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
    padding: 4, minWidth: 190, maxHeight: 280, overflowY: "auto",
  },
  menuItem: {
    display: "flex", alignItems: "center", width: "100%",
    textAlign: "left", padding: "9px 12px",
    border: "none", background: "none",
    color: "var(--ink)", cursor: "pointer",
    fontSize: 13, borderRadius: 6, fontFamily: "inherit", gap: 6,
  },
  menuItemActive: {
    background: "var(--nav-bg)", color: "#F6F1E2",
  },
  empty: { padding: "10px 12px", fontSize: 12, color: "var(--ink2)" },
  sep: { height: 1, background: "var(--border)", margin: "4px 0" },
  /* Inline context actions — expands inside the dropdown (no absolute positioning,
     avoids being clipped by the parent's overflowY:auto scroll container) */
  ctxInline: {
    background: "color-mix(in oklab, var(--surface), var(--ink) 4%)",
    borderRadius: 6, margin: "0 6px 4px", padding: "2px 0",
  },
};
