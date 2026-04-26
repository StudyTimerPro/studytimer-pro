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

      <div className="stp-gv-head" style={{ "--banner-bg": group.banner || "var(--accent)" }}>
        <div className="stp-gv-row">
          <div className="stp-gv-id">
            <GroupAvatar group={group} size={56} />
            <div style={{ minWidth:0 }}>
              <div className="stp-gv-name">{group.name}</div>
              {group.description && <div className="stp-gv-desc">{group.description}</div>}
              <div className="stp-gv-meta">
                {memberCount} member{memberCount !== 1 ? "s" : ""} · ● {onlineUids.size} online
              </div>
            </div>
          </div>
          <div className="stp-gv-actions">
            {(isAdmin || isCreator) && <button className="stp-gv-btn" onClick={() => setAnnOpen(true)}>📢 Notify</button>}
            <button className="stp-gv-btn" onClick={handleShare}>🔗 Invite</button>
            {(isAdmin || isCreator) && (
              <button className="stp-gv-btn icon" onClick={openEdit} title="Edit Group">✏️</button>
            )}
            {!isCreator && <button className="stp-gv-btn danger" onClick={handleLeave}>Leave</button>}
          </div>
        </div>
      </div>

      <div className="stp-gv-tabs">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? "on" : ""}>
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
        <div onClick={e => e.target === e.currentTarget && setAnnOpen(false)} className="stp-gs-modal-scrim">
          <div className="stp-gs-modal">
            <h3>📢 Send <em>announcement</em></h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink2)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Title</label>
              <input value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="Title (required)"
                style={{ width: "100%", padding: "9px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 6 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink2)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Message</label>
              <textarea value={annMsg} onChange={e => setAnnMsg(e.target.value)} placeholder="Message (required)" rows={4}
                style={{ width: "100%", padding: "9px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setAnnOpen(false)} className="stp-gs-btn ghost" style={{ flex: "0 0 auto", minWidth: 90 }}>Cancel</button>
              <button onClick={handleAnnouncement} disabled={annBusy}
                className="stp-gs-btn primary" style={{ flex: "0 0 auto", minWidth: 130, opacity: annBusy ? .55 : 1 }}>
                {annBusy ? "Sending…" : "Send"}
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

