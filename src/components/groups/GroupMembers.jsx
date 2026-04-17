import React, { useEffect, useState } from "react";
import { kickMember, promoteMember, demoteMember, loadMemberWeeklyHours } from "../../firebase/groupsDb";
import { db } from "../../firebase/config";
import { ref, get } from "firebase/database";

const GRID_CSS = `
.gm-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
@media (max-width: 640px) { .gm-grid { grid-template-columns: repeat(3, 1fr); } }
`;

export default function GroupMembers({ members, onlineUids, user, group, isAdmin, showToast, onGroupUpdated }) {
  const [weeklyHours,  setWeeklyHours]  = useState({});
  const [fetchedNames, setFetchedNames] = useState({});
  const [fetchedPhotos,setFetchedPhotos]= useState({});
  const isCreator = user.uid === group.createdBy;

  useEffect(() => {
    loadMemberWeeklyHours(Object.keys(members)).then(setWeeklyHours).catch(() => {});
  }, [group.id]);

  useEffect(() => {
    const missingNames  = Object.entries(members).filter(([, m]) => !m.name).map(([uid]) => uid);
    const missingPhotos = Object.entries(members).filter(([, m]) => !m.photo).map(([uid]) => uid);

    if (missingNames.length) {
      Promise.all(missingNames.map(uid =>
        get(ref(db, `groups/${group.id}/members/${uid}`)).then(s => ({ uid, data: s.val() }))
      )).then(rs => {
        const u = {}; rs.forEach(({ uid, data }) => { if (data?.name) u[uid] = data.name; });
        if (Object.keys(u).length) setFetchedNames(p => ({ ...p, ...u }));
      }).catch(() => {});
    }

    if (missingPhotos.length) {
      Promise.all(missingPhotos.map(uid =>
        get(ref(db, `users/${uid}/photo`)).then(s => ({ uid, photo: s.val() || "" }))
      )).then(rs => {
        const u = {}; rs.forEach(({ uid, photo }) => { if (photo) u[uid] = photo; });
        if (Object.keys(u).length) setFetchedPhotos(p => ({ ...p, ...u }));
      }).catch(() => {});
    }
  }, [group.id, members]);

  const sorted = Object.entries(members).sort(([, a], [, b]) => {
    if (a.role === "admin" && b.role !== "admin") return -1;
    if (b.role === "admin" && a.role !== "admin") return 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  async function handleKick(uid, name) {
    if (!confirm(`Remove ${name} from the group?`)) return;
    try {
      await kickMember(uid, group.id);
      const next = { ...members }; delete next[uid];
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

  async function handleDemote(uid, name) {
    if (!confirm(`Demote ${name} to member?`)) return;
    try {
      await demoteMember(group.id, uid);
      onGroupUpdated({ id: group.id, members: { ...members, [uid]: { ...members[uid], role: "member" } } });
      showToast(`${name} demoted to member`);
    } catch { showToast("Failed to demote"); }
  }

  return (
    <>
      <style>{GRID_CSS}</style>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "var(--ink)" }}>Members ({sorted.length})</h3>
      <div className="gm-grid">
        {sorted.map(([uid, m]) => {
          const name  = m.name || fetchedNames[uid] || "Member";
          const photo = m.photo || fetchedPhotos[uid] || "";
          const isMe  = uid === user.uid;
          const showPromote = isAdmin && !isMe && m.role !== "admin";
          const showDemote  = isCreator && !isMe && m.role === "admin" && uid !== group.createdBy;
          const showRemove  = (isAdmin || isCreator) && !isMe;
          return (
            <MemberCard key={uid} uid={uid} name={name} photo={photo} role={m.role}
              isOnline={onlineUids.has(uid)} isMe={isMe} hrs={weeklyHours[uid]}
              showPromote={showPromote} showDemote={showDemote} showRemove={showRemove}
              onPromote={() => handlePromote(uid, name)}
              onDemote={() => handleDemote(uid, name)}
              onKick={() => handleKick(uid, name)}
            />
          );
        })}
      </div>
    </>
  );
}

function MemberCard({ uid, name, photo, role, isOnline, isMe, hrs, showPromote, showDemote, showRemove, onPromote, onDemote, onKick }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: "16px 10px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
      <div style={{ position: "relative", marginTop: 6 }}>
        {photo
          ? <img src={photo} alt="" style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover" }} />
          : <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "white", fontWeight: 700 }}>{(name || "?").charAt(0).toUpperCase()}</div>
        }
        <div style={{ position: "absolute", bottom: 2, right: 2, width: 13, height: 13, borderRadius: "50%", background: isOnline ? "#22c55e" : "var(--border)", border: "2.5px solid var(--surface)" }} />
        {role === "admin" && <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", fontSize: 14 }}>👑</div>}
      </div>
      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", lineHeight: 1.3, wordBreak: "break-word", width: "100%" }}>
        {name}
        {isMe && <span style={{ display: "block", fontSize: 11, color: "var(--ink2)", fontWeight: 400 }}>you</span>}
      </div>
      <div style={{ fontSize: 11, color: isOnline ? "#22c55e" : "var(--ink2)" }}>{isOnline ? "● Online" : "○ Offline"}</div>
      <div style={{ fontSize: 11, color: "var(--ink2)" }}>{hrs !== undefined ? `${hrs}h this week` : "—"}</div>
      {(showPromote || showDemote || showRemove) && (
        <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap", justifyContent: "center" }}>
          {showPromote && <button onClick={onPromote} title="Promote to admin" style={smBtn("#eaf0fb","#2563eb")}>↑</button>}
          {showDemote  && <button onClick={onDemote}  title="Demote to member" style={smBtn("#fff3e0","#d97706")}>↓</button>}
          {showRemove  && <button onClick={onKick}    title="Remove member"    style={smBtn("#fde8e8","#e63946")}>✕</button>}
        </div>
      )}
    </div>
  );
}

const smBtn = (bg, color) => ({ background: bg, color, border: "none", borderRadius: 6, padding: "4px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer" });
