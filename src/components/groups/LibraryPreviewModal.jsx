import React, { useEffect, useState } from "react";

export default function LibraryPreviewModal({ item, onClose }) {
  const [txt, setTxt]         = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item || item.type !== "txt") return;
    setLoading(true);
    fetch(item.url).then(r => r.text())
      .then(t => { setTxt(t); setLoading(false); })
      .catch(() => { setTxt("Failed to load content."); setLoading(false); });
  }, [item?.url]);

  if (!item || (item.type !== "image" && item.type !== "txt")) return null;

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 14, width: "min(600px,100%)", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--ink2)", padding: "0 4px", lineHeight: 1, flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {item.type === "image" && (
            <div style={{ textAlign: "center" }}>
              <img src={item.url} alt={item.name} style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 8 }} />
            </div>
          )}
          {item.type === "txt" && (
            loading
              ? <p style={{ color: "var(--ink2)", textAlign: "center" }}>Loading...</p>
              : <pre style={{ fontSize: 13, color: "var(--ink)", whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: 1.6, margin: 0 }}>{txt}</pre>
          )}
        </div>

        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: "none", border: "1.5px solid var(--border)", borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: "var(--ink)" }}>Close</button>
        </div>
      </div>
    </div>
  );
}
