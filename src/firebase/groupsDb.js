import { db, storage } from "./config";
import { ref, set, get, push, update, remove, onValue, off, onDisconnect } from "firebase/database";
import { ref as sRef, listAll, deleteObject } from "firebase/storage";
import { notifyJoinApproved } from "../utils/notificationHelper";

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── Groups CRUD ──────────────────────────────────────────────
export async function createGroup(uid, user, { name, description, banner, icon }) {
  const gRef = push(ref(db, "groups"));
  const gid  = gRef.key;
  const code = makeCode();
  const me   = { name: user.displayName || "User", photo: user.photoURL || "", role: "admin", joinedAt: Date.now(), online: false };
  const data = { name, description: description || "", banner: banner || "#2d6a4f", icon: icon || "📚", inviteCode: code, createdBy: uid, createdAt: Date.now(), members: { [uid]: me } };
  await set(gRef, data);
  await set(ref(db, `inviteCodes/${code}`), gid);
  await set(ref(db, `users/${uid}/groups/${gid}`), Date.now());
  return { id: gid, ...data };
}

export async function joinGroup(uid, user, code) {
  const cSnap = await get(ref(db, `inviteCodes/${code.trim().toUpperCase()}`));
  if (!cSnap.exists()) return null;
  const gid   = cSnap.val();
  const mSnap = await get(ref(db, `groups/${gid}/members/${uid}`));
  if (!mSnap.exists()) {
    await update(ref(db, `groups/${gid}/members/${uid}`), {
      name: user.displayName || "User", photo: user.photoURL || "",
      role: "member", joinedAt: Date.now(), online: false,
    });
    await set(ref(db, `users/${uid}/groups/${gid}`), Date.now());
  }
  const snap = await get(ref(db, `groups/${gid}`));
  return snap.exists() ? { id: gid, ...snap.val() } : null;
}

export async function leaveGroup(uid, gid) {
  await remove(ref(db, `groups/${gid}/members/${uid}`));
  await remove(ref(db, `users/${uid}/groups/${gid}`));
}

export async function kickMember(memberUid, gid) {
  const creatorSnap = await get(ref(db, `groups/${gid}/createdBy`));
  if (creatorSnap.val() === memberUid) throw new Error("Cannot remove group creator");
  await remove(ref(db, `groups/${gid}/members/${memberUid}`));
  await remove(ref(db, `users/${memberUid}/groups/${gid}`));
}

export async function updateGroup(gid, data) {
  return update(ref(db, `groups/${gid}`), data);
}

export async function promoteMember(gid, memberUid) {
  return update(ref(db, `groups/${gid}/members/${memberUid}`), { role: "admin" });
}

export function demoteMember(gid, memberUid) {
  return update(ref(db, `groups/${gid}/members/${memberUid}`), { role: "member" });
}

// ── One-time data loads ──────────────────────────────────────
export async function getUserGroups(uid) {
  const snap = await get(ref(db, `users/${uid}/groups`));
  if (!snap.exists()) return [];
  const ids = Object.keys(snap.val());
  const list = await Promise.all(
    ids.map(id => get(ref(db, `groups/${id}`)).then(s => s.exists() ? { id, ...s.val() } : null))
  );
  return list.filter(Boolean);
}

export async function loadMemberPlans(members) {
  return Promise.all(
    Object.entries(members).map(async ([uid, m]) => {
      const snap     = await get(ref(db, `plans/${uid}/sessions`));
      const sessions = snap.exists()
        ? Object.entries(snap.val()).map(([id, v]) => ({ id, ...v }))
        : [];
      return { uid, name: m.name, photo: m.photo || "", sessions };
    })
  );
}

// ── Member weekly study hours ────────────────────────────────
export async function loadMemberWeeklyHours(uids) {
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - i * 86400000);
    return d.toISOString().split("T")[0];
  });
  const results = {};
  await Promise.all(uids.map(async uid => {
    let mins = 0;
    await Promise.all(dates.map(async date => {
      const snap = await get(ref(db, `wastage/${uid}/${date}`));
      if (snap.exists()) {
        Object.values(snap.val()).forEach(s => { if (!s.missed) mins += (s.duration || 0); });
      }
    }));
    results[uid] = Math.round(mins / 60 * 10) / 10;
  }));
  return results;
}

// ── Real-time: online presence ───────────────────────────────
export function listenOnlineMembers(gid, cb) {
  const r = ref(db, `groups/${gid}/members`);
  onValue(r, snap => {
    const data  = snap.val() || {};
    const uids  = new Set(Object.entries(data).filter(([, m]) => m.online).map(([id]) => id));
    cb(uids);
  });
  return () => off(r);
}

export async function setupPresence(uid, gid) {
  const presenceRef = ref(db, `groups/${gid}/members/${uid}`);
  const disc = onDisconnect(presenceRef);
  await disc.update({ online: false });
  await update(presenceRef, { online: true });
  return async () => {
    await disc.cancel();
    await update(presenceRef, { online: false });
  };
}

// ── Share a plan to a group ──────────────────────────────────
export async function shareGroupPlan(uid, userName, groupId, { name, sessions }) {
  const snap = await get(ref(db, `groups/${groupId}/members/${uid}`));
  const role = snap.exists() ? snap.val().role : "member";
  const approved = role === "admin";
  const planRef = push(ref(db, `groups/${groupId}/plans`));
  await set(planRef, { name, sessions, sharedBy: uid, sharedByName: userName, approved, likeCount: 0, enrollCount: 0, pinned: false, createdAt: Date.now() });
  return approved ? "approved" : "pending";
}

// ── Real-time: chat ──────────────────────────────────────────
// Path: groupChat/{gid}/messages
export function listenChat(gid, cb) {
  const r = ref(db, `groupChat/${gid}/messages`);
  onValue(r, snap => {
    const data = snap.val() || {};
    const msgs = Object.entries(data).map(([id, v]) => ({ id, ...v }));
    msgs.sort((a, b) => a.createdAt - b.createdAt);
    cb(msgs);
  });
  return () => off(r);
}

export function sendMessage(gid, uid, user, text, mentions = [], type = null) {
  const payload = {
    uid, name: user.displayName || "User",
    photo: user.photoURL || "", text: text.trim(), createdAt: Date.now(),
  };
  if (mentions.length) payload.mentions = mentions;
  if (type) payload.type = type;
  return push(ref(db, `groupChat/${gid}/messages`), payload);
}

// ── Pinned messages ──────────────────────────────────────────
export const setPinnedMessage = (gid, data) => set(ref(db, `groupChat/${gid}/pinnedMessage`), data);
export const removePinnedMessage = gid => remove(ref(db, `groupChat/${gid}/pinnedMessage`));
export function listenPinnedMessage(gid, cb) {
  const r = ref(db, `groupChat/${gid}/pinnedMessage`);
  onValue(r, s => cb(s.val() || null));
  return () => off(r);
}

// ── Search all groups ────────────────────────────────────────────────
export async function searchGroups(query) {
  if (!query || query.trim().length < 2) return [];
  const snap = await get(ref(db, "groups"));
  if (!snap.exists()) return [];
  const q = query.trim().toLowerCase();
  const results = [];
  snap.forEach(child => {
    const g = child.val();
    if (g.name?.toLowerCase().includes(q)) {
      results.push({ id: child.key, name: g.name, description: g.description || "", memberCount: Object.keys(g.members || {}).length });
    }
  });
  return results.slice(0, 10);
}

// ── Join requests ────────────────────────────────────────────────────
export function sendJoinRequest(groupId, uid, name, photo) {
  return set(ref(db, `groups/${groupId}/joinRequests/${uid}`), {
    name: name || "User", photo: photo || "", uid, requestedAt: Date.now(), status: "pending",
  });
}

export function listenJoinRequests(groupId, callback) {
  const r = ref(db, `groups/${groupId}/joinRequests`);
  onValue(r, snap => {
    const data = snap.val() || {};
    const list = Object.entries(data).filter(([, v]) => v.status === "pending").map(([id, v]) => ({ id, ...v }));
    callback(list);
  });
  return () => off(r);
}

export async function approveJoinRequest(groupId, uid, name, photo) {
  await update(ref(db, `groups/${groupId}/members/${uid}`), { name: name || "User", photo: photo || "", role: "member", joinedAt: Date.now(), online: false });
  await update(ref(db, `groups/${groupId}/joinRequests/${uid}`), { status: "approved" });
  await set(ref(db, `users/${uid}/groups/${groupId}`), Date.now());
  const nameSnap = await get(ref(db, `groups/${groupId}/name`));
  notifyJoinApproved(uid, nameSnap.val() || "the group").catch(() => {});
}

export function rejectJoinRequest(groupId, requestId) {
  return update(ref(db, `groups/${groupId}/joinRequests/${requestId}`), { status: "rejected" });
}

// ── Group shared plans ───────────────────────────────────────────────
export function listenGroupPlans(groupId, callback) {
  const r = ref(db, `groups/${groupId}/plans`);
  onValue(r, snap => {
    const data = snap.val() || {};
    const list = Object.entries(data).map(([id, v]) => ({ id, ...v }));
    callback(list);
  });
  return () => off(r);
}

export function approveGroupPlan(groupId, planId) {
  return update(ref(db, `groups/${groupId}/plans/${planId}`), { approved: true });
}

export function rejectGroupPlan(groupId, planId) {
  return remove(ref(db, `groups/${groupId}/plans/${planId}`));
}

// ── Delete group with full cleanup ───────────────────────────
export async function deleteGroup(groupId, uid) {
  const snap = await get(ref(db, `groups/${groupId}`));
  if (!snap.exists()) return;
  const g = snap.val();
  if (g.createdBy !== uid) throw new Error("Only group creator can delete this group");
  for (const folder of [`groupBanners/${groupId}`, `groupFiles/${groupId}`]) {
    try { const list = await listAll(sRef(storage, folder)); await Promise.all(list.items.map(i => deleteObject(i))); } catch {}
  }
  const memberUids = Object.keys(g.members || {});
  await Promise.all(memberUids.map(muid => remove(ref(db, `users/${muid}/groups/${groupId}`))));
  await Promise.all([
    remove(ref(db, `groups/${groupId}`)),
    remove(ref(db, `groupChat/${groupId}`)),
    g.inviteCode ? remove(ref(db, `inviteCodes/${g.inviteCode}`)) : Promise.resolve(),
  ]);
}
