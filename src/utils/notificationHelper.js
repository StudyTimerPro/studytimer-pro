import { db } from "../firebase/config";
import { ref, push, set } from "firebase/database";
import { sendFCMNotification } from "../firebase/messaging";

export async function saveInAppNotification(uid, { type, title, message, groupId = null, fromName = null }) {
  const r = push(ref(db, `users/${uid}/notifications`));
  await set(r, { type, title, message, groupId, fromName, read: false, createdAt: Date.now() });
}

export async function notifyJoinApproved(memberUid, groupName) {
  await saveInAppNotification(memberUid, {
    type: "join_approved",
    title: "✅ Join Request Approved",
    message: `Welcome to ${groupName}!`,
  });
  sendFCMNotification(memberUid, "✅ Join Request Approved", `Welcome to ${groupName}!`, {});
}

export async function notifyMention(mentionedUid, fromName, groupName, groupId) {
  await saveInAppNotification(mentionedUid, {
    type: "mention",
    title: `@ ${fromName} mentioned you`,
    message: `In ${groupName}`,
    groupId,
    fromName,
  });
  sendFCMNotification(mentionedUid, `@ ${fromName} mentioned you`, `In ${groupName}`, { groupId });
}

export async function notifyAnnouncement(memberUids, title, message, groupName, groupId) {
  await Promise.all(memberUids.map(uid =>
    saveInAppNotification(uid, { type: "announcement", title, message, groupId })
      .then(() => sendFCMNotification(uid, title, message, { groupId }))
      .catch(() => {})
  ));
}

export async function notifyLike(targetUid, fromName, groupName, groupId) {
  await saveInAppNotification(targetUid, {
    type: "like",
    title: "❤️ New Like",
    message: `${fromName} liked your profile in ${groupName}`,
    groupId,
    fromName,
  }).catch(() => {});
}
