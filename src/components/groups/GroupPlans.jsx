import React, { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import useStore from "../../store/useStore";
import { loadMemberPlans, listenGroupPlans, approveGroupPlan } from "../../firebase/groupsDb";
import { enrollInPlan, toggleLikePlan, pinPlan, removePlan } from "../../firebase/groupsEngagement";
import { savePlanToExam, saveExam } from "../../firebase/db";
import GroupPlanCard from "./GroupPlanCard";
import PlanSessionsModal from "./PlanSessionsModal";

const GRID_CSS = `
.gp-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
@media (max-width: 640px) { .gp-grid { grid-template-columns: 1fr; } }
`;

export default function GroupPlans({ members, groupId, groupName, isAdmin, user: userProp }) {
  const { user: authUser }                                          = useAuth();
  const user                                                        = userProp || authUser;
  const { currentExamId, currentExamName, setCurrentExamId, setCurrentExamName, setExams, exams, showToast } = useStore();
  const [memberPlans,  setMemberPlans]  = useState([]);
  const [groupPlans,   setGroupPlans]   = useState([]);
  const [loadingM,     setLoadingM]     = useState(true);
  const [busy,         setBusy]         = useState(null);
  const [viewingPlan,  setViewingPlan]  = useState(null);

  useEffect(() => {
    setLoadingM(true);
    loadMemberPlans(members).then(setMemberPlans).catch(() => {}).finally(() => setLoadingM(false));
  }, [groupId]);

  useEffect(() => listenGroupPlans(groupId, list => {
    setGroupPlans(list.slice().sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    }));
  }), [groupId]);

  async function resolveExam() {
    if (currentExamId) return { examId: currentExamId, examName: currentExamName || "Exam" };
    const name   = groupName || "Group Study";
    const examId = await saveExam(user.uid, { name });
    const updated = [...exams, { id: examId, name, createdAt: Date.now() }];
    setCurrentExamId(examId);
    setCurrentExamName(name);
    setExams(updated);
    return { examId, examName: name };
  }

  async function handleEnroll(plan) {
    const sessions = Array.isArray(plan.sessions) ? plan.sessions : Object.values(plan.sessions || {});
    if (!sessions.length) { showToast("No sessions in this plan"); return; }
    setBusy(plan.id);
    try {
      const { examId, examName } = await resolveExam();
      await Promise.all([
        enrollInPlan(groupId, plan.id, user.uid),
        savePlanToExam(user.uid, examId, plan.name, sessions),
      ]);
      showToast(`Plan enrolled under ${examName}!`);
    } catch { showToast("Failed to enroll"); }
    finally { setBusy(null); }
  }

  async function handleLike(plan) {
    try { await toggleLikePlan(groupId, plan.id, user.uid); }
    catch { showToast("Failed to like"); }
  }

  async function handleApprove(planId) {
    try { await approveGroupPlan(groupId, planId); showToast("Plan approved ✓"); }
    catch { showToast("Failed"); }
  }

  async function handlePin(plan) {
    try { await pinPlan(groupId, plan.id, !plan.pinned); }
    catch { showToast("Failed to pin"); }
  }

  async function handleRemove(planId) {
    if (!confirm("Remove this plan?")) return;
    try { await removePlan(groupId, planId); showToast("Plan removed"); }
    catch { showToast("Failed"); }
  }

  async function handleAddMember(name, sessions) {
    const key = "m_" + name;
    setBusy(key);
    try {
      const { examId, examName } = await resolveExam();
      await savePlanToExam(user.uid, examId, `${name}'s Plan`, sessions.map(({ id, ...r }) => r));
      showToast(`Added "${name}'s Plan" under ${examName} ✓`);
    } catch { showToast("Failed"); }
    finally { setBusy(null); }
  }

  return (
    <div>
      <style>{GRID_CSS}</style>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--ink)" }}>
        📋 Group Plans ({groupPlans.length})
      </h3>
      {groupPlans.length === 0 && (
        <p style={{ color: "var(--ink2)", fontSize: 13, marginBottom: 20 }}>No plans shared yet. Use "Share to Group" from Today's Plan.</p>
      )}
      {groupPlans.length > 0 && (
        <div className="gp-grid" style={{ marginBottom: 24 }}>
          {groupPlans.map(plan => (
            <GroupPlanCard key={plan.id} plan={plan} uid={user.uid} isAdmin={isAdmin}
              onLike={() => handleLike(plan)}
              onEnroll={() => busy !== plan.id && handleEnroll(plan)}
              onApprove={() => handleApprove(plan.id)}
              onPin={() => handlePin(plan)}
              onRemove={() => handleRemove(plan.id)}
              onViewSessions={() => setViewingPlan(plan)}
            />
          ))}
        </div>
      )}

      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "var(--ink)" }}>👥 Members' Today Plans</h3>
      {loadingM && <p style={{ color: "var(--ink2)", fontSize: 13 }}>Loading...</p>}
      {!loadingM && memberPlans.map(({ uid, name, photo, sessions }) => {
        const key    = "m_" + name;
        const sorted = sessions.slice().sort((a, b) => (a.start || "").localeCompare(b.start || ""));
        return (
          <div key={uid} style={{ background: "var(--surface)", borderRadius: 10, padding: "12px 14px", marginBottom: 10, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {photo
                ? <img src={photo} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                : <Initials name={name} size={28} />}
              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", flex: 1 }}>{name}</span>
              <span style={{ fontSize: 11, color: "var(--ink2)" }}>{sessions.length} session{sessions.length !== 1 ? "s" : ""}</span>
              <button onClick={() => handleAddMember(name, sessions)} disabled={busy === key || !sessions.length}
                style={{ background: "#eaf0fb", color: "#2563eb", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: sessions.length && busy !== key ? "pointer" : "default" }}>
                {busy === key ? "Adding…" : "➕ Add"}
              </button>
            </div>
            {sorted.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                {sorted.map(s => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 8px", background: "var(--bg)", borderRadius: 6 }}>
                    <span style={{ color: "var(--ink)", fontWeight: 500 }}>{s.name}</span>
                    <span style={{ color: "var(--ink2)", fontFamily: "monospace", fontSize: 11 }}>{fmt12(s.start)}–{fmt12(s.end)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {viewingPlan && (
        <PlanSessionsModal
          plan={viewingPlan}
          onClose={() => setViewingPlan(null)}
          onEnroll={() => { handleEnroll(viewingPlan); setViewingPlan(null); }}
          enrolled={!!(viewingPlan.enrollments?.[user.uid])}
          enrollBusy={busy === viewingPlan.id}
        />
      )}
    </div>
  );
}

function Initials({ name, size }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.45, color: "white", fontWeight: 700, flexShrink: 0 }}>
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}

function fmt12(t) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
}
