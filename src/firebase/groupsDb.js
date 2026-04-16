import { db } from "./config";
import { ref, set, get, push, update, remove, onValue, off } from "firebase/database";

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── Groups CRUD ──────────────────────────────────────────────
export async function createGroup(uid, user, { name, description, banner }) {
  const gRef = push(ref(db, "groups"));
  const gid  = gRef.key;
  const code = makeCode();
  const me   = { name: user.displayName || "User", photo: user.photoURL || "", role: "admin", joinedAt: Date.now(), online: false };
  const data = { name, description: description || "", banner: banner || "#2d6a4f", inviteCode: code, createdBy: uid, createdAt: Date.now(), members: { [uid]: me } };
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
  await remove(ref(db, `groups/${gid}/members/${memberUid}`));
  await remove(ref(db, `users/${memberUid}/groups/${gid}`));
}

export async function updateGroup(gid, data) {
  return update(ref(db, `groups/${gid}`), data);
}

export async function promoteMember(gid, memberUid) {
  return update(ref(db, `groups/${gid}/members/${memberUid}`), { role: "admin" });
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

export function setOnlineStatus(uid, gid, isOnline) {
  return update(ref(db, `groups/${gid}/members/${uid}`), { online: isOnline });
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

export function sendMessage(gid, uid, user, text) {
  return push(ref(db, `groupChat/${gid}/messages`), {
    uid, name: user.displayName || "User",
    photo: user.photoURL || "", text: text.trim(), createdAt: Date.now(),
  });
}

export function notifyAll(gid, senderName) {
  return push(ref(db, `groupChat/${gid}/messages`), {
    uid: "system", name: "System",
    text: `📢 ${senderName} sent a notification to all members.`,
    createdAt: Date.now(),
  });
}
