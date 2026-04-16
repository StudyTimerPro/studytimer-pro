import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey:            "AIzaSyBTu-DqEjSnat7HhNeuboWxNnoryy7-6m4",
  authDomain:        "leaderboard-98e8c.firebaseapp.com",
  databaseURL:       "https://leaderboard-98e8c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "leaderboard-98e8c",
  storageBucket:     "leaderboard-98e8c.firebasestorage.app",
  messagingSenderId: "952043922319"
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getDatabase(app);
export default app;