import React, { useEffect, useState } from "react";
import { getUserGroups, shareGroupPlan } from "../../firebase/groupsDb";
import { exportPlan } from "../../firebase/db";

export default function ShareToGroupModal({ planId, planName, examId, user, onClose, showToast }) {
  const [groups,  setGroups]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(null);

  useEffect(() => {
    getUserGroups(user.uid).then(setGroups).catch(() => {}).finally(() => setLoading(false));
  }, [user.uid]);

  async function handleShare(group) {
    setSharing(group.id);
    try {
      const data = await exportPlan(user.uid, examId, planId);
      if (!data) { showToast("Plan has no sessions to share"); setSharing(null); return; }
      const sessions = Array.isArray(data.plan?.sessions)
        ? data.plan.sessions.map(({ id, ...rest }) => rest)
        : Object.values(data.plan?.sessions || {});
      if (!sessions.length) { showToast("No sessions found in this plan"); setSharing(null); return; }
      const status = await shareGroupPlan(user.uid, user.displayName || "User", group.id, { name: planName, sessions });
      showToast(status === "approved" ? "Plan shared ✓" : "Plan submitted for admin approval ✓");
      onClose();
    } catch (err) {
      console.error("shareGroupPlan error:", err);
      showToast("Share failed: " + (err?.message || "Unknown error"));
      setSharing(null);
    }
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 14, padding: 24, width: "min(380px,100%)", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: "var(--ink)" }}>📤 Share to Group</h3>
        <p style={{ fontSize: 12, color: "var(--ink2)", marginBottom: 16 }}>
          Sharing <strong style={{ color: "var(--ink)" }}>"{planName}"</strong> — admins auto-approve, members go pending.
        </p>

        {loading && <p style={{ color: "var(--ink2)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Loading groups…</p>}

        {!loading && !groups.length && (
          <p style={{ color: "var(--ink2)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>You haven't joined any groups yet.</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
          {groups.map(g => {
            const isAdmin   = g.members?.[user.uid]?.role === "admin";
            const isBusy    = sharing === g.id;
            const memberCnt = Object.keys(g.members || {}).length;
            return (
              <button key={g.id} onClick={() => !sharing && handleShare(g)} disabled={!!sharing}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, cursor: sharing ? "not-allowed" : "pointer", textAlign: "left", opacity: sharing && !isBusy ? 0.5 : 1 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: g.banner || "var(--accent)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: "var(--ink2)", marginTop: 2 }}>
                    {memberCnt} member{memberCnt !== 1 ? "s" : ""} &nbsp;·&nbsp;
                    <span style={{ color: isAdmin ? "#22c55e" : "#f59e0b" }}>
                      {isAdmin ? "✓ auto-approve" : "⏳ pending approval"}
                    </span>
                  </div>
                </div>
                {isBusy && <span style={{ fontSize: 12, color: "var(--ink2)" }}>Sharing…</span>}
              </button>
            );
          })}
        </div>

        <button onClick={onClose} style={{ marginTop: 16, width: "100%", padding: 10, border: "1.5px solid var(--border)", borderRadius: 8, background: "none", color: "var(--ink)", cursor: "pointer", fontSize: 13 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
