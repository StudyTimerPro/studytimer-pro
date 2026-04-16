import { useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { saveUser } from "../firebase/db";
import useStore from "../store/useStore";

export function useAuth() {
  const { user, setUser, showToast } = useStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        saveUser(firebaseUser.uid, {
          name:  firebaseUser.displayName,
          email: firebaseUser.email,
          photo: firebaseUser.photoURL,
        });
      } else {
        setUser(null);
      }
    });
    return () => unsub();
  }, []);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      showToast("Login failed: " + e.message);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      showToast("Signed out");
    } catch (e) {
      showToast("Logout failed");
    }
  };

  return { user, login, logout };
}