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
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight: isMobile ? "100vh" : 500 }}>
      <div className="stp-gs-head">
        <h2>Your <em>groups</em></h2>
        {isMobile && <button onClick={onClose} className="stp-gs-close" aria-label="Close">✕</button>}
      </div>

      <div className="stp-gs-actions">
        <button onClick={() => openModal("create")} className="stp-gs-btn primary">＋ New</button>
        <button onClick={() => openModal("join")}   className="stp-gs-btn ghost">🔗 Join</button>
      </div>

      <input className="stp-gs-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search groups…" />

      <div style={{ flex:1, overflowY:"auto", paddingBottom:12 }}>
        {loading && <p className="stp-gs-empty">Loading…</p>}
        {!loading && filtered.length === 0 && search.trim().length < 2 && (
          <p className="stp-gs-empty">{groups.length === 0 ? "No groups yet." : "No matches."}</p>
        )}
        {filtered.map(g => {
          const isActive = g.id === selectedId;
          const count    = g.members ? Object.keys(g.members).length : 0;
          return (
            <div key={g.id} onClick={() => onSelect(g.id)}
              className={`stp-gs-row${isActive ? " active" : ""}`}>
              <GroupAvatar g={g} size={40} />
              <div style={{ minWidth:0, flex:1 }}>
                <div className="nm">{g.name}</div>
                <div className="meta">{count} member{count !== 1 ? "s" : ""}</div>
              </div>
              {isActive && <div className="dot" />}
            </div>
          );
        })}

        {search.trim().length >= 2 && (
          <>
            <div className="stp-gs-section">
              {searching ? "Searching…" : `Discover (${globalResults.length})`}
            </div>
            {globalResults.map(g => {
              const sent = sentRequests.has(g.id);
              return (
                <div key={g.id} className="stp-gs-discover">
                  <div className="nm">{g.name}</div>
                  {g.description && <div className="desc">{g.description}</div>}
                  <div className="desc">{g.memberCount} member{g.memberCount !== 1 ? "s" : ""}</div>
                  <button onClick={() => !sent && handleRequest(g.id)} disabled={sent} className="req">
                    {sent ? "Request sent ✓" : "Request to join"}
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>

      {modal && (
        <div onClick={e => e.target === e.currentTarget && setModal(null)} className="stp-gs-modal-scrim">
          <div className="stp-gs-modal">
            <h3>
              {modal === "create" ? <>Create <em>group</em></> : <>Join by <em>code</em></>}
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
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:20 }}>
              <button onClick={() => setModal(null)} className="stp-gs-btn ghost" style={{ flex: "0 0 auto", minWidth: 90 }}>Cancel</button>
              <button onClick={modal === "create" ? handleCreate : handleJoin} disabled={busy}
                className="stp-gs-btn primary" style={{ flex: "0 0 auto", minWidth: 110, opacity: busy ? .55 : 1 }}>
                {busy ? "…" : modal === "create" ? "Create" : "Join"}
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
