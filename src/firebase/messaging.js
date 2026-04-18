import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { ref, set } from "firebase/database";
import { db } from "./config";
import app from "./config";

const VAPID_KEY = "BJgwAvfV9_M7SdaNGWVjrE24E_i_CjnixZBS-V9cqGwHqXNOU5MjeyzpyBYl9c8p_ZpI0X7tZrvHAbiQ-qBz5sE";

let _messaging = null;
function getMsg() {
  if (!_messaging) _messaging = getMessaging(app);
  return _messaging;
}

export async function requestPermissionAndGetToken(uid) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return null;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;
  try {
    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const token = await getToken(getMsg(), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (token) {
      await set(ref(db, `users/${uid}/fcmToken`), token);
      await set(ref(db, `users/${uid}/fcmTokenUpdatedAt`), Date.now());
      await set(ref(db, `users/${uid}/notificationsEnabled`), true);
    }
    return token || null;
  } catch (err) {
    console.error("FCM token error:", err);
    return null;
  }
}

export function listenForegroundMessages(callback) {
  try {
    return onMessage(getMsg(), callback);
  } catch { return () => {}; }
}

export async function sendFCMNotification(toUid, title, body, data = {}) {
  try {
    await fetch("https://us-central1-leaderboard-98e8c.cloudfunctions.net/sendNotification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUid, title, body, data }),
    });
  } catch {}
}
