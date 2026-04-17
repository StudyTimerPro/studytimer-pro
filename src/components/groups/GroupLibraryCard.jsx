import React from "react";

function fileIcon(type) {
  if (type === "pdf")   return "📄";
  if (type === "txt")   return "📝";
  if (type === "image") return "🖼️";
  return "🔗";
}

export default function GroupLibraryCard({ item, uid, isAdmin, onView, onLike, onPin, onApprove, onRemove }) {
  const liked = !!(item.likes?.[uid]);

  return (
    <div
      style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: "14px 12px", position: "relative", display: "flex", flexDirection: "column", gap: 8, boxShadow: "0 1px 6px rgba(0,0,0,.05)", transition: "box-shadow .15s" }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.12)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 6px rgba(0,0,0,.05)"}
    >
      {item.pinned && <div style={{ position: "absolute", top: 8, right: 8, fontSize: 14, lineHeight: 1 }}>📌</div>}

      <div style={{ textAlign: "center", fontSize: 44, lineHeight: 1, paddingTop: 4 }}>{fileIcon(item.type)}</div>

      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.3, marginBottom: 4 }}>
          {item.name}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, background: item.approved ? "#d1fae5" : "#fef3c7", color: item.approved ? "#059669" : "#d97706", borderRadius: 4, padding: "1px 5px" }}>
          {item.approved ? "✓ Approved" : "⏳ Pending"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "white", fontWeight: 700, flexShrink: 0 }}>
          {(item.uploadedByName || "?").charAt(0).toUpperCase()}
        </div>
        <span style={{ fontSize: 11, color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.uploadedByName}</span>
      </div>

      <div style={{ fontSize: 11, color: "var(--ink2)", display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
        <span>👁 {item.viewCount || 0}</span>
        <span>❤️ {item.likeCount || 0}</span>
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: "auto" }}>
        <button onClick={onLike} style={{ ...smBtn, background: liked ? "#fde8e8" : "var(--bg)", color: liked ? "#e63946" : "var(--ink2)" }}>
          {liked ? "❤️" : "🤍"}
        </button>
        <button onClick={onView} style={{ ...smBtn, flex: 1, justifyContent: "center", background: "#eaf0fb", color: "#2563eb" }}>
          {item.type === "link" ? "🔗 Visit" : "⬇ View"}
        </button>
        {isAdmin && !item.approved && (
          <button onClick={onApprove} style={{ ...smBtn, background: "#eaf0fb", color: "#2563eb" }}>✓</button>
        )}
        {isAdmin && (
          <>
            <button onClick={onPin} style={{ ...smBtn, background: item.pinned ? "#fef3c7" : "var(--bg)", color: item.pinned ? "#d97706" : "var(--ink2)" }}>
              {item.pinned ? "📌" : "📍"}
            </button>
            <button onClick={onRemove} style={{ ...smBtn, background: "#fde8e8", color: "#e63946" }}>🗑</button>
          </>
        )}
      </div>
    </div>
  );
}

const smBtn = { border: "1px solid var(--border)", borderRadius: 6, padding: "4px 7px", fontSize: 11, fontWeight: 600, cursor: "pointer", background: "var(--bg)", color: "var(--ink2)", display: "flex", alignItems: "center", gap: 2 };
