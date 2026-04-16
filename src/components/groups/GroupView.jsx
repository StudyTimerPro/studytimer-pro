import React, { useEffect, useState } from "react";
import { listenOnlineMembers, listenChat, setOnlineStatus, updateGroup, leaveGroup, notifyAll } from "../../firebase/groupsDb";
import GroupPlans   from "./GroupPlans";
import GroupMembers from "./GroupMembers";
import GroupChat    from "./GroupChat";

const BANNERS = ["#2d6a4f","#2563eb","#7c3aed","#dc2626","#d97706","#0891b2","#1a1814","#db2777"];

export default function GroupView({ group, user, showToast, onGroupUpdated, onLeave, onRefresh }) {
  const [tab,        setTab]        = useState("members"); // Members is first tab
  const [onlineUids, setOnlineUids] = useState(new Set());
  const [messages,   setMessages]   = useState([]);
  const [editOpen,   setEditOpen]   = useState(false);
  const [editForm,   setEditForm]   = useState({});
  const [busy,       setBusy]       = useState(false);

  const isAdmin     = group.members?.[user.uid]?.role === "admin";
  const members     = group.members || {};
  const memberCount = Object.keys(members).length;

  // Real-time: online presence (always active while group is open)
  useEffect(() => {
    setOnlineStatus(user.uid, group.id, true);
    const unsub = listenOnlineMembers(group.id, setOnlineUids);
    return () => {
      setOnlineStatus(user.uid, group.id, false);
      unsub();
    };
  }, [group.id, user.uid]);

  // Real-time: chat — only while Chat tab is active
  useEffect(() => {
    if (tab !== "chat") return;
    const unsub = listenChat(group.id, setMessages);
    return () => unsub();
  }, [tab, group.id]);

  async function handleSaveEdit() {
    if (!editForm.name?.trim()) { showToast("Name required"); return; }
    setBusy(true);
    try {
      const updates = { name: editForm.name.trim(), description: editForm.description || "", banner: editForm.banner || group.banner };
      await updateGroup(group.id, updates);
      onGroupUpdated({ id: group.id, ...updates });
      setEditOpen(false);
      showToast("Group updated!");
    } catch { showToast("Update failed"); }
    finally { setBusy(false); }
  }

  async function handleLeave() {
    if (!confirm(`Leave "${group.name}"?`)) return;
    await leaveGroup(user.uid, group.id);
    onLeave();
  }

  async function handleNotify() {
    await notifyAll(group.id, user.displayName || "Admin");
    showToast("Notification sent to chat!");
    setTab("chat");
  }

  function handleShare() {
    const code = group.inviteCode || "";
    navigator.clipboard.writeText(code)
      .then(()  => showToast(`Invite code copied: ${code}`))
      .catch(()  => showToast(`Invite code: ${code}`));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>

      {/* ── Banner / Top bar ── */}
      <div style={{ background: group.banner || "#2d6a4f", padding: "14px 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 19, color: "white", lineHeight: 1.2 }}>{group.name}</div>
            {group.description && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.8)", marginTop: 3 }}>{group.description}</div>
            )}
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", marginTop: 5 }}>
              {memberCount} member{memberCount !== 1 ? "s" : ""} &nbsp;·&nbsp; 🟢 {onlineUids.size} online
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {isAdmin && (
              <TopBtn onClick={() => { setEditForm({ name: group.name, description: group.description || "", banner: group.banner || "#2d6a4f" }); setEditOpen(true); }}>✏ Edit</TopBtn>
            )}
            <TopBtn onClick={handleShare}>🔗 Invite</TopBtn>
            {isAdmin && <TopBtn onClick={handleNotify}>📢 Notify</TopBtn>}
            <TopBtn onClick={onRefresh}>↺ Refresh</TopBtn>
            <TopBtn onClick={handleLeave} danger>Leave</TopBtn>
          </div>
        </div>
      </div>

      {/* ── Tab bar: Members → Plans → Chat ── */}
      <div style={{ background: "white", borderBottom: "2px solid #ddd9d2", display: "flex", padding: "0 16px", flexShrink: 0 }}>
        {["members", "plans", "chat"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: "11px 18px", fontFamily: "inherit", fontSize: 13, fontWeight: 500, background: "none", border: "none", borderBottom: tab === t ? "3px solid #2d6a4f" : "3px solid transparent", marginBottom: -2, color: tab === t ? "#2d6a4f" : "#6b6560", cursor: "pointer" }}>
            {t === "members" ? "👤 Members" : t === "plans" ? "📅 Plans" : "💬 Chat"}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={{ flex: 1, overflow: tab === "chat" ? "hidden" : "auto", display: "flex", flexDirection: "column", padding: tab === "chat" ? 0 : 16 }}>
        {tab === "members" && <GroupMembers members={members} onlineUids={onlineUids} user={user} group={group} isAdmin={isAdmin} showToast={showToast} onGroupUpdated={onGroupUpdated} />}
        {tab === "plans"   && <GroupPlans   members={members} groupId={group.id} />}
        {tab === "chat"    && <GroupChat    group={group} user={user} messages={messages} />}
      </div>

      {/* ── Edit modal ── */}
      {editOpen && (
        <div onClick={e => e.target === e.currentTarget && setEditOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 14, padding: 24, width: "min(400px,92vw)", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18 }}>Edit Group</h3>
            <EField label="Name">
              <input value={editForm.name || ""} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={inputS} />
            </EField>
            <EField label="Description">
              <input value={editForm.description || ""} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Optional" style={inputS} />
            </EField>
            <EField label="Banner Color">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {BANNERS.map(c => (
                  <div key={c} onClick={() => setEditForm({ ...editForm, banner: c })}
                    style={{ width: 28, height: 28, borderRadius: 6, background: c, cursor: "pointer", border: editForm.banner === c ? "3px solid #1a1814" : "2px solid transparent" }} />
                ))}
              </div>
            </EField>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setEditOpen(false)} style={cancelBtn}>Cancel</button>
              <button onClick={handleSaveEdit} disabled={busy}
                style={{ background: busy ? "#aaa" : "#2d6a4f", color: "white", border: "none", borderRadius: 8, padding: "9px 22px", fontSize: 14, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer" }}>
                {busy ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TopBtn({ onClick, children, danger }) {
  return (
    <button onClick={onClick}
      style={{ background: danger ? "rgba(220,38,38,.85)" : "rgba(255,255,255,.2)", color: "white", border: "1px solid rgba(255,255,255,.35)", borderRadius: 6, padding: "6px 11px", fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
      {children}
    </button>
  );
}

function EField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b6560", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputS    = { width: "100%", padding: "9px 12px", border: "1.5px solid #ddd9d2", borderRadius: 8, fontSize: 14, background: "#f0ede8", fontFamily: "inherit", boxSizing: "border-box" };
const cancelBtn = { background: "none", border: "1.5px solid #ddd9d2", borderRadius: 8, padding: "9px 18px", fontSize: 14, cursor: "pointer" };
