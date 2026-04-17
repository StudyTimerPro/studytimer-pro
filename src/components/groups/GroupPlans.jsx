import React, { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import useStore from "../../store/useStore";
import { loadMemberPlans, listenGroupPlans, approveGroupPlan, rejectGroupPlan } from "../../firebase/groupsDb";
import { savePlanToExam } from "../../firebase/db";

export default function GroupPlans({ members, groupId, isAdmin, user: userProp }) {
  const { user: authUser }                = useAuth();
  const user                              = userProp || authUser;
  const { currentExamId, showToast }      = useStore();
  const [memberPlans, setMemberPlans]     = useState([]);
  const [groupPlans,  setGroupPlans]      = useState([]);
  const [loading,     setLoading]         = useState(true);
  const [adding,      setAdding]          = useState(null);

  useEffect(() => {
    setLoading(true);
    loadMemberPlans(members).then(setMemberPlans).catch(() => {}).finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => {
    return listenGroupPlans(groupId, setGroupPlans);
  }, [groupId]);

  async function handleAddMember(memberName, sessions) {
    if (!currentExamId) { showToast("Select an exam in Today's Plan first"); return; }
    if (!sessions.length) { showToast("No sessions to copy"); return; }
    setAdding("m_" + memberName);
    try {
      const clean = sessions.map(({ id, ...rest }) => rest);
      await savePlanToExam(user.uid, currentExamId, `${memberName}'s Plan`, clean);
      showToast(`Added "${memberName}'s Plan" ✓`);
    } catch { showToast("Failed to add plan"); }
    finally { setAdding(null); }
  }

  async function handleAddGroupPlan(plan) {
    if (!currentExamId) { showToast("Select an exam in Today's Plan first"); return; }
    const sessions = Array.isArray(plan.sessions) ? plan.sessions : Object.values(plan.sessions || {});
    if (!sessions.length) { showToast("No sessions in this plan"); return; }
    setAdding("g_" + plan.id);
    try {
      await savePlanToExam(user.uid, currentExamId, plan.name, sessions);
      showToast(`Added "${plan.name}" ✓`);
    } catch { showToast("Failed to add plan"); }
    finally { setAdding(null); }
  }

  async function handleApprove(planId) {
    try { await approveGroupPlan(groupId, planId); showToast("Plan approved ✓"); }
    catch { showToast("Failed to approve"); }
  }

  async function handleReject(planId) {
    try { await rejectGroupPlan(groupId, planId); showToast("Plan rejected"); }
    catch { showToast("Failed to reject"); }
  }

  const pendingPlans  = groupPlans.filter(p => !p.approved);
  const approvedPlans = groupPlans.filter(p => p.approved);

  return (
    <div>
      {/* Admin: Pending Plans */}
      {isAdmin && pendingPlans.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "var(--ink)" }}>⏳ Pending Plans ({pendingPlans.length})</h3>
          {pendingPlans.map(plan => {
            const sessions = Array.isArray(plan.sessions) ? plan.sessions : Object.values(plan.sessions || {});
            return (
              <div key={plan.id} style={{ background: "var(--surface)", borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>{plan.name}</div>
                  <div style={{ fontSize: 11, color: "var(--ink2)", marginTop: 2 }}>By {plan.sharedByName} · {sessions.length} session{sessions.length !== 1 ? "s" : ""}</div>
                </div>
                <button onClick={() => handleApprove(plan.id)} style={aBtn("#eaf0fb", "#2563eb")}>✓ Approve</button>
                <button onClick={() => handleReject(plan.id)}  style={aBtn("#fde8e8", "#e63946")}>✕ Reject</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Approved Group Plans */}
      {approvedPlans.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "var(--ink)" }}>📋 Group Plans ({approvedPlans.length})</h3>
          {approvedPlans.map(plan => {
            const sessions = Array.isArray(plan.sessions) ? plan.sessions : Object.values(plan.sessions || {});
            const key = "g_" + plan.id;
            return (
              <div key={plan.id} style={{ background: "var(--surface)", borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>{plan.name}</div>
                  <div style={{ fontSize: 11, color: "var(--ink2)", marginTop: 2 }}>By {plan.sharedByName} · {sessions.length} session{sessions.length !== 1 ? "s" : ""}</div>
                </div>
                <button onClick={() => handleAddGroupPlan(plan)} disabled={adding === key}
                  style={{ background: adding === key ? "var(--border)" : "#eaf0fb", color: "#2563eb", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: adding === key ? "not-allowed" : "pointer" }}>
                  {adding === key ? "Adding…" : "➕ Add to My Plans"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Members' Today Plans */}
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "var(--ink)" }}>👥 Members' Today Plans</h3>
      {loading && <p style={{ color: "var(--ink2)", fontSize: 13 }}>Loading plans...</p>}
      {!loading && !memberPlans.length && <p style={{ color: "var(--ink2)", fontSize: 13 }}>No members found.</p>}
      {memberPlans.map(({ uid, name, photo, sessions }) => {
        const sorted = sessions.slice().sort((a, b) => (a.start || "").localeCompare(b.start || ""));
        const key    = "m_" + name;
        return (
          <div key={uid} style={{ background: "var(--surface)", borderRadius: 10, padding: "14px 16px", marginBottom: 12, border: "1px solid var(--border)", boxShadow: "0 1px 6px rgba(0,0,0,.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: sessions.length ? 10 : 0 }}>
              {photo
                ? <img src={photo} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                : <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</div>}
              <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", flex: 1 }}>{name}</span>
              <span style={{ fontSize: 12, color: "var(--ink2)" }}>{sessions.length} session{sessions.length !== 1 ? "s" : ""}</span>
              <button onClick={() => handleAddMember(name, sessions)} disabled={adding === key || !sessions.length}
                style={{ background: adding === key ? "var(--border)" : "#eaf0fb", color: "#2563eb", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: (sessions.length && adding !== key) ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}>
                {adding === key ? "Adding…" : "➕ Add to My Plans"}
              </button>
            </div>
            {!sessions.length ? (
              <p style={{ fontSize: 12, color: "var(--ink2)", margin: 0 }}>No sessions planned today.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {sorted.map(s => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "7px 10px", background: "var(--bg)", borderRadius: 8, gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 500, color: "var(--ink)" }}>{s.name}</span>
                      {s.subject && <span style={{ color: "var(--ink2)", fontSize: 11, marginLeft: 6 }}>({s.subject})</span>}
                    </div>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--ink2)", whiteSpace: "nowrap" }}>
                      {fmt12(s.start)} – {fmt12(s.end)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function fmt12(t) {
  if (!t) return "—";
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

const aBtn = (bg, color) => ({ background: bg, color, border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" });
