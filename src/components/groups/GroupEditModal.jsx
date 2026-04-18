import React, { useRef, useState } from "react";
import { storage } from "../../firebase/config";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { compressImage } from "../../utils/imageCompressor";
import { LoadingOverlay } from "../common/LoadingAnimation";

const BANNERS = ["#2d6a4f","#2563eb","#7c3aed","#dc2626","#d97706","#0891b2","#1a1814","#db2777"];

export default function GroupEditModal({ groupId, editForm, setEditForm, onClose, onSave, busy, onDelete }) {
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoRef = useRef(null);

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) { alert("Only JPG/PNG allowed"); return; }
    setPhotoUploading(true);
    try {
      const blob    = await compressImage(file, 50, 300);
      const sRef    = storageRef(storage, `groupBanners/${groupId}/profile.jpg`);
      await uploadBytes(sRef, blob);
      const url     = await getDownloadURL(sRef);
      setEditForm(f => ({ ...f, photoURL: url }));
    } catch { alert("Photo upload failed"); }
    finally { setPhotoUploading(false); }
  }

  const initials  = (editForm.name || "G").charAt(0).toUpperCase();
  const photoURL  = editForm.photoURL || "";

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--surface)", borderRadius: 14, padding: 24, width: "min(420px,92vw)", boxShadow: "0 20px 60px rgba(0,0,0,.2)", maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
        {(busy || photoUploading) && <LoadingOverlay message={photoUploading ? "Uploading photo…" : "Saving…"} />}
        <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18, color: "var(--ink)" }}>Edit Group</h3>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <div style={{ position: "relative", cursor: "pointer" }} onClick={() => !photoUploading && photoRef.current?.click()}>
            {photoURL
              ? <img src={photoURL} alt="" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", display: "block" }} />
              : <div style={{ width: 80, height: 80, borderRadius: "50%", background: editForm.banner || "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "white", fontWeight: 700 }}>{initials}</div>
            }
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", opacity: photoUploading ? 1 : 0, transition: "opacity .2s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => !photoUploading && (e.currentTarget.style.opacity = 0)}>
              <span style={{ fontSize: 20 }}>{photoUploading ? "⌛" : "📷"}</span>
            </div>
            <input ref={photoRef} type="file" accept=".jpg,.jpeg,.png" style={{ display: "none" }} onChange={handlePhotoChange} />
          </div>
        </div>

        <EField label="Name">
          <input value={editForm.name || ""} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={inputS} />
        </EField>
        <EField label="Description">
          <input value={editForm.description || ""} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Optional" style={inputS} />
        </EField>
        <EField label="Banner Color">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {BANNERS.map(c => (
              <div key={c} onClick={() => setEditForm({ ...editForm, banner: c })}
                style={{ width: 28, height: 28, borderRadius: 6, background: c, cursor: "pointer", border: editForm.banner === c ? "3px solid var(--ink)" : "2px solid transparent" }} />
            ))}
          </div>
        </EField>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={cancelBtn}>Cancel</button>
          <button onClick={onSave} disabled={busy || photoUploading}
            style={{ background: busy || photoUploading ? "var(--border)" : "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "9px 22px", fontSize: 14, fontWeight: 600, cursor: busy || photoUploading ? "not-allowed" : "pointer" }}>
            {busy ? "Saving..." : "Save"}
          </button>
        </div>

        {onDelete && (
          <div>
            <div style={{ borderTop: "1px solid var(--border)", margin: "20px 0 16px" }} />
            <button
              onClick={() => { if (confirm("Delete this group? All members, plans, materials and chat will be permanently deleted. This cannot be undone.")) { onDelete(); } }}
              style={{ width: "100%", background: "#fde8e8", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              🗑 Delete Group
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink2)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputS    = { width: "100%", padding: "9px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit", boxSizing: "border-box" };
const cancelBtn = { background: "none", border: "1.5px solid var(--border)", borderRadius: 8, padding: "9px 18px", fontSize: 14, cursor: "pointer", color: "var(--ink)" };
