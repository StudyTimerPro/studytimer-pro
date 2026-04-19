import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey:            "AIzaSyBTu-DqEjSnat7HhNeuboWxNnoryy7-6m4",
  authDomain:        "leaderboard-98e8c.firebaseapp.com",
  databaseURL:       "https://leaderboard-98e8c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "leaderboard-98e8c",
  storageBucket:     "leaderboard-98e8c.firebasestorage.app",
  messagingSenderId: "952043922319",
  appId:             "1:952043922319:web:f94998ce71e566a07321fa",
};

const app  = initializeApp(firebaseConfig);
export const auth      = getAuth(app);
export const db        = getDatabase(app);
export const storage   = getStorage(app);
export const messaging = getMessaging(app);
export default app;