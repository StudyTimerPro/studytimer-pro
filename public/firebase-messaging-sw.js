importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBTu-DqEjSnat7HhNeuboWxNnoryy7-6m4",
  authDomain: "leaderboard-98e8c.firebaseapp.com",
  projectId: "leaderboard-98e8c",
  storageBucket: "leaderboard-98e8c.firebasestorage.app",
  messagingSenderId: "952043922319",
  databaseURL: "https://leaderboard-98e8c-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: icon || '/icon.png',
    badge: '/icon.png',
    data: payload.data
  });
});