import React, { useEffect, useState, useRef } from "react";
import { uploadAndSaveLibraryItem, listenLibraryItems, approveLibraryItem, incrementViewCount, removeMaterial } from "../../firebase/groupsLibrary";
import { toggleLikeMaterial, pinMaterial } from "../../firebase/groupsEngagement";
import GroupLibraryCard from "./GroupLibraryCard";

const MAX_SIZE    = 20 * 1024 * 1024;
const ALLOWED     = ["application/pdf", "text/plain", "image/jpeg", "image/jpg", "image/png"];
const ALLOWED_EXT = [".pdf", ".txt", ".jpg", ".jpeg", ".png"];

const GRID_CSS = `
.gl-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
@media (max-width: 640px) { .gl-grid { grid-template-columns: repeat(2, 1fr); } }
`;

export default function GroupLibrary({ groupId, user, isAdmin, showToast }) {
  const [items,     setItems]     = useState([]);
  const [link,      setLink]      = useState("");
  const [linkName,  setLinkName]  = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => listenLibraryItems(groupId, list => {
    setItems(list.slice().sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.createdAt - a.createdAt;
    }));
  }), [groupId]);

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED.includes(file.type)) { showToast("Only PDF, TXT, JPG, PNG allowed"); return; }
    if (file.size > MAX_SIZE) { showToast("File exceeds 20MB limit"); return; }
    setUploading(true);
    try {
      await uploadAndSaveLibraryItem(groupId, user.uid, user.displayName || "User", { file }, isAdmin);
      showToast(isAdmin ? "Uploaded ✓" : "Uploaded — pending admin approval");
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

  async function handleView(item) {
    try { await incrementViewCount(groupId, item.id); } catch {}
    window.open(item.url, "_blank", "noopener,noreferrer");
  }

  async function handleLike(item) {
    try { await toggleLikeMaterial(groupId, item.id, user.uid); }
    catch { showToast("Failed to like"); }
  }

  async function handlePin(item) {
    try { await pinMaterial(groupId, item.id, !item.pinned); }
    catch { showToast("Failed to pin"); }
  }

  async function handleApprove(itemId) {
    try { await approveLibraryItem(groupId, itemId); showToast("Approved ✓"); }
    catch { showToast("Failed"); }
  }

  async function handleRemove(itemId) {
    if (!confirm("Remove this material?")) return;
    try { await removeMaterial(groupId, itemId); showToast("Removed"); }
    catch { showToast("Failed"); }
  }

  return (
    <div>
      <style>{GRID_CSS}</style>

      <div style={{ background: "var(--surface)", borderRadius: 10, padding: 14, border: "1px solid var(--border)", marginBottom: 16 }}>
        <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "var(--ink)" }}>📤 Add Material</h4>
        <div style={{ marginBottom: 8 }}>
          <input ref={fileRef} type="file" accept={ALLOWED_EXT.join(",")} style={{ display: "none" }} onChange={handleFileUpload} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={upBtn}>
            📎 Upload File (PDF / TXT / Image, max 20MB)
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={linkName} onChange={e => setLinkName(e.target.value)} placeholder="Link name (optional)" style={{ ...inputS, flex: "0 0 150px" }} />
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="Paste URL..." style={{ ...inputS, flex: 1, minWidth: 100 }} onKeyDown={e => e.key === "Enter" && handleLinkUpload()} />
          <button onClick={handleLinkUpload} disabled={uploading} style={upBtn}>🔗 Add Link</button>
        </div>
      </div>

      {items.length === 0 && <p style={{ color: "var(--ink2)", fontSize: 13 }}>No materials yet. Be the first to share!</p>}
      <div className="gl-grid">
        {items.map(item => (
          <GroupLibraryCard key={item.id} item={item} uid={user.uid} isAdmin={isAdmin}
            onView={() => handleView(item)}
            onLike={() => handleLike(item)}
            onPin={() => handlePin(item)}
            onApprove={() => handleApprove(item.id)}
            onRemove={() => handleRemove(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

const inputS = { padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit", boxSizing: "border-box" };
const upBtn  = { background: "var(--bg)", color: "var(--accent)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" };
