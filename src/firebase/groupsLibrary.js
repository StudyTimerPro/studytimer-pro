import { db, storage } from "./config";
import { ref as dbRef, set, get, update, remove, onValue, off, push } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

function getFileType(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "txt") return "txt";
  if (["jpg", "jpeg", "png"].includes(ext)) return "image";
  return "link";
}

export async function uploadAndSaveLibraryItem(groupId, uid, userName, { file, linkUrl, linkName }, isAdmin) {
  let url, name, type;
  if (file) {
    const ts = Date.now();
    const sRef = storageRef(storage, `groupFiles/${groupId}/${ts}_${file.name}`);
    await uploadBytes(sRef, file);
    url = await getDownloadURL(sRef);
    name = file.name;
    type = getFileType(file);
  } else {
    url = linkUrl;
    name = linkName || linkUrl;
    type = "link";
  }
  const r = push(dbRef(db, `groups/${groupId}/library`));
  await set(r, { name, type, url, uploadedBy: uid, uploadedByName: userName, viewCount: 0, approved: isAdmin, createdAt: Date.now() });
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

export async function incrementViewCount(groupId, itemId) {
  const r = dbRef(db, `groups/${groupId}/library/${itemId}/viewCount`);
  const snap = await get(r);
  await set(r, (snap.val() || 0) + 1);
}
