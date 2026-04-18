import { db, storage } from "./config";
import { ref as dbRef, set, get, update, remove, onValue, off, push } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

function getFileType(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "txt") return "txt";
  if (["jpg", "jpeg", "png"].includes(ext)) return "image";
  return "link";
}

export async function uploadAndSaveLibraryItem(groupId, uid, userName, { file, linkUrl, linkName, displayName }, isAdmin) {
  let url, name, type, storagePath = "";
  if (file) {
    const ts = Date.now();
    storagePath = `groupFiles/${groupId}/${ts}_${file.name}`;
    const sRef = storageRef(storage, storagePath);
    await uploadBytes(sRef, file);
    url  = await getDownloadURL(sRef);
    name = displayName || file.name;
    type = getFileType(file);
  } else {
    url  = linkUrl;
    name = linkName || linkUrl;
    type = "link";
  }
  const r = push(dbRef(db, `groups/${groupId}/library`));
  await set(r, { name, type, url, storagePath, uploadedBy: uid, uploadedByName: userName, viewCount: 0, downloadCount: 0, likeCount: 0, approved: isAdmin, pinned: false, createdAt: Date.now() });
  return r.key;
}

export function listenLibraryItems(groupId, callback) {
  const r = dbRef(db, `groups/${groupId}/library`);
  onValue(r, snap => {
    const data = snap.val() || {};
    const list = Object.entries(data).map(([id, v]) => ({ id, ...v }));
    list.sort((a, b) => b.createdAt - a.createdAt);
    callback(list);
  });
  return () => off(r);
}

export function approveLibraryItem(groupId, itemId) {
  return update(dbRef(db, `groups/${groupId}/library/${itemId}`), { approved: true });
}

export function rejectLibraryItem(groupId, itemId) {
  return remove(dbRef(db, `groups/${groupId}/library/${itemId}`));
}

export async function removeMaterial(groupId, itemId) {
  const snap = await get(dbRef(db, `groups/${groupId}/library/${itemId}`));
  if (snap.exists()) {
    const { storagePath } = snap.val();
    if (storagePath) {
      try { await deleteObject(storageRef(storage, storagePath)); } catch {}
    }
  }
  return remove(dbRef(db, `groups/${groupId}/library/${itemId}`));
}

export async function incrementViewCount(groupId, itemId) {
  const r = dbRef(db, `groups/${groupId}/library/${itemId}/viewCount`);
  const snap = await get(r);
  await set(r, (snap.val() || 0) + 1);
}

export async function incrementDownloadCount(groupId, itemId) {
  const r = dbRef(db, `groups/${groupId}/library/${itemId}/downloadCount`);
  const snap = await get(r);
  await set(r, (snap.val() || 0) + 1);
}
