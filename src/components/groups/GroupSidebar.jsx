import React, { useState, useRef } from "react";
import { createGroup, joinGroup, searchGroups, sendJoinRequest, updateGroup } from "../../firebase/groupsDb";
import { storage } from "../../firebase/config";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { compressImage } from "../../utils/imageCompressor";

const BANNERS = ["#2d6a4f","#2563eb","#7c3aed","#dc2626","#d97706","#0891b2","#1a1814","#db2777"];

export default function GroupSidebar({ groups, selectedId, user, loading, onSelect, onGroupsChange, showToast, onClose, isMobile }) {
  const [search,        setSearch]        = useState("");
  const [modal,         setModal]         = useState(null);
  const [form,          setForm]          = useState({});
  const [busy,          setBusy]          = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [sentRequests,  setSentRequests]  = useState(new Set());
  const [photoBlob,     setPhotoBlob]     = useState(null);
  const [photoPreview,  setPhotoPreview]  = useState(null);
  const photoRef = useRef(null);

  const joinedIds = new Set(groups.map(g => g.id));
  const filtered  = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  React.useEffect(() => {
    if (search.trim().length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try { const r = await searchGroups(search.trim()); setSearchResults(r); }
      catch {} finally { setSearching(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  function openModal(type) { setForm({}); setPhotoBlob(null); setPhotoPreview(null); setModal(type); }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg","image/jpg","image/png"].includes(file.type)) { showToast("Only JPG/PNG allowed"); return; }
    try {
      const blob = await compressImage(file, 50, 300);
      setPhotoBlob(blob);
      setPhotoPreview(URL.createObjectURL(blob));
    } catch { showToast("Failed to process image"); }
  }

  async function handleCreate() {
    if (!form.name?.trim()) { showToast("Group name required"); return; }
    setBusy(true);
    try {
      const g = await createGroup(user.uid, user, { name: form.name.trim(), description: form.desc || "", banner: form.banner || "#2d6a4f" });
      if (photoBlob) {
        const sRef = storageRef(storage, `groupBanners/${g.id}/profile.jpg`);
        await uploadBytes(sRef, photoBlob);
        const url = await getDownloadURL(sRef);
        await updateGroup(g.id, { photoURL: url });
        g.photoURL = url;
      }
      onGroupsChange(prev => [...prev, g]);
      onSelect(g.id); setModal(null); showToast("Group created!");
    } catch { showToast("Failed to create group"); }
    finally   { setBusy(false); }
  }

  async function handleJoin() {
    if (!form.code?.trim()) { showToast("Enter an invite code"); return; }
    setBusy(true);
    try {
      const g = await joinGroup(user.uid, user, form.code);
      if (!g) { showToast("Invalid invite code"); return; }
      if (!groups.find(x => x.id === g.id)) onGroupsChange(prev => [...prev, g]);
      onSelect(g.id); setModal(null); showToast("Joined group!");
    } catch { showToast("Failed to join group"); }
    finally   { setBusy(false); }
  }

  async function handleRequest(groupId) {
    setSentRequests(prev => new Set([...prev, groupId]));
    try {
      await sendJoinRequest(groupId, user.uid, user.displayName || "User", user.photoURL || "");
      showToast("Request sent!");
    } catch {
      showToast("Failed to send request");
      setSentRequests(prev => { const s = new Set(prev); s.delete(groupId); return s; });
    }
  }

  const globalResults = searchResults.filter(r => !joinedIds.has(r.id));
  const createInitial = (form.name || "G").charAt(0).toUpperCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: isMobile ? "100vh" : 500 }}>
      <div style={{ padding: "16px 14px 10px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>👥 Your Groups</span>
        {isMobile && <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--ink2)", padding: "2px 6px" }}>✕</button>}
      </div>

      <div style={{ padding: "10px 12px", display: "flex", gap: 8, flexShrink: 0 }}>
        <button onClick={() => openModal("create")} style={actionBtn("var(--accent)")}>＋ New Group</button>
        <button onClick={() => openModal("join")}   style={actionBtn("var(--nav-bg)")}>🔗 Join</button>
      </div>

      <div style={{ padding: "0 12px 10px", flexShrink: 0 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search groups..." style={inputS} />
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && <p style={{ textAlign: "center", padding: 20, color: "var(--ink2)", fontSize: 13 }}>Loading...</p>}
        {!loading && filtered.length === 0 && search.trim().length < 2 && (
          <p style={{ textAlign: "center", padding: 24, color: "var(--ink2)", fontSize: 13 }}>{groups.length === 0 ? "No groups yet." : "No matches."}</p>
        )}
        {filtered.map(g => {
          const isActive = g.id === selectedId;
          const count    = g.members ? Object.keys(g.members).length : 0;
          return (
            <div key={g.id} onClick={() => onSelect(g.id)}
              style={{ padding: "11px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)", background: isActive ? "var(--accent-light)" : "var(--surface)", display: "flex", alignItems: "center", gap: 10 }}>
              <GroupAvatar g={g} size={40} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
                <div style={{ fontSize: 11, color: "var(--ink2)", marginTop: 1 }}>{count} member{count !== 1 ? "s" : ""}</div>
              </div>
              {isActive && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />}
            </div>
          );
        })}

        {search.trim().length >= 2 && (
          <>
            <div style={{ padding: "8px 14px", fontSize: 11, fontWeight: 700, color: "var(--ink2)", textTransform: "uppercase", borderTop: "1px solid var(--border)" }}>
              {searching ? "Searching..." : `All Groups (${globalResults.length})`}
            </div>
            {globalResults.map(g => {
              const sent = sentRequests.has(g.id);
              return (
                <div key={g.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>{g.name}</div>
                  {g.description && <div style={{ fontSize: 11, color: "var(--ink2)", marginTop: 2 }}>{g.description}</div>}
                  <div style={{ fontSize: 11, color: "var(--ink2)", marginTop: 2 }}>{g.memberCount} member{g.memberCount !== 1 ? "s" : ""}</div>
                  <button onClick={() => !sent && handleRequest(g.id)} disabled={sent}
                    style={{ marginTop: 6, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, border: "none", cursor: sent ? "default" : "pointer", background: sent ? "#d1fae5" : "var(--accent)", color: sent ? "var(--ink2)" : "white" }}>
                    {sent ? "Request Sent ✓" : "Request to Join"}
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>

      {modal && (
        <div onClick={e => e.target === e.currentTarget && setModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: 24, width: "min(400px,92vw)", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18, color: "var(--ink)" }}>
              {modal === "create" ? "Create Group" : "Join by Invite Code"}
            </h3>
            {modal === "create" ? (
              <>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <div style={{ position: "relative", cursor: "pointer" }} onClick={() => photoRef.current?.click()}>
                    {photoPreview
                      ? <img src={photoPreview} alt="" loading="lazy" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", display: "block" }} />
                      : <div style={{ width: 80, height: 80, borderRadius: "50%", background: form.banner || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "white", fontWeight: 700 }}>{createInitial}</div>
                    }
                    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity .2s" }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 1}
                      onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                      <span style={{ fontSize: 20 }}>📷</span>
                    </div>
                    <input ref={photoRef} type="file" accept=".jpg,.jpeg,.png" style={{ display: "none" }} onChange={handlePhotoChange} />
                  </div>
                </div>
                <MField label="Group Name">
                  <input value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. JEE Mains 2026" style={inputS} />
                </MField>
                <MField label="Description (optional)">
                  <input value={form.desc || ""} onChange={e => setForm({ ...form, desc: e.target.value })} placeholder="What's this group for?" style={inputS} />
                </MField>
                <MField label="Banner Color">
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {BANNERS.map(c => (
                      <div key={c} onClick={() => setForm({ ...form, banner: c })}
                        style={{ width: 28, height: 28, borderRadius: 6, background: c, cursor: "pointer", border: form.banner === c ? "3px solid var(--ink)" : "2px solid transparent" }} />
                    ))}
                  </div>
                </MField>
              </>
            ) : (
              <MField label="Invite Code">
                <input value={form.code || ""} onChange={e => setForm({ ...form, code: e.target.value })}
                  placeholder="e.g. ABC123" style={{ ...inputS, textTransform: "uppercase", letterSpacing: 3, fontFamily: "monospace" }} />
              </MField>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setModal(null)} style={cancelBtn}>Cancel</button>
              <button onClick={modal === "create" ? handleCreate : handleJoin} disabled={busy}
                style={{ background: busy ? "var(--border)" : "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "9px 22px", fontSize: 14, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer" }}>
                {busy ? "..." : modal === "create" ? "Create" : "Join"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupAvatar({ g, size }) {
  return g.photoURL
    ? <img src={g.photoURL} alt="" loading="lazy" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: "50%", background: g.banner || "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, color: "white", fontWeight: 700, flexShrink: 0 }}>{(g.name || "G").charAt(0).toUpperCase()}</div>;
}

function MField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink2)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputS    = { width: "100%", padding: "9px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit", boxSizing: "border-box" };
const cancelBtn = { background: "none", border: "1.5px solid var(--border)", borderRadius: 8, padding: "9px 18px", fontSize: 14, cursor: "pointer", color: "var(--ink)" };
function actionBtn(bg) { return { background: bg, color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer", flex: 1 }; }
