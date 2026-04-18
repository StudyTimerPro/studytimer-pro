import { db } from "./config";
import { ref, set, get, update, remove, onValue, off } from "firebase/database";
import { notifyLike } from "../utils/notificationHelper";

async function toggleCount(likeRef, countRef) {
  const [snap, countSnap] = await Promise.all([get(likeRef), get(countRef)]);
  const liked = snap.exists();
  const count = countSnap.val() || 0;
  await (liked ? remove(likeRef) : set(likeRef, true));
  await set(countRef, Math.max(0, liked ? count - 1 : count + 1));
  return !liked;
}

export function toggleLikePlan(groupId, planId, uid) {
  return toggleCount(
    ref(db, `groups/${groupId}/plans/${planId}/likes/${uid}`),
    ref(db, `groups/${groupId}/plans/${planId}/likeCount`)
  );
}

export function toggleLikeMaterial(groupId, itemId, uid) {
  return toggleCount(
    ref(db, `groups/${groupId}/library/${itemId}/likes/${uid}`),
    ref(db, `groups/${groupId}/library/${itemId}/likeCount`)
  );
}

export function pinPlan(groupId, planId, isPinned) {
  return update(ref(db, `groups/${groupId}/plans/${planId}`), { pinned: isPinned });
}

export function pinMaterial(groupId, itemId, isPinned) {
  return update(ref(db, `groups/${groupId}/library/${itemId}`), { pinned: isPinned });
}

export async function enrollInPlan(groupId, planId, uid) {
  const enrollRef = ref(db, `groups/${groupId}/plans/${planId}/enrollments/${uid}`);
  if ((await get(enrollRef)).exists()) return;
  await set(enrollRef, true);
  const countRef = ref(db, `groups/${groupId}/plans/${planId}/enrollCount`);
  await set(countRef, ((await get(countRef)).val() || 0) + 1);
}

export function removePlan(groupId, planId) {
  return remove(ref(db, `groups/${groupId}/plans/${planId}`));
}

export async function incrementPlanViewCount(groupId, planId) {
  const r = ref(db, `groups/${groupId}/plans/${planId}/viewCount`);
  const snap = await get(r);
  await set(r, (snap.val() || 0) + 1);
}

export async function toggleMemberLike(groupId, targetUid, fromUid, fromName, groupName) {
  const r = ref(db, `groups/${groupId}/memberLikes/${targetUid}/${fromUid}`);
  const snap = await get(r);
  if (snap.exists()) {
    await remove(r);
  } else {
    await set(r, true);
    if (fromUid !== targetUid) {
      notifyLike(targetUid, fromName || "Someone", groupName || "the group", groupId).catch(() => {});
    }
  }
}

export function listenMemberLikes(groupId, targetUid, callback) {
  const r = ref(db, `groups/${groupId}/memberLikes/${targetUid}`);
  onValue(r, snap => callback(snap.val() || {}));
  return () => off(r);
}

export function listenAllMemberLikes(groupId, callback) {
  const r = ref(db, `groups/${groupId}/memberLikes`);
  onValue(r, snap => callback(snap.val() || {}));
  return () => off(r);
}
