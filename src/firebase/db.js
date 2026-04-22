import { db } from "./config";
import {
  ref, set, get, push, update, remove, onValue, off, runTransaction,
} from "firebase/database";

// ── Plans (legacy flat structure, kept for backward compat) ────────
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

// ── Exams ──────────────────────────────────────────────────────────
export async function saveExam(uid, { name }) {
  const r = push(ref(db, `exams/${uid}`));
  await set(r, { name, createdAt: Date.now() });
  return r.key;
}

export async function getExams(uid) {
  const snap = await get(ref(db, `exams/${uid}`));
  const data = snap.val() || {};
  return Object.entries(data).map(([id, v]) => ({
    id,
    name: v.name || "Untitled",
    createdAt: v.createdAt || 0,
  })).sort((a, b) => a.createdAt - b.createdAt);
}

export function deleteExam(uid, examId) {
  return remove(ref(db, `exams/${uid}/${examId}`));
}

export function renameExam(uid, examId, name) {
  return update(ref(db, `exams/${uid}/${examId}`), { name });
}

// ── Plans under an exam ────────────────────────────────────────────
export async function savePlanToExam(uid, examId, planName, sessions) {
  const planRef = push(ref(db, `exams/${uid}/${examId}/plans`));
  const planId = planRef.key;
  await set(planRef, { name: planName, createdAt: Date.now() });
  const sessionsRef = ref(db, `exams/${uid}/${examId}/plans/${planId}/sessions`);
  const writes = sessions.map(s => {
    const sRef = push(sessionsRef);
    return set(sRef, { ...s, createdAt: Date.now() });
  });
  await Promise.all(writes);
  return planId;
}

export async function createEmptyPlan(uid, examId, planName) {
  const planRef = push(ref(db, `exams/${uid}/${examId}/plans`));
  await set(planRef, { name: planName, createdAt: Date.now() });
  return planRef.key;
}

export async function getPlans(uid, examId) {
  const snap = await get(ref(db, `exams/${uid}/${examId}/plans`));
  const data = snap.val() || {};
  return Object.entries(data).map(([id, v]) => ({
    id,
    name: v.name || "Untitled",
    createdAt: v.createdAt || 0,
    sessionCount: v.sessions ? Object.keys(v.sessions).length : 0,
  })).sort((a, b) => a.createdAt - b.createdAt);
}

export function deletePlanFromExam(uid, examId, planId) {
  return remove(ref(db, `exams/${uid}/${examId}/plans/${planId}`));
}

export function renamePlan(uid, examId, planId, name) {
  return update(ref(db, `exams/${uid}/${examId}/plans/${planId}`), { name });
}

// ── Sessions inside a plan ─────────────────────────────────────────
export function listenPlanSessions(uid, examId, planId, callback) {
  const r = ref(db, `exams/${uid}/${examId}/plans/${planId}/sessions`);
  const cb = snap => {
    const data = snap.val() || {};
    const list = Object.entries(data).map(([id, v]) => ({ id, ...v }));
    list.sort((a, b) => (a.start || "").localeCompare(b.start || ""));
    callback(list);
  };
  onValue(r, cb);
  return () => off(r, "value", cb);
}

export function savePlanSession(uid, examId, planId, data) {
  return push(ref(db, `exams/${uid}/${examId}/plans/${planId}/sessions`), data);
}

export function updatePlanSession(uid, examId, planId, sessionId, data) {
  return update(ref(db, `exams/${uid}/${examId}/plans/${planId}/sessions/${sessionId}`), data);
}

export function deletePlanSession(uid, examId, planId, sessionId) {
  return remove(ref(db, `exams/${uid}/${examId}/plans/${planId}/sessions/${sessionId}`));
}

// ── Export / Import ────────────────────────────────────────────────
export async function exportExam(uid, examId) {
  const snap = await get(ref(db, `exams/${uid}/${examId}`));
  const raw = snap.val();
  if (!raw) return null;
  const plans = [];
  const rawPlans = raw.plans || {};
  for (const [, p] of Object.entries(rawPlans)) {
    const sessions = Object.values(p.sessions || {}).map(stripSessionForExport);
    plans.push({ name: p.name || "Untitled", sessions });
  }
  return {
    type: "studytimer-exam",
    version: "1.0",
    exam: { name: raw.name, createdAt: raw.createdAt || Date.now() },
    plans,
  };
}

export async function exportPlan(uid, examId, planId) {
  const snap = await get(ref(db, `exams/${uid}/${examId}/plans/${planId}`));
  const raw = snap.val();
  if (!raw) return null;
  const sessions = Object.values(raw.sessions || {}).map(stripSessionForExport);
  return {
    type: "studytimer-plan",
    version: "1.0",
    plan: { name: raw.name || "Untitled", sessions },
  };
}

export async function importExam(uid, examData) {
  const data = examData?.exam ? examData : { exam: { name: "Imported" }, plans: [] };
  const examId = await saveExam(uid, { name: data.exam?.name || "Imported Exam" });
  for (const plan of data.plans || []) {
    await savePlanToExam(uid, examId, plan.name || "Untitled", plan.sessions || []);
  }
  return examId;
}

export async function importPlan(uid, examId, planData) {
  const plan = planData?.plan || planData;
  return savePlanToExam(uid, examId, plan.name || "Imported Plan", plan.sessions || []);
}

function stripSessionForExport(s) {
  return {
    name: s.name || "",
    start: s.start || "",
    end: s.end || "",
    breakMins: s.breakMins || 0,
    priority: s.priority || "medium",
    material: s.material || "",
  };
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

// ── Study Progress (daily sessionStudied map) ──────────────────────
// Path: studyProgress/{uid}/{YYYY-MM-DD}  →  { [sessionId]: secondsStudied }

function getStudyProgressStorageKey(uid, dateKey) {
  return `stp:studyProgress:${uid}:${dateKey}`;
}

function saveStudyProgressLocal(uid, dateKey, progressMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getStudyProgressStorageKey(uid, dateKey),
      JSON.stringify(progressMap || {})
    );
  } catch {
    // Ignore local storage failures and keep app behavior non-fatal.
  }
}

function getStudyProgressLocal(uid, dateKey) {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(getStudyProgressStorageKey(uid, dateKey));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveStudyProgress(uid, dateKey, progressMap) {
  saveStudyProgressLocal(uid, dateKey, progressMap);
  return set(ref(db, `studyProgress/${uid}/${dateKey}`), progressMap)
    .catch((error) => {
      if (error?.code !== "PERMISSION_DENIED") {
        console.warn("saveStudyProgress failed:", error);
      }
      return null;
    });
}

export function getStudyProgress(uid, dateKey) {
  return get(ref(db, `studyProgress/${uid}/${dateKey}`))
    .then((snap) => {
      const remote = snap.val() || {};
      if (remote && Object.keys(remote).length > 0) {
        saveStudyProgressLocal(uid, dateKey, remote);
        return remote;
      }
      return getStudyProgressLocal(uid, dateKey);
    })
    .catch((error) => {
      if (error?.code !== "PERMISSION_DENIED") {
        console.warn("getStudyProgress failed:", error);
      }
      return getStudyProgressLocal(uid, dateKey);
    });
}
