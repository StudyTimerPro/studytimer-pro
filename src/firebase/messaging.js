import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { ref, set, get } from "firebase/database";
import { db } from "./config";
import app from "./config";

const VAPID_KEY = "BJgwAvfV9_M7SdaNGWVjrE24E_i_CjnixZBS-V9cqGwHqXNOU5MjeyzpyBYl9c8p_ZpI0X7tZrvHAbiQ-qBz5sE";

let _messaging = null;
function getMsg() {
  if (!_messaging) _messaging = getMessaging(app);
  return _messaging;
}

export async function requestPermissionAndGetToken(uid) {
  if (!("Notification" in window)) { console.log("FCM: Notifications API not supported"); return null; }
  if (!("serviceWorker" in navigator)) { console.log("FCM: Service Worker not supported"); return null; }
  console.log("FCM: Requesting notification permission...");
  const permission = await Notification.requestPermission();
  console.log("FCM: Notification permission:", permission);
  if (permission !== "granted") return null;
  try {
    console.log("FCM: Registering service worker...");
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log("FCM: Service worker registered:", registration.scope);
    console.log("FCM: Waiting for service worker to be ready...");
    await navigator.serviceWorker.ready;
    console.log("FCM: Service worker ready, getting FCM token...");
    const token = await getToken(getMsg(), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    console.log("FCM: Token", token ? "obtained: " + token.slice(0, 20) + "..." : "NOT obtained");
    if (token) {
      await set(ref(db, `users/${uid}/fcmToken`), token);
      await set(ref(db, `users/${uid}/fcmTokenUpdatedAt`), Date.now());
      await set(ref(db, `users/${uid}/notificationsEnabled`), true);
      console.log("FCM: Token saved to Firebase DB successfully");
    }
    return token || null;
  } catch (err) {
    console.log("FCM: Error getting token:", err.message || err);
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

export async function testPushNotification(uid) {
  console.log("FCM Test: Starting push notification test for uid:", uid);
  try {
    const tokenSnap = await get(ref(db, `users/${uid}/fcmToken`));
    const token = tokenSnap.val();
    console.log("FCM Test: Retrieved token:", token ? token.slice(0, 20) + "..." : "NOT FOUND");
    if (!token) { console.log("FCM Test: No token found — enable notifications first"); return false; }
    console.log("FCM Test: Sending test notification...");
    await sendFCMNotification(uid, "Test Notification", "Push is working!", { test: "true" });
    console.log("FCM Test: Sent successfully");
    return true;
  } catch (err) {
    console.log("FCM Test: Error:", err.message || err);
    return false;
  }
}
