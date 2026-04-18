import React, { useEffect, useState } from "react";
import { listenOnlineMembers, listenChat, setupPresence, updateGroup, leaveGroup, sendMessage, setPinnedMessage, listenJoinRequests, listenGroupPlans, deleteGroup } from "../../firebase/groupsDb";
import { listenLibraryItems } from "../../firebase/groupsLibrary";
import { notifyAnnouncement } from "../../utils/notificationHelper";
import useStore from "../../store/useStore";
import GroupPlans          from "./GroupPlans";
import GroupMembers        from "./GroupMembers";
import GroupChat           from "./GroupChat";
import GroupLibrary        from "./GroupLibrary";
import GroupNotifications  from "./GroupNotifications";
import GroupEditModal      from "./GroupEditModal";
import { LoadingOverlay }  from "../common/LoadingAnimation";

export default function GroupView({ group, user, showToast, onGroupUpdated, onLeave }) {
  const [tab,          setTab]          = useState("members");
  const [onlineUids,   setOnlineUids]   = useState(new Set());
  const [messages,     setMessages]     = useState([]);
  const [editOpen,     setEditOpen]     = useState(false);
  const [editForm,     setEditForm]     = useState({});
  const [busy,         setBusy]         = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [pendingJoin,  setPendingJoin]  = useState([]);
  const [pendingLib,   setPendingLib]   = useState([]);
  const [pendingPlans, setPendingPlans] = useState([]);
  const [annOpen,      setAnnOpen]      = useState(false);
  const [annTitle,     setAnnTitle]     = useState("");
  const [annMsg,       setAnnMsg]       = useState("");
  const [annBusy,      setAnnBusy]      = useState(false);

  const {
    setCurrentGroupId, setCurrentGroupRole, setCurrentGroupName, setCurrentGroupMembers,
    setGroupPendingCount, showGroupNotif, setShowGroupNotif,
  } = useStore();

  const isAdmin   = group.members?.[user.uid]?.role === "admin";
  const isCreator = group.createdBy === user.uid;
  const members   = group.members || {};
  const memberCount = Object.keys(members).length;

  useEffect(() => {
    const role = isCreator ? "creator" : (group.members?.[user.uid]?.role || "member");
    setCurrentGroupId(group.id);
    setCurrentGroupRole(role);
    setCurrentGroupName(group.name);
    setCurrentGroupMembers(members);
    return () => {
      setCurrentGroupId(null); setCurrentGroupRole(null);
      setCurrentGroupName(""); setCurrentGroupMembers({});
      setGroupPendingCount(0); setShowGroupNotif(false);
    };
  }, [group.id, group.name, user.uid]);

  useEffect(() => {
    setGroupPendingCount(pendingJoin.length + pendingLib.length + pendingPlans.length);
  }, [pendingJoin.length, pendingLib.length, pendingPlans.length]);

  useEffect(() => {
    let cancelPresence;
    setupPresence(user.uid, group.id).then(fn => { cancelPresence = fn; });
    const unsub = listenOnlineMembers(group.id, setOnlineUids);
    return () => { cancelPresence?.(); unsub(); };
  }, [group.id, user.uid]);

  useEffect(() => {
    if (tab !== "chat") return;
    const unsub = listenChat(group.id, setMessages);
    return () => unsub();
  }, [tab, group.id]);

  useEffect(() => {
    if (!isAdmin && !isCreator) return;
    const u1 = listenJoinRequests(group.id, setPendingJoin);
    const u2 = listenGroupPlans(group.id, plans => setPendingPlans(plans.filter(p => !p.approved)));
    const u3 = listenLibraryItems(group.id, items => setPendingLib(items.filter(i => !i.approved)));
    return () => { u1(); u2(); u3(); };
  }, [group.id, isAdmin, isCreator]);

  async function handleSaveEdit() {
    if (!editForm.name?.trim()) { showToast("Name required"); return; }
    setBusy(true);
    try {
      const updates = { name: editForm.name.trim(), description: editForm.description || "", banner: editForm.banner || group.banner, photoURL: editForm.photoURL || group.photoURL || "" };
      await updateGroup(group.id, updates);
      onGroupUpdated({ id: group.id, ...updates });
      setEditOpen(false); showToast("Group updated!");
    } catch { showToast("Update failed"); }
    finally { setBusy(false); }
  }

  function openEdit() {
    setEditForm({ name: group.name, description: group.description || "", banner: group.banner || "#2d6a4f", photoURL: group.photoURL || "" });
    setEditOpen(true);
  }

  async function handleLeave() {
    if (!confirm(`Leave "${group.name}"?`)) return;
    await leaveGroup(user.uid, group.id); onLeave();
  }

  async function handleDelete() {
    setDeleting(true);
    try { await deleteGroup(group.id, user.uid); onLeave(); }
    catch (err) { showToast(err.message || "Delete failed"); setDeleting(false); }
  }

  function handleShare() {
    const code = group.inviteCode || "";
    navigator.clipboard.writeText(code)
      .then(() => showToast(`Invite code copied: ${code}`))
      .catch(() => showToast(`Invite code: ${code}`));
  }

  async function handleAnnouncement() {
    if (!annTitle.trim() || !annMsg.trim()) { showToast("Enter title and message"); return; }
    setAnnBusy(true);
    try {
      const title = annTitle.trim();
      const msg   = annMsg.trim();
      const memberUids = Object.keys(members);
      await notifyAnnouncement(memberUids, title, msg, group.name, group.id);
      await sendMessage(group.id, user.uid, user, `${title}\n${msg}`, [], "announcement");
      await setPinnedMessage(group.id, { text: `${title}\n${msg}`, uid: user.uid, name: user.displayName || "Admin", createdAt: Date.now(), type: "announcement" });
      showToast("Announcement sent ✓");
      setAnnTitle(""); setAnnMsg(""); setAnnOpen(false);
      setTab("chat");
    } catch { showToast("Failed to send"); }
    finally { setAnnBusy(false); }
  }

  const TABS = ["members", "plans", "library", "chat"];
  const TAB_LABELS = { members: "👤 Members", plans: "📅 Plans", library: "📚 Library", chat: "💬 Chat" };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      {deleting && <LoadingOverlay message="Deleting group…" />}

      <div style={{ background: group.banner || "var(--accent)", padding: "14px 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <GroupAvatar group={group} size={60} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 19, color: "white", lineHeight: 1.2 }}>{group.name}</div>
              {group.description && <div style={{ fontSize: 12, color: "rgba(255,255,255,.8)", marginTop: 3 }}>{group.description}</div>}
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", marginTop: 5 }}>
                {memberCount} member{memberCount !== 1 ? "s" : ""} &nbsp;·&nbsp; 🟢 {onlineUids.size} online
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {(isAdmin || isCreator) && <TopBtn onClick={() => setAnnOpen(true)}>📢 Notify</TopBtn>}
            <TopBtn onClick={handleShare}>🔗 Invite</TopBtn>
            {(isAdmin || isCreator) && (
              <button onClick={openEdit} title="Edit Group"
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "white", padding: "4px 6px", lineHeight: 1 }}>
                ✏️
              </button>
            )}
            {!isCreator && <TopBtn onClick={handleLeave} danger>Leave</TopBtn>}
          </div>
        </div>
      </div>

      <div style={{ background: "var(--surface)", borderBottom: "2px solid var(--border)", display: "flex", padding: "0 16px", flexShrink: 0, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: "11px 16px", fontFamily: "inherit", fontSize: 13, fontWeight: 500, background: "none", border: "none", borderBottom: tab === t ? "3px solid var(--accent)" : "3px solid transparent", marginBottom: -2, color: tab === t ? "var(--accent)" : "var(--ink2)", cursor: "pointer", whiteSpace: "nowrap" }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: tab === "chat" ? "hidden" : "auto", display: "flex", flexDirection: "column", padding: tab === "chat" ? 0 : 16 }}>
        {tab === "members" && <GroupMembers members={members} onlineUids={onlineUids} user={user} group={group} isAdmin={isAdmin} showToast={showToast} onGroupUpdated={onGroupUpdated} />}
        {tab === "plans"   && <GroupPlans   members={members} groupId={group.id} groupName={group.name} isAdmin={isAdmin} user={user} />}
        {tab === "library" && <GroupLibrary groupId={group.id} user={user} isAdmin={isAdmin} showToast={showToast} />}
        {tab === "chat"    && <GroupChat    group={group} user={user} messages={messages} />}
      </div>

      {showGroupNotif && (isAdmin || isCreator) && (
        <GroupNotifications groupId={group.id} joinRequests={pendingJoin} pendingPlans={pendingPlans}
          pendingLibrary={pendingLib} onClose={() => setShowGroupNotif(false)} showToast={showToast}
          groupName={group.name} members={members} />
      )}

      {editOpen && (
        <GroupEditModal groupId={group.id} editForm={editForm} setEditForm={setEditForm}
          onClose={() => setEditOpen(false)} onSave={handleSaveEdit} busy={busy}
          onDelete={isCreator ? handleDelete : null} />
      )}

      {annOpen && (
        <div onClick={e => e.target === e.currentTarget && setAnnOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: 24, width: "min(400px,92vw)", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>📢 Send Announcement</h3>
            <input value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="Title (required)"
              style={{ width: "100%", padding: "9px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit", boxSizing: "border-box" }} />
            <textarea value={annMsg} onChange={e => setAnnMsg(e.target.value)} placeholder="Message (required)" rows={4}
              style={{ width: "100%", padding: "9px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit", boxSizing: "border-box", marginTop: 8, resize: "vertical" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => setAnnOpen(false)} style={{ background: "none", border: "1.5px solid var(--border)", borderRadius: 8, padding: "9px 18px", fontSize: 14, cursor: "pointer", color: "var(--ink)" }}>Cancel</button>
              <button onClick={handleAnnouncement} disabled={annBusy}
                style={{ background: annBusy ? "var(--border)" : "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "9px 22px", fontSize: 14, fontWeight: 600, cursor: annBusy ? "not-allowed" : "pointer" }}>
                {annBusy ? "Sending…" : "Send Announcement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupAvatar({ group, size }) {
  return group.photoURL
    ? <img src={group.photoURL} alt="" loading="lazy" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,.4)", flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: "50%", background: "rgba(255,255,255,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, color: "white", fontWeight: 700, border: "2px solid rgba(255,255,255,.4)", flexShrink: 0 }}>{(group.name || "G").charAt(0).toUpperCase()}</div>;
}

function TopBtn({ onClick, children, danger }) {
  return (
    <button onClick={onClick}
      style={{ background: danger ? "rgba(220,38,38,.85)" : "rgba(255,255,255,.2)", color: "white", border: "1px solid rgba(255,255,255,.35)", borderRadius: 6, padding: "6px 11px", fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
      {children}
    </button>
  );
}
