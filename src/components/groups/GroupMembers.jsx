import React from "react";
import { kickMember, promoteMember } from "../../firebase/groupsDb";

export default function GroupMembers({ members, onlineUids, user, group, isAdmin, showToast, onGroupUpdated }) {
  const sorted = Object.entries(members).sort(([, a], [, b]) => {
    if (a.role === "admin" && b.role !== "admin") return -1;
    if (b.role === "admin" && a.role !== "admin") return 1;
    return a.name.localeCompare(b.name);
  });

  async function handleKick(uid, name) {
    if (!confirm(`Remove ${name} from the group?`)) return;
    try {
      await kickMember(uid, group.id);
      const newMembers = { ...members };
      delete newMembers[uid];
      onGroupUpdated({ id: group.id, members: newMembers });
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
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "#1a1814" }}>
        Members ({sorted.length})
      </h3>
      {sorted.map(([uid, m]) => {
        const isOnline = onlineUids.has(uid);
        const isMe     = uid === user.uid;
        return (
          <div key={uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "white", borderRadius: 10, marginBottom: 8, border: "1px solid #ddd9d2" }}>
            {/* Avatar + online dot */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              {m.photo
                ? <img src={m.photo} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                : <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#ddd9d2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>👤</div>}
              <div style={{ position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: "50%", background: isOnline ? "#27ae60" : "#ccc", border: "2px solid white" }} />
            </div>

            {/* Name + status */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1814" }}>
                {m.name}
                {isMe && <span style={{ color: "#6b6560", fontWeight: 400, fontSize: 12 }}> (you)</span>}
              </div>
              <div style={{ fontSize: 12, color: isOnline ? "#27ae60" : "#aaa", marginTop: 1 }}>
                {isOnline ? "🟢 Online" : "⚫ Offline"}
              </div>
            </div>

            {/* Role badge */}
            {m.role === "admin" && (
              <span style={{ fontSize: 10, fontWeight: 700, background: "#fff3e0", color: "#e67e22", padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
                ADMIN
              </span>
            )}

            {/* Admin actions (not for self, not for other admins) */}
            {isAdmin && !isMe && m.role !== "admin" && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => handlePromote(uid, m.name)} style={smBtn("#eaf0fb","#2563eb")}>Promote</button>
                <button onClick={() => handleKick(uid, m.name)}    style={smBtn("#fde8e8","#e63946")}>Remove</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const smBtn = (bg, color) => ({
  background: bg, color, border: "none", borderRadius: 6,
  padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
});
