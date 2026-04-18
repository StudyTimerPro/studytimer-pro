import React, { useState, useEffect, useRef } from "react";
import { db } from "../../firebase/config";
import { ref, onValue, off, update } from "firebase/database";
import useStore from "../../store/useStore";
import { notifyAnnouncement } from "../../utils/notificationHelper";

const TYPE_ICONS = { session: "📌", join_approved: "✅", like: "❤️", mention: "@", announcement: "📢" };

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationBell({ uid }) {
  const {
    notifications, setNotifications, unreadNotifCount, setUnreadNotifCount, showToast,
    currentGroupId, currentGroupRole, currentGroupName, currentGroupMembers,
    groupPendingCount, setShowGroupNotif,
  } = useStore();
  const [open,     setOpen]     = useState(false);
  const [showAnn,  setShowAnn]  = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annMsg,   setAnnMsg]   = useState("");
  const [annBusy,  setAnnBusy]  = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!uid) return;
    const r = ref(db, `users/${uid}/notifications`);
    onValue(r, snap => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.createdAt - a.createdAt);
      setNotifications(list);
      setUnreadNotifCount(list.filter(n => !n.read).length);
    });
    return () => off(r);
  }, [uid]);

  useEffect(() => {
    if (!open) return;
    function close(e) { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function markRead(n) {
    if (n.read) return;
    await update(ref(db, `users/${uid}/notifications/${n.id}`), { read: true });
  }

  async function markAllRead() {
    const u = {};
    notifications.filter(n => !n.read).forEach(n => { u[`users/${uid}/notifications/${n.id}/read`] = true; });
    if (Object.keys(u).length) await update(ref(db), u);
  }

  async function handleAnnouncement() {
    if (!annTitle.trim() || !annMsg.trim()) { showToast("Enter title and message"); return; }
    setAnnBusy(true);
    try {
      const uids = Object.keys(currentGroupMembers || {});
      await notifyAnnouncement(uids, annTitle.trim(), annMsg.trim(), currentGroupName, currentGroupId);
      showToast("Announcement sent ✓");
      setAnnTitle(""); setAnnMsg(""); setShowAnn(false); setOpen(false);
    } catch { showToast("Failed to send"); }
    finally { setAnnBusy(false); }
  }

  const isGroupAdmin = currentGroupId && (currentGroupRole === "admin" || currentGroupRole === "creator");
  const totalBadge   = unreadNotifCount + (isGroupAdmin ? groupPendingCount : 0);

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, position: "relative", flexShrink: 0 }}>
        🔔
        {totalBadge > 0 && (
          <span style={{ position: "absolute", top: -3, right: -3, background: "#e63946", color: "white", borderRadius: "50%", fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", lineHeight: 1 }}>
            {totalBadge > 99 ? "99+" : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", right: 0, top: 44, width: "min(320px, 92vw)", background: "var(--surface)", borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,.25)", border: "1px solid var(--border)", zIndex: 1000, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>🔔 Notifications</span>
            {unreadNotifCount > 0 && (
              <button onClick={markAllRead} style={{ background: "none", border: "none", fontSize: 12, color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}>Mark all read</button>
            )}
          </div>

          {isGroupAdmin && (
            <div style={{ borderBottom: "1px solid var(--border)" }}>
              <button onClick={() => setShowAnn(a => !a)}
                style={{ width: "100%", background: "none", border: "none", padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "var(--accent)", cursor: "pointer" }}>
                📢 Send Announcement
              </button>
              {showAnn && (
                <div style={{ padding: "0 16px 12px" }}>
                  <input value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="Title..." style={inpS} />
                  <textarea value={annMsg} onChange={e => setAnnMsg(e.target.value)} placeholder="Message to all members..." rows={3}
                    style={{ ...inpS, marginTop: 6, resize: "vertical" }} />
                  <button onClick={handleAnnouncement} disabled={annBusy}
                    style={{ marginTop: 8, width: "100%", background: annBusy ? "var(--border)" : "var(--accent)", color: "white", border: "none", borderRadius: 6, padding: "8px", fontSize: 13, fontWeight: 600, cursor: annBusy ? "not-allowed" : "pointer" }}>
                    {annBusy ? "Sending…" : "Send to All Members"}
                  </button>
                </div>
              )}
              {groupPendingCount > 0 && (
                <button onClick={() => { setShowGroupNotif(true); setOpen(false); }}
                  style={{ width: "100%", background: "none", border: "none", padding: "8px 16px 10px", textAlign: "left", fontSize: 13, fontWeight: 500, color: "var(--ink)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  🔔 Group Requests
                  <span style={{ background: "#e63946", color: "white", borderRadius: 8, padding: "1px 6px", fontSize: 11, fontWeight: 700 }}>{groupPendingCount}</span>
                </button>
              )}
            </div>
          )}

          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--ink2)", fontSize: 13 }}>No new notifications</div>
            ) : (
              notifications.slice(0, 30).map(n => (
                <div key={n.id} onClick={() => markRead(n)}
                  style={{ display: "flex", gap: 10, padding: "11px 16px", borderBottom: "1px solid var(--border)", cursor: "pointer", background: n.read ? "transparent" : "rgba(37,99,235,.06)", transition: "background .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--bg)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = n.read ? "transparent" : "rgba(37,99,235,.06)"; }}>
                  <div style={{ fontSize: 20, lineHeight: 1.4, flexShrink: 0 }}>{TYPE_ICONS[n.type] || "🔔"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: "var(--ink)", marginBottom: 1 }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.message}</div>
                    <div style={{ fontSize: 10, color: "var(--ink2)", marginTop: 2 }}>{timeAgo(n.createdAt)}</div>
                  </div>
                  {!n.read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", alignSelf: "center", flexShrink: 0 }} />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const inpS = { width: "100%", padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 7, fontSize: 13, background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit", boxSizing: "border-box" };
