// revisionDb.js
// Spaced-repetition revision items.
// Path: revision/{uid}/{examId}/{planId}/items/{topicSlug}
//
// Item shape:
// {
//   topic, subtopic_name, focus, importance,
//   sessionId, sessionName,
//   level: 0..5,         // 0 = learning stage (no revision done yet)
//   weak: boolean,
//   retryPending: boolean,
//   lastReviewedAt: number (ms),
//   nextDueDate: "YYYY-MM-DD",
//   history: [{ ts, level, correct, weak }],
//   createdAt, updatedAt
// }

import { db } from "./config";
import { ref, set, get, update, remove, onValue, off } from "firebase/database";
import { computeNextDueDate, addDaysISO } from "../utils/revisionScheduler";

function itemsRef(uid, examId, planId) {
  return ref(db, `revision/${uid}/${examId}/${planId}/items`);
}
function itemRef(uid, examId, planId, slug) {
  return ref(db, `revision/${uid}/${examId}/${planId}/items/${slug}`);
}

/**
 * Create or update a revision entry. If the entry already exists, fields are merged
 * (existing level / history are preserved unless explicitly overridden).
 * Used when a subtopic is marked complete in TopicHierarchyView.
 */
export async function ensureRevisionItem(uid, examId, planId, slug, payload) {
  const r = itemRef(uid, examId, planId, slug);
  const snap = await get(r);
  const existing = snap.val();
  if (existing) {
    return update(r, {
      topic: payload.topic ?? existing.topic ?? "",
      subtopic_name: payload.subtopic_name ?? existing.subtopic_name ?? "",
      focus: payload.focus ?? existing.focus ?? "",
      importance: payload.importance ?? existing.importance ?? "Medium",
      sessionId: payload.sessionId ?? existing.sessionId ?? null,
      sessionName: payload.sessionName ?? existing.sessionName ?? null,
      updatedAt: Date.now(),
    });
  }
  // Brand-new entry: learning stage, due tomorrow (Day 1 after learning).
  const today = new Date();
  const nextDue = addDaysISO(today, 1);
  return set(r, {
    topic: payload.topic || "",
    subtopic_name: payload.subtopic_name || "",
    focus: payload.focus || "",
    importance: payload.importance || "Medium",
    sessionId: payload.sessionId || null,
    sessionName: payload.sessionName || null,
    level: 0,
    weak: false,
    retryPending: false,
    lastReviewedAt: 0,
    nextDueDate: nextDue,
    history: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/** Remove a revision entry — used when a subtopic is unmarked from complete. */
export function removeRevisionItem(uid, examId, planId, slug) {
  return remove(itemRef(uid, examId, planId, slug));
}

/** Subscribe to all revision items under a plan. */
export function listenRevisionItems(uid, examId, planId, callback) {
  if (!uid || !examId || !planId) { callback({}); return () => {}; }
  const r = itemsRef(uid, examId, planId);
  const cb = snap => callback(snap.val() || {});
  onValue(r, cb);
  return () => off(r, "value", cb);
}

/**
 * Record the result of a revision attempt and reschedule.
 * - correct=true  → level + 1, schedule next interval
 * - correct=false → keep level, mark weak, retry within 1 day
 *                   if retryPending was already true → step back one level
 */
export async function recordRevisionResult(uid, examId, planId, slug, { correct }) {
  const r = itemRef(uid, examId, planId, slug);
  const snap = await get(r);
  const item = snap.val();
  if (!item) return null;

  const now = Date.now();
  const history = Array.isArray(item.history) ? item.history.slice(-49) : [];
  let level = Number(item.level) || 0;
  let weak = !!item.weak;
  let retryPending = !!item.retryPending;

  if (correct) {
    if (retryPending) retryPending = false;
    level = Math.min(5, level + 1);
    weak = false;
  } else {
    weak = true;
    if (retryPending) {
      level = Math.max(0, level - 1);
      retryPending = false;
    } else {
      retryPending = true;
    }
  }

  const nextDueDate = computeNextDueDate({ level, weak, retryPending });
  history.push({ ts: now, level, correct: !!correct, weak });

  await update(r, {
    level, weak, retryPending,
    lastReviewedAt: now,
    nextDueDate,
    history,
    updatedAt: now,
  });
  return { level, weak, retryPending, nextDueDate };
}

/** One-shot read of every item under a plan (used by the banner snapshot). */
export async function fetchAllRevisionItems(uid, examId, planId) {
  if (!uid || !examId || !planId) return {};
  const snap = await get(itemsRef(uid, examId, planId));
  return snap.val() || {};
}
