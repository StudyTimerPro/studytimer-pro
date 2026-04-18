import React, { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import useStore from "../../store/useStore";
import { loadMemberPlans, listenGroupPlans, approveGroupPlan } from "../../firebase/groupsDb";
import { enrollInPlan, toggleLikePlan, pinPlan, removePlan, incrementPlanViewCount } from "../../firebase/groupsEngagement";
import { savePlanToExam, saveExam } from "../../firebase/db";
import { LoadingOverlay } from "../common/LoadingAnimation";
import PlanSessionsModal from "./PlanSessionsModal";

const CSS = `
.gp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
@media (max-width: 640px) { .gp-grid { grid-template-columns: repeat(2, 1fr); } }
`;

export default function GroupPlans({ members, groupId, groupName, isAdmin, user: userProp }) {
  const { user: authUser }  = useAuth();
  const user                = userProp || authUser;
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
    setCurrentExamId(examId); setCurrentExamName(name);
    setExams([...exams, { id: examId, name, createdAt: Date.now() }]);
    return { examId, examName: name };
  }

  async function handleEnroll(plan) {
    const sessions = Array.isArray(plan.sessions) ? plan.sessions : Object.values(plan.sessions || {});
    if (!sessions.length) { showToast("No sessions in this plan"); return; }
    setBusy(plan.id);
    try {
      const { examId, examName } = await resolveExam();
      await Promise.all([enrollInPlan(groupId, plan.id, user.uid), savePlanToExam(user.uid, examId, plan.name, sessions)]);
      showToast(`Plan enrolled under ${examName}!`);
    } catch { showToast("Failed to enroll"); }
    finally { setBusy(null); }
  }

  async function handleViewSessions(plan) {
    setViewingPlan(plan);
    try { await incrementPlanViewCount(groupId, plan.id); } catch {}
  }

  async function handleLike(plan) {
    try { await toggleLikePlan(groupId, plan.id, user.uid); } catch { showToast("Failed to like"); }
  }

  async function handleApprove(planId) {
    try { await approveGroupPlan(groupId, planId); showToast("Plan approved ✓"); } catch { showToast("Failed"); }
  }

  async function handlePin(plan) {
    try { await pinPlan(groupId, plan.id, !plan.pinned); } catch { showToast("Failed to pin"); }
  }

  async function handleRemove(planId) {
    if (!confirm("Remove this plan?")) return;
    try { await removePlan(groupId, planId); showToast("Plan removed"); } catch { showToast("Failed"); }
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
      <style>{CSS}</style>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "var(--ink)" }}>📋 Group Plans ({groupPlans.length})</h3>

      {groupPlans.length === 0 && (
        <p style={{ color: "var(--ink2)", fontSize: 13, marginBottom: 20 }}>No plans shared yet. Use "Share to Group" from Today's Plan.</p>
      )}

      {groupPlans.length > 0 && (
        <div style={{ position: "relative", marginBottom: 24 }}>
          {busy && <LoadingOverlay message="Enrolling…" size={50} />}
          <div className="gp-grid">
            {groupPlans.map(plan => (
              <PlanCard key={plan.id} plan={plan} uid={user.uid} isAdmin={isAdmin} enrollBusy={busy === plan.id}
                onView={() => handleViewSessions(plan)}
                onLike={() => handleLike(plan)}
                onEnroll={() => busy !== plan.id && handleEnroll(plan)}
                onApprove={() => handleApprove(plan.id)}
                onPin={() => handlePin(plan)}
                onRemove={() => handleRemove(plan.id)}
              />
            ))}
          </div>
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
              {photo ? <img src={photo} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
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
        <PlanSessionsModal plan={viewingPlan} onClose={() => setViewingPlan(null)}
          onEnroll={() => { handleEnroll(viewingPlan); setViewingPlan(null); }}
          enrolled={!!(viewingPlan.enrollments?.[user.uid])} enrollBusy={busy === viewingPlan.id}
        />
      )}
    </div>
  );
}

function PlanCard({ plan, uid, isAdmin, enrollBusy, onView, onLike, onEnroll, onApprove, onPin, onRemove }) {
  const sessions = Array.isArray(plan.sessions) ? plan.sessions : Object.values(plan.sessions || {});
  const liked    = !!(plan.likes?.[uid]);
  const enrolled = !!(plan.enrollments?.[uid]);
  const isPending = !plan.approved;

  return (
    <div
      style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: "14px 12px", position: "relative", display: "flex", flexDirection: "column", gap: 8, boxShadow: "0 1px 6px rgba(0,0,0,.05)", transition: "box-shadow .15s" }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.12)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 6px rgba(0,0,0,.05)"}
    >
      {plan.pinned && <div style={{ position: "absolute", top: 8, right: 8, fontSize: 14, lineHeight: 1 }}>📌</div>}

      <div style={{ textAlign: "center", fontSize: 44, lineHeight: 1, paddingTop: 4 }}>📋</div>

      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.3, marginBottom: 4 }}>
          {plan.name}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, background: isPending ? "#fef3c7" : "#d1fae5", color: isPending ? "#d97706" : "#059669", borderRadius: 4, padding: "1px 5px" }}>
          {isPending ? "⏳ Pending" : "✓ Approved"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "white", fontWeight: 700, flexShrink: 0 }}>
          {(plan.sharedByName || "?").charAt(0).toUpperCase()}
        </div>
        <span style={{ fontSize: 11, color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plan.sharedByName || "Unknown"}</span>
      </div>

      <div style={{ fontSize: 11, color: "var(--ink2)", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span>📋 {sessions.length}</span>
        <span>👥 {plan.enrollCount || 0}</span>
        <span>❤️ {plan.likeCount || 0}</span>
        <span>👁 {plan.viewCount || 0}</span>
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: "auto" }}>
        <button onClick={onLike} style={{ ...smBtn, background: liked ? "#fde8e8" : "var(--bg)", color: liked ? "#e63946" : "var(--ink2)" }}>
          {liked ? "❤️" : "🤍"}
        </button>
        <button onClick={onView} style={{ ...smBtn, background: "#f0f4ff", color: "#4f46e5" }}>
          👁 View
        </button>
        <button onClick={onEnroll} disabled={enrolled || isPending || enrollBusy}
          style={{ ...smBtn, background: enrolled ? "#d1fae5" : isPending ? "var(--bg)" : "var(--accent)", color: enrolled ? "#059669" : isPending ? "var(--ink2)" : "white", border: enrolled || isPending ? "1px solid var(--border)" : "none", opacity: enrollBusy ? 0.6 : 1 }}>
          {enrollBusy ? "…" : enrolled ? "✅" : "➕ Enroll"}
        </button>
        {isAdmin && isPending && (
          <button onClick={onApprove} style={{ ...smBtn, background: "#d1fae5", color: "#059669" }}>✓</button>
        )}
        {isAdmin && (
          <>
            <button onClick={onPin} style={{ ...smBtn, background: plan.pinned ? "#fef3c7" : "var(--bg)", color: plan.pinned ? "#d97706" : "var(--ink2)" }}>
              {plan.pinned ? "📌" : "📍"}
            </button>
            <button onClick={onRemove} style={{ ...smBtn, background: "#fde8e8", color: "#e63946" }}>🗑</button>
          </>
        )}
      </div>
    </div>
  );
}

function Initials({ name, size }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.45, color: "white", fontWeight: 700, flexShrink: 0 }}>{(name || "?").charAt(0).toUpperCase()}</div>;
}

function fmt12(t) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const smBtn = { border: "1px solid var(--border)", borderRadius: 6, padding: "4px 7px", fontSize: 11, fontWeight: 600, cursor: "pointer", background: "var(--bg)", color: "var(--ink2)", display: "flex", alignItems: "center", gap: 2 };
