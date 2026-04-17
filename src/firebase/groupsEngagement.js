import { db } from "./config";
import { ref, set, get, update, remove } from "firebase/database";

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
