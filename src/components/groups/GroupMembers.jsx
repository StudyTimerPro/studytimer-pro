import React, { useEffect, useState } from "react";
import { kickMember, promoteMember, loadMemberWeeklyHours } from "../../firebase/groupsDb";

const GRID_CSS = `
.gm-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
@media (max-width: 640px) {
  .gm-grid { grid-template-columns: repeat(3, 1fr); }
}
`;

export default function GroupMembers({ members, onlineUids, user, group, isAdmin, showToast, onGroupUpdated }) {
  const [weeklyHours, setWeeklyHours] = useState({});

  useEffect(() => {
    loadMemberWeeklyHours(Object.keys(members)).then(setWeeklyHours).catch(() => {});
  }, [group.id]);

  const sorted = Object.entries(members).sort(([, a], [, b]) => {
    if (a.role === "admin" && b.role !== "admin") return -1;
    if (b.role === "admin" && a.role !== "admin") return 1;
    return a.name.localeCompare(b.name);
  });

  async function handleKick(uid, name) {
    if (!confirm(`Remove ${name} from the group?`)) return;
    try {
      await kickMember(uid, group.id);
      const next = { ...members };
      delete next[uid];
      onGroupUpdated({ id: group.id, members: next });
      showToast(`${name} removed`);
    } catch { showToast("Failed to remove member"); }
  }

  async function handlePromote(uid, name) {
    if (!confirm(`Make ${name} an admin?`)) return;
    try {
      await promoteMember(group.id, uid);
      onGroupUpdated({ id: group.id, members: { ...members, [uid]: { ...members[uid], role: "admin" } } });
      showToast(`${name} is now an admin`);
    } catch { showToast("Failed to promote"); }
  }

  return (
    <>
      <style>{GRID_CSS}</style>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "var(--ink)" }}>
        Members ({sorted.length})
      </h3>
      <div className="gm-grid">
        {sorted.map(([uid, m]) => (
          <MemberCard
            key={uid}
            uid={uid}
            m={m}
            isOnline={onlineUids.has(uid)}
            isMe={uid === user.uid}
            showAdminActions={isAdmin && uid !== user.uid && m.role !== "admin"}
            hrs={weeklyHours[uid]}
            onKick={handleKick}
            onPromote={handlePromote}
          />
        ))}
      </div>
    </>
  );
}

function MemberCard({ uid, m, isOnline, isMe, showAdminActions, hrs, onKick, onPromote }) {
  return (
    <div style={{
      background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)",
      padding: "16px 10px 12px", display: "flex", flexDirection: "column",
      alignItems: "center", gap: 6, textAlign: "center",
    }}>
      <div style={{ position: "relative", marginTop: 6 }}>
        {m.photo
          ? <img src={m.photo} alt="" style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover" }} />
          : <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>👤</div>
        }
        <div style={{
          position: "absolute", bottom: 2, right: 2,
          width: 13, height: 13, borderRadius: "50%",
          background: isOnline ? "#22c55e" : "var(--border)",
          border: "2.5px solid var(--surface)",
        }} />
        {m.role === "admin" && (
          <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", fontSize: 14 }}>
            👑
          </div>
        )}
      </div>

      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", lineHeight: 1.3, wordBreak: "break-word", width: "100%" }}>
        {m.name}
        {isMe && <span style={{ display: "block", fontSize: 11, color: "var(--ink2)", fontWeight: 400 }}>you</span>}
      </div>

      <div style={{ fontSize: 11, color: isOnline ? "#22c55e" : "var(--ink2)" }}>
        {isOnline ? "● Online" : "○ Offline"}
      </div>

      <div style={{ fontSize: 11, color: "var(--ink2)" }}>
        {hrs !== undefined ? `${hrs}h this week` : "—"}
      </div>

      {showAdminActions && (
        <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
          <button onClick={() => onPromote(uid, m.name)} title="Promote to admin" style={smBtn("#eaf0fb", "#2563eb")}>↑</button>
          <button onClick={() => onKick(uid, m.name)}    title="Remove member"    style={smBtn("#fde8e8", "#e63946")}>✕</button>
        </div>
      )}
    </div>
  );
}

const smBtn = (bg, color) => ({
  background: bg, color, border: "none", borderRadius: 6,
  padding: "4px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer",
});
