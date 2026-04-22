import React, { useState, useEffect, useRef } from "react";
import { db } from "../../firebase/config";
import { ref, onValue, off, update } from "firebase/database";
import useStore from "../../store/useStore";
import { notifyAnnouncement } from "../../utils/notificationHelper";

/* Redesigned notification bell — refined dropdown, sage accent, subtle unread row.
   Same store / firebase contract as before. */

const TYPE_ICONS = {
  session:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  join_approved: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>,
  like:          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  mention:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>,
  announcement:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11l18-8-8 18-2-8-8-2z"/></svg>,
};

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
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
      const list = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.createdAt - a.createdAt);
      setNotifications(list);
      setUnreadNotifCount(list.filter(n => !n.read).length);
    });
    return () => off(r);
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function markRead(n) {
    if (n.read) return;
    await update(ref(db, `users/${uid}/notifications/${n.id}`), { read: true });
  }

  async function markAllRead() {
    const u = {};
    notifications
      .filter(n => !n.read)
      .forEach(n => { u[`users/${uid}/notifications/${n.id}/read`] = true; });
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
    } catch (err) {
      // BUG FIX: previously `catch {}` swallowed the error silently, making
      // announcement failures impossible to debug in production.
      console.error("handleAnnouncement failed:", err);
      showToast("Failed to send");
    } finally {
      setAnnBusy(false);
    }
  }

  const isGroupAdmin = currentGroupId && (currentGroupRole === "admin" || currentGroupRole === "creator");
  const totalBadge   = unreadNotifCount + (isGroupAdmin ? groupPendingCount : 0);

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      <button className="stp-icon-btn" onClick={() => setOpen(o => !o)} title="Notifications">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {totalBadge > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4, background: "var(--warn)", color: "white",
            borderRadius: "999px", fontSize: 10, fontWeight: 700, minWidth: 16, height: 16,
            padding: "0 4px", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 0 2px var(--surface)",
          }}>
            {totalBadge > 99 ? "99+" : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div className="stp-notifs">
          <div className="stp-nf-head">
            <div className="t">Notifications</div>
            {unreadNotifCount > 0 && <button className="mark" onClick={markAllRead}>Mark all read</button>}
          </div>

          {isGroupAdmin && (
            <div style={{ borderBottom: "1px solid var(--border)", padding: "10px 16px 12px" }}>
              <button
                onClick={() => setShowAnn(a => !a)}
                style={{ background: "none", border: "none", padding: 0, fontSize: 13, fontWeight: 600, color: "var(--accent)", cursor: "pointer" }}>
                📢 Send announcement
              </button>
              {showAnn && (
                <div style={{ marginTop: 8 }}>
                  <input
                    className="stp-input"
                    value={annTitle}
                    onChange={e => setAnnTitle(e.target.value)}
                    placeholder="Title..."
                  />
                  <textarea
                    className="stp-input"
                    value={annMsg}
                    onChange={e => setAnnMsg(e.target.value)}
                    placeholder="Message to all members..."
                    rows={3}
                    style={{ marginTop: 6, resize: "vertical", fontFamily: "inherit" }}
                  />
                  <button
                    className="stp-btn primary"
                    onClick={handleAnnouncement}
                    disabled={annBusy}
                    style={{ marginTop: 8, width: "100%", justifyContent: "center" }}>
                    {annBusy ? "Sending…" : "Send to all members"}
                  </button>
                </div>
              )}
              {groupPendingCount > 0 && (
                <button
                  onClick={() => { setShowGroupNotif(true); setOpen(false); }}
                  style={{ marginTop: 8, background: "none", border: "none", fontSize: 13, color: "var(--ink)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: 0 }}>
                  Group requests
                  <span style={{ background: "var(--warn)", color: "white", borderRadius: 8, padding: "1px 6px", fontSize: 11, fontWeight: 700 }}>
                    {groupPendingCount}
                  </span>
                </button>
              )}
            </div>
          )}

          <div className="stp-nf-list">
            {notifications.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--ink2)", fontSize: 13 }}>
                No new notifications
              </div>
            ) : (
              notifications.slice(0, 30).map(n => (
                <div key={n.id} onClick={() => markRead(n)} className={`stp-nf-item ${n.read ? "" : "unread"}`}>
                  <div className="stp-nf-ic">
                    {TYPE_ICONS[n.type] || (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      </svg>
                    )}
                  </div>
                  <div className="stp-nf-body">
                    <div className="stp-nf-title">{n.title}</div>
                    <div className="stp-nf-msg">{n.message}</div>
                    <div className="stp-nf-time">{timeAgo(n.createdAt)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
