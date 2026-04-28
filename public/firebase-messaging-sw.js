importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBTu-DqEjSnat7HhNeuboWxNnoryy7-6m4",
  authDomain: "leaderboard-98e8c.firebaseapp.com",
  projectId: "leaderboard-98e8c",
  storageBucket: "leaderboard-98e8c.firebasestorage.app",
  messagingSenderId: "952043922319",
  appId: "1:952043922319:web:f94998ce71e566a07321fa",
  databaseURL: "https://leaderboard-98e8c-default-rtdb.asia-southeast1.firebasedatabase.app"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  // Session reminders use data-only messages (no 'notification' field) to
  // prevent Firebase from auto-displaying a second notification alongside this one.
  const d = payload.data || {};
  const n = payload.notification || {};
  const title = d.title || n.title;
  const body = d.body || n.body;
  if (!title) return;
  return self.registration.showNotification(title, {
    body,
    icon: '/icon.png',
  });
});