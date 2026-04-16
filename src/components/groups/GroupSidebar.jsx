import React, { useState } from "react";
import { createGroup, joinGroup } from "../../firebase/groupsDb";

const BANNERS = ["#2d6a4f","#2563eb","#7c3aed","#dc2626","#d97706","#0891b2","#1a1814","#db2777"];

export default function GroupSidebar({ groups, selectedId, user, loading, onSelect, onGroupsChange, showToast, onClose, isMobile }) {
  const [search, setSearch] = useState("");
  const [modal,  setModal]  = useState(null); // "create" | "join"
  const [form,   setForm]   = useState({});
  const [busy,   setBusy]   = useState(false);

  const filtered = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  function openModal(type) { setForm({}); setModal(type); }

  async function handleCreate() {
    if (!form.name?.trim()) { showToast("Group name required"); return; }
    setBusy(true);
    try {
      const g = await createGroup(user.uid, user, {
        name: form.name.trim(), description: form.desc || "", banner: form.banner || "#2d6a4f",
      });
      onGroupsChange(prev => [...prev, g]);
      onSelect(g.id);
      setModal(null);
      showToast("Group created!");
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
      onSelect(g.id);
      setModal(null);
      showToast("Joined group!");
    } catch { showToast("Failed to join group"); }
    finally   { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: isMobile ? "100vh" : 500 }}>
      {/* Header */}
      <div style={{ padding: "16px 14px 10px", borderBottom: "1px solid #ddd9d2", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#1a1814" }}>👥 Your Groups</span>
        {isMobile && (
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#6b6560", padding: "2px 6px" }}>✕</button>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ padding: "10px 12px", display: "flex", gap: 8, flexShrink: 0 }}>
        <button onClick={() => openModal("create")} style={actionBtn("#2d6a4f")}>＋ New Group</button>
        <button onClick={() => openModal("join")}   style={actionBtn("#1a1814")}>🔗 Join</button>
      </div>

      {/* Search */}
      <div style={{ padding: "0 12px 10px", flexShrink: 0 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search groups..." style={inputS} />
      </div>

      {/* Group list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && <p style={{ textAlign: "center", padding: 20, color: "#6b6560", fontSize: 13 }}>Loading...</p>}
        {!loading && filtered.length === 0 && (
          <p style={{ textAlign: "center", padding: 24, color: "#6b6560", fontSize: 13 }}>
            {groups.length === 0 ? "No groups yet." : "No matches."}
          </p>
        )}
        {filtered.map(g => {
          const isActive = g.id === selectedId;
          const count    = g.members ? Object.keys(g.members).length : 0;
          return (
            <div key={g.id} onClick={() => onSelect(g.id)}
              style={{ padding: "11px 14px", cursor: "pointer", borderBottom: "1px solid #f0ede8", background: isActive ? "#eaf4ef" : "white", display: "flex", alignItems: "center", gap: 10, transition: "background .15s" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: g.banner || "#2d6a4f", flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1814", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
                <div style={{ fontSize: 11, color: "#6b6560", marginTop: 1 }}>{count} member{count !== 1 ? "s" : ""}</div>
              </div>
              {isActive && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#2d6a4f", flexShrink: 0 }} />}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modal && (
        <div onClick={e => e.target === e.currentTarget && setModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 14, padding: 24, width: "min(400px,92vw)", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18 }}>
              {modal === "create" ? "Create Group" : "Join by Invite Code"}
            </h3>

            {modal === "create" ? (
              <>
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
                        style={{ width: 28, height: 28, borderRadius: 6, background: c, cursor: "pointer", border: form.banner === c ? "3px solid #1a1814" : "2px solid transparent", flexShrink: 0 }} />
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
                style={{ background: busy ? "#aaa" : "#2d6a4f", color: "white", border: "none", borderRadius: 8, padding: "9px 22px", fontSize: 14, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer" }}>
                {busy ? "..." : modal === "create" ? "Create" : "Join"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b6560", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputS    = { width: "100%", padding: "9px 12px", border: "1.5px solid #ddd9d2", borderRadius: 8, fontSize: 14, background: "#f0ede8", color: "#1a1814", fontFamily: "inherit", boxSizing: "border-box" };
const cancelBtn = { background: "none", border: "1.5px solid #ddd9d2", borderRadius: 8, padding: "9px 18px", fontSize: 14, cursor: "pointer" };
function actionBtn(bg) {
  return { background: bg, color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer", flex: 1 };
}
