import { db } from "./config";
import {
  ref, set, get, push, update, remove, onValue, off, runTransaction,
} from "firebase/database";

// ── Plans ──────────────────────────────────
export function savePlan(uid, data) {
  return push(ref(db, `plans/${uid}/sessions`), data);
}

export function updatePlan(uid, id, data) {
  return update(ref(db, `plans/${uid}/sessions/${id}`), data);
}

export function deletePlan(uid, id) {
  return remove(ref(db, `plans/${uid}/sessions/${id}`));
}

export function listenPlans(uid, callback) {
  const r = ref(db, `plans/${uid}/sessions`);
  onValue(r, snap => {
    const data = snap.val() || {};
    const list = Object.entries(data).map(([id, v]) => ({ id, ...v }));
    list.sort((a, b) => a.start.localeCompare(b.start));
    callback(list);
  });
  return () => off(r);
}

// ── Leaderboard ────────────────────────────
export function listenLeaderboard(callback) {
  const r = ref(db, "leaderboard");
  onValue(r, snap => {
    const data = snap.val() || {};
    const list = Object.values(data);
    list.sort((a, b) => (b.weekHours || 0) - (a.weekHours || 0));
    callback(list.slice(0, 100));
  });
  return () => off(r);
}

// ── User ───────────────────────────────────
export function saveUser(uid, data) {
  return update(ref(db, `users/${uid}`), data);
}

// ── Wastage History ────────────────────────
export function saveWastage(uid, date, data) {
  return set(ref(db, `wastage/${uid}/${date}`), data);
}

export function deleteWastage(uid, date) {
  return remove(ref(db, `wastage/${uid}/${date}`));
}

export function deleteAllWastage(uid) {
  return remove(ref(db, `wastage/${uid}`));
}

export function listenWastage(uid, callback) {
  const r = ref(db, `wastage/${uid}`);
  onValue(r, snap => callback(snap.val() || {}));
  return () => off(r);
}

export function getWastageDate(uid, date) {
  return get(ref(db, `wastage/${uid}/${date}`)).then(snap => snap.val());
}

export function getWastageAll(uid) {
  return get(ref(db, `wastage/${uid}`)).then(snap => snap.val() || {});
}

// ── User Settings ──────────────────────────
export function saveUserSettings(uid, settings) {
  return update(ref(db, `users/${uid}/settings`), settings);
}

export function getUserSettings(uid) {
  return get(ref(db, `users/${uid}/settings`)).then(snap => snap.val());
}

// ── AI Tokens ──────────────────────────────
/** Returns remaining token count; defaults to 10 for new users. */
export function getUserTokens(uid) {
  return get(ref(db, `users/${uid}/aiTokens`))
    .then(snap => (snap.val() === null ? 10 : snap.val()));
}

/** Atomically decrement token count (floor 0). */
export function decrementUserTokens(uid) {
  return runTransaction(ref(db, `users/${uid}/aiTokens`), current =>
    Math.max(0, (current === null ? 10 : current) - 1)
  );
}