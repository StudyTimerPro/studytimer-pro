import React, { useEffect, useState, useRef } from "react";
import { uploadAndSaveLibraryItem, listenLibraryItems, approveLibraryItem, incrementViewCount, incrementDownloadCount, removeMaterial } from "../../firebase/groupsLibrary";
import { toggleLikeMaterial, pinMaterial } from "../../firebase/groupsEngagement";
import { LoadingOverlay } from "../common/LoadingAnimation";
import GroupLibraryCard from "./GroupLibraryCard";
import LibraryPreviewModal from "./LibraryPreviewModal";

const MAX_SIZE    = 20 * 1024 * 1024;
const ALLOWED     = ["application/pdf", "text/plain", "image/jpeg", "image/jpg", "image/png"];
const ALLOWED_EXT = [".pdf", ".txt", ".jpg", ".jpeg", ".png"];

const GRID_CSS = `
.gl-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
@media (max-width: 640px) { .gl-grid { grid-template-columns: repeat(2, 1fr); } }
`;

export default function GroupLibrary({ groupId, user, isAdmin, showToast }) {
  const [items,        setItems]        = useState([]);
  const [link,         setLink]         = useState("");
  const [linkName,     setLinkName]     = useState("");
  const [uploading,    setUploading]    = useState(false);
  const [pendingFile,  setPendingFile]  = useState(null);
  const [pendingName,  setPendingName]  = useState("");
  const [sizeError,    setSizeError]    = useState("");
  const [previewItem,  setPreviewItem]  = useState(null);
  const fileRef = useRef(null);

  useEffect(() => listenLibraryItems(groupId, list => {
    setItems(list.slice().sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.createdAt - a.createdAt;
    }));
  }), [groupId]);

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED.includes(file.type)) { showToast("Only PDF, TXT, JPG, PNG allowed"); return; }
    if (file.size > MAX_SIZE) { setSizeError(`File too large. Max 20MB allowed (this file: ${(file.size / 1024 / 1024).toFixed(1)} MB)`); setPendingFile(null); return; }
    setSizeError("");
    setPendingFile(file);
    setPendingName(file.name);
  }

  async function handleConfirmUpload() {
    if (!pendingFile || !pendingName.trim()) return;
    setUploading(true);
    try {
      await uploadAndSaveLibraryItem(groupId, user.uid, user.displayName || "User", { file: pendingFile, displayName: pendingName.trim() }, isAdmin);
      showToast(isAdmin ? "Uploaded ✓" : "Uploaded — pending admin approval");
      setPendingFile(null); setPendingName("");
    } catch (err) { console.error(err); showToast("Upload failed"); }
    finally { setUploading(false); }
  }

  async function handleLinkUpload() {
    if (!link.trim()) { showToast("Enter a URL"); return; }
    setUploading(true);
    try {
      await uploadAndSaveLibraryItem(groupId, user.uid, user.displayName || "User", { linkUrl: link.trim(), linkName: linkName.trim() || link.trim() }, isAdmin);
      setLink(""); setLinkName("");
      showToast(isAdmin ? "Link added ✓" : "Link added — pending admin approval");
    } catch (err) { console.error(err); showToast("Failed"); }
    finally { setUploading(false); }
  }

  async function handlePreview(item) {
    try { await incrementViewCount(groupId, item.id); } catch {}
    if (item.type === "image" || item.type === "txt") { setPreviewItem(item); return; }
    window.open(item.url, "_blank", "noopener,noreferrer");
  }

  async function handleDownload(item) {
    try { await incrementDownloadCount(groupId, item.id); } catch {}
    try {
      const res = await fetch(item.url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = item.name || "download";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { window.open(item.url, "_blank", "noopener,noreferrer"); }
  }

  async function handleLike(item) {
    try { await toggleLikeMaterial(groupId, item.id, user.uid); } catch { showToast("Failed to like"); }
  }

  async function handlePin(item) {
    try { await pinMaterial(groupId, item.id, !item.pinned); } catch { showToast("Failed to pin"); }
  }

  async function handleApprove(itemId) {
    try { await approveLibraryItem(groupId, itemId); showToast("Approved ✓"); } catch { showToast("Failed"); }
  }

  async function handleRemove(itemId) {
    if (!confirm("Remove this material?")) return;
    try { await removeMaterial(groupId, itemId); showToast("Removed"); } catch { showToast("Failed"); }
  }

  return (
    <div>
      <style>{GRID_CSS}</style>

      <div style={{ background: "var(--surface)", borderRadius: 10, padding: 14, border: "1px solid var(--border)", marginBottom: 16, position: "relative" }}>
        {uploading && <LoadingOverlay message="Uploading…" />}
        <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "var(--ink)" }}>📤 Add Material</h4>

        <div style={{ marginBottom: 8 }}>
          <input ref={fileRef} type="file" accept={ALLOWED_EXT.join(",")} style={{ display: "none" }} onChange={handleFileSelect} />
          <button onClick={() => { setSizeError(""); fileRef.current?.click(); }} disabled={uploading} style={upBtn}>
            📎 Upload File (PDF / TXT / Image, max 20MB)
          </button>
          {sizeError && <div style={{ color: "#e63946", fontSize: 12, marginTop: 6 }}>⚠ {sizeError}</div>}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={linkName} onChange={e => setLinkName(e.target.value)} placeholder="Link name (optional)" style={{ ...inputS, flex: "0 0 150px" }} />
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="Paste URL..." style={{ ...inputS, flex: 1, minWidth: 100 }} onKeyDown={e => e.key === "Enter" && handleLinkUpload()} />
          <button onClick={handleLinkUpload} disabled={uploading} style={upBtn}>🔗 Add Link</button>
        </div>
      </div>

      {pendingFile && (
        <div onClick={e => e.target === e.currentTarget && (setPendingFile(null), setPendingName(""))}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: "24px 22px", width: "min(380px,100%)", boxShadow: "0 20px 60px rgba(0,0,0,.25)", position: "relative" }}>
            <button onClick={() => { setPendingFile(null); setPendingName(""); }}
              style={{ position: "absolute", top: 12, right: 14, background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--ink2)", lineHeight: 1, padding: 4 }}>✕</button>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>📎 Upload File</h3>
            <div style={{ fontSize: 12, color: "var(--ink2)", marginBottom: 14, padding: "8px 10px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
              📄 {pendingFile.name} &bull; {(pendingFile.size / 1024 / 1024).toFixed(2)} MB
            </div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink2)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Display Name</label>
            <input value={pendingName} onChange={e => setPendingName(e.target.value)} placeholder="Enter a name for this file..."
              autoFocus style={{ ...inputS, marginBottom: 18 }}
              onKeyDown={e => e.key === "Enter" && handleConfirmUpload()} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setPendingFile(null); setPendingName(""); }}
                style={{ background: "none", border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 18px", fontSize: 14, cursor: "pointer", color: "var(--ink2)" }}>
                Cancel
              </button>
              <button onClick={handleConfirmUpload} disabled={!pendingName.trim() || uploading}
                style={{ flex: 1, background: !pendingName.trim() || uploading ? "var(--border)" : "var(--accent)", color: "white", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: !pendingName.trim() || uploading ? "not-allowed" : "pointer" }}>
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 && <p style={{ color: "var(--ink2)", fontSize: 13 }}>No materials yet. Be the first to share!</p>}
      <div className="gl-grid">
        {items.map(item => (
          <GroupLibraryCard key={item.id} item={item} uid={user.uid} isAdmin={isAdmin}
            onPreview={() => handlePreview(item)}
            onDownload={() => handleDownload(item)}
            onLike={() => handleLike(item)}
            onPin={() => handlePin(item)}
            onApprove={() => handleApprove(item.id)}
            onRemove={() => handleRemove(item.id)}
          />
        ))}
      </div>

      {previewItem && <LibraryPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />}
    </div>
  );
}

const inputS = { padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit", boxSizing: "border-box", width: "100%" };
const upBtn  = { background: "var(--bg)", color: "var(--accent)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" };
