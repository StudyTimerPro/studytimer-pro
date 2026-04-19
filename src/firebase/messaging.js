import { getToken, onMessage } from "firebase/messaging";
import { ref, get, update } from "firebase/database";
import { db, messaging } from "./config";

const VAPID_KEY = "BJgwAvfV9_M7SdaNGWVjrE24E_i_CjnixZBS-V9cqGwHqXNOU5MjeyzpyBYl9c8p_ZpI0X7tZrvHAbiQ-qBz5sE";

export async function requestPermissionAndGetToken(uid) {
  if (!("Notification" in window)) { console.log("FCM: Notifications API not supported"); return null; }
  if (!("serviceWorker" in navigator)) { console.log("FCM: Service Worker not supported"); return null; }
  console.log("Step 1: Requesting permission...");
  const permission = await Notification.requestPermission();
  console.log("Step 2: Permission result: " + permission);
  if (permission !== "granted") return null;
  try {
    console.log("Step 3: Registering service worker...");
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log("Step 4: SW registered: " + registration.scope);
    await navigator.serviceWorker.ready;
    console.log("Step 5: Getting FCM token...");
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    console.log("Step 6: Token received: " + token);
    if (token) {
      console.log("Step 7: Saving to Firebase...");
      await update(ref(db, `users/${uid}`), {
        fcmToken: token,
        fcmTokenUpdatedAt: Date.now(),
        notificationsEnabled: true,
      });
      console.log("Step 8: Save complete");
    }
    return token || null;
  } catch (err) {
    console.log("FCM: Error:", err.code, err.message || err);
    return null;
  }
}

export function listenForegroundMessages(callback) {
  try {
    return onMessage(messaging, callback);
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
