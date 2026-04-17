import React from "react";

const BANNERS = ["#2d6a4f","#2563eb","#7c3aed","#dc2626","#d97706","#0891b2","#1a1814","#db2777"];
const ICONS   = ["📚","🎓","✏️","🔬","🧪","🧮","💻","🎯","🏆","📐","🌍","⚡","🔭","📊","🎨","🏫"];

export default function GroupEditModal({ editForm, setEditForm, onClose, onSave, busy }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--surface)", borderRadius: 14, padding: 24, width: "min(420px,92vw)", boxShadow: "0 20px 60px rgba(0,0,0,.2)", maxHeight: "90vh", overflowY: "auto" }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18, color: "var(--ink)" }}>Edit Group</h3>

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
        <EField label="Group Icon">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ICONS.map(ic => (
              <button key={ic} type="button" onClick={() => setEditForm({ ...editForm, icon: ic })}
                style={{ fontSize: 20, border: (editForm.icon || "📚") === ic ? "2px solid var(--accent)" : "2px solid transparent", borderRadius: 6, padding: 4, cursor: "pointer", background: "none", lineHeight: 1 }}>{ic}</button>
            ))}
          </div>
        </EField>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={cancelBtn}>Cancel</button>
          <button onClick={onSave} disabled={busy}
            style={{ background: busy ? "var(--border)" : "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "9px 22px", fontSize: 14, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer" }}>
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
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
