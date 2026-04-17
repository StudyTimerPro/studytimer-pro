import React, { useEffect, useState, useRef } from "react";
import { uploadAndSaveLibraryItem, listenLibraryItems, approveLibraryItem, rejectLibraryItem, incrementViewCount } from "../../firebase/groupsLibrary";

const MAX_SIZE    = 20 * 1024 * 1024;
const ALLOWED     = ["application/pdf", "text/plain", "image/jpeg", "image/jpg", "image/png"];
const ALLOWED_EXT = [".pdf", ".txt", ".jpg", ".jpeg", ".png"];

function fileIcon(type) {
  if (type === "pdf")   return "📄";
  if (type === "txt")   return "📝";
  if (type === "image") return "🖼️";
  return "🔗";
}

export default function GroupLibrary({ groupId, user, isAdmin, showToast }) {
  const [items,     setItems]     = useState([]);
  const [link,      setLink]      = useState("");
  const [linkName,  setLinkName]  = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => listenLibraryItems(groupId, setItems), [groupId]);

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
    } catch (err) { console.error("Library upload error:", err); showToast("Upload failed"); }
    finally { setUploading(false); }
  }

  async function handleLinkUpload() {
    if (!link.trim()) { showToast("Enter a URL"); return; }
    setUploading(true);
    try {
      await uploadAndSaveLibraryItem(groupId, user.uid, user.displayName || "User", { linkUrl: link.trim(), linkName: linkName.trim() || link.trim() }, isAdmin);
      setLink(""); setLinkName("");
      showToast(isAdmin ? "Link added ✓" : "Link added — pending admin approval");
    } catch (err) { console.error("Library link error:", err); showToast("Failed to add link"); }
    finally { setUploading(false); }
  }

  async function handleView(item) {
    try { await incrementViewCount(groupId, item.id); } catch {}
    window.open(item.url, "_blank", "noopener,noreferrer");
  }

  const approved = items.filter(i => i.approved);
  const pending  = items.filter(i => !i.approved);

  return (
    <div>
      {/* Upload Section */}
      <div style={{ background: "var(--surface)", borderRadius: 10, padding: 14, border: "1px solid var(--border)", marginBottom: 16 }}>
        <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "var(--ink)" }}>📤 Add Material</h4>
        <div style={{ marginBottom: 8 }}>
          <input ref={fileRef} type="file" accept={ALLOWED_EXT.join(",")} style={{ display: "none" }} onChange={handleFileUpload} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={upBtn}>
            📎 Upload File (PDF / TXT / Image, max 20MB)
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={linkName} onChange={e => setLinkName(e.target.value)} placeholder="Link name (optional)" style={{ ...inputS, flex: "0 0 150px" }} />
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="Paste URL..." style={{ ...inputS, flex: 1, minWidth: 120 }} onKeyDown={e => e.key === "Enter" && handleLinkUpload()} />
          <button onClick={handleLinkUpload} disabled={uploading} style={upBtn}>🔗 Add Link</button>
        </div>
      </div>

      {/* Admin: Pending Approval */}
      {isAdmin && pending.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "var(--ink)" }}>⏳ Pending Approval ({pending.length})</h4>
          {pending.map(item => (
            <LibCard key={item.id} item={item} onView={handleView}
              adminActions={
                <>
                  <button onClick={() => approveLibraryItem(groupId, item.id).then(() => showToast("Approved ✓")).catch(() => showToast("Failed"))}  style={aBtn("#eaf0fb","#2563eb")}>✓</button>
                  <button onClick={() => rejectLibraryItem(groupId, item.id).then(() => showToast("Rejected")).catch(() => showToast("Failed"))} style={aBtn("#fde8e8","#e63946")}>✕</button>
                </>
              }
            />
          ))}
        </div>
      )}

      {/* Approved Materials */}
      <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "var(--ink)" }}>📚 Materials ({approved.length})</h4>
      {approved.length === 0 && <p style={{ color: "var(--ink2)", fontSize: 13 }}>No materials yet. Be the first to share!</p>}
      {approved.map(item => <LibCard key={item.id} item={item} onView={handleView} />)}
    </div>
  );
}

function LibCard({ item, onView, adminActions }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{fileIcon(item.type)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
        <div style={{ fontSize: 11, color: "var(--ink2)", marginTop: 2 }}>
          By {item.uploadedByName} · {new Date(item.createdAt).toLocaleDateString()} · 👁 {item.viewCount || 0} views
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
        {adminActions}
        <button onClick={() => onView(item)} style={aBtn("var(--bg)", "var(--accent)", "1.5px solid var(--border)")}>
          {item.type === "link" ? "🔗 Visit" : "⬇ View"}
        </button>
      </div>
    </div>
  );
}

const inputS = { padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit", boxSizing: "border-box" };
const upBtn  = { background: "var(--bg)", color: "var(--accent)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" };
const aBtn   = (bg, color, border = "none") => ({ background: bg, color, border, borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" });
