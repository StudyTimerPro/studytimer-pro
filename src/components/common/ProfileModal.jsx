import React, { useState, useRef } from "react";
import { updateProfile } from "firebase/auth";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth } from "../../firebase/config";
import app from "../../firebase/config";
import { saveUser } from "../../firebase/db";
import useStore from "../../store/useStore";

export default function ProfileModal({ user, onClose }) {
  const { setUser, showToast, streak, leaderboard } = useStore();
  const [name, setName]       = useState(user?.displayName || "");
  const [photo, setPhoto]     = useState(user?.photoURL || "");
  const [busy, setBusy]       = useState(false);
  const [avatarHover, setAvatarHover] = useState(false);
  const fileRef               = useRef(null);

  const lbIdx     = leaderboard.findIndex(
    e => e.uid === user?.uid || e.name === user?.displayName
  );
  const rank      = lbIdx >= 0 ? lbIdx + 1 : null;
  const weekHours = lbIdx >= 0 ? (leaderboard[lbIdx].weekHours || 0) : 0;

  const initials = (name || user?.email || "?")
    .split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const blob       = await compressToBlob(file);
      const storage    = getStorage(app);
      const storageRef = sRef(storage, `profilePhotos/${user.uid}`);
      await uploadBytes(storageRef, blob);
      const url        = await getDownloadURL(storageRef);
      await updateProfile(auth.currentUser, { photoURL: url });
      setPhoto(url);
      setUser({ ...auth.currentUser, photoURL: url, displayName: name });
      showToast("Photo updated");
    } catch {
      showToast("Upload failed — check Storage rules");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { showToast("Name cannot be empty"); return; }
    setBusy(true);
    try {
      await updateProfile(auth.currentUser, { displayName: trimmed });
      await saveUser(user.uid, { name: trimmed });
      setUser({ ...auth.currentUser, displayName: trimmed, photoURL: photo });
      showToast("Profile updated");
      onClose();
    } catch {
      showToast("Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={overlayS}
    >
      <div style={cardS}>
        {/* Close */}
        <button onClick={onClose} style={closeS} title="Close">✕</button>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", marginBottom: 24, textAlign: "center" }}>
          👤 Profile
        </h2>

        {/* Avatar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
          <div
            onClick={() => !busy && fileRef.current?.click()}
            onMouseEnter={() => setAvatarHover(true)}
            onMouseLeave={() => setAvatarHover(false)}
            title="Click to change photo"
            style={avatarWrapS}
          >
            {photo
              ? <img src={photo} alt={name} referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 28, fontWeight: 700, color: "white", userSelect: "none" }}>{initials}</span>
            }
            <div style={{ ...camOverlayS, opacity: avatarHover && !busy ? 1 : 0 }}>📷</div>
          </div>
          <span style={{ fontSize: 12, color: "var(--ink2)", marginTop: 8 }}>
            {busy ? "Uploading…" : "Click to change photo"}
          </span>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
        </div>

        {/* Display Name */}
        <label style={labelS}>Display Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name"
          style={{ ...inputS, marginBottom: 14 }}
        />

        {/* Email (readonly) */}
        <label style={labelS}>Email</label>
        <input
          value={user?.email || ""}
          readOnly
          style={{ ...inputS, opacity: 0.55, cursor: "not-allowed", marginBottom: 20 }}
        />

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
          <StatBox label="This Week" value={`${Number(weekHours).toFixed(1)}h`} />
          <StatBox label="Streak"    value={streak > 0 ? `${streak}d 🔥` : "—"} />
          <StatBox label="Rank"      value={rank ? `#${rank}` : "—"} />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={cancelS}>Cancel</button>
          <button onClick={handleSave} disabled={busy} style={{ ...saveS, opacity: busy ? 0.7 : 1 }}>
            {busy ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div style={{
      background: "var(--bg)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "12px 8px", textAlign: "center",
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)", fontFamily: "monospace" }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--ink2)", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </div>
    </div>
  );
}

async function compressToBlob(file, maxBytes = 50 * 1024) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const MAX    = 300;
  const s      = Math.min(MAX / bitmap.width, MAX / bitmap.height, 1);
  canvas.width  = Math.round(bitmap.width * s);
  canvas.height = Math.round(bitmap.height * s);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (let q = 0.9; q >= 0.1; q -= 0.15) {
    const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", q));
    if (blob.size <= maxBytes) return blob;
  }
  return new Promise(r => canvas.toBlob(r, "image/jpeg", 0.1));
}

// ── Styles ────────────────────────────────────────────────────────────────────
const overlayS    = { position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
const cardS       = { background: "var(--surface)", borderRadius: 20, padding: "32px 28px", width: "min(400px,100%)", boxShadow: "0 24px 64px rgba(0,0,0,.3)", position: "relative", maxHeight: "90vh", overflowY: "auto" };
const closeS      = { position: "absolute", top: 14, right: 16, background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--ink2)", lineHeight: 1, padding: 4 };
const avatarWrapS = { width: 88, height: 88, borderRadius: "50%", background: "var(--accent)", border: "3px solid var(--border)", overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", flexShrink: 0 };
const camOverlayS = { position: "absolute", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, transition: "opacity .2s", pointerEvents: "none" };
const labelS      = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink2)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 };
const inputS      = { width: "100%", padding: "10px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit", boxSizing: "border-box" };
const saveS       = { flex: 1, background: "var(--accent)", color: "white", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
const cancelS     = { background: "none", border: "1.5px solid var(--border)", borderRadius: 10, padding: "11px 20px", fontSize: 14, cursor: "pointer", color: "var(--ink2)" };
