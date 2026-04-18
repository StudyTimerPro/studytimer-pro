import React from "react";

export default function GroupPlanCard({ plan, uid, isAdmin, onLike, onEnroll, onApprove, onPin, onRemove, onViewSessions }) {
  const sessions  = Array.isArray(plan.sessions) ? plan.sessions : Object.values(plan.sessions || {});
  const liked     = !!(plan.likes?.[uid]);
  const enrolled  = !!(plan.enrollments?.[uid]);
  const isPending = !plan.approved;

  return (
    <div
      style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: 16, position: "relative", display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 1px 6px rgba(0,0,0,.05)", transition: "box-shadow .15s" }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.12)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 6px rgba(0,0,0,.05)"}
    >
      {plan.pinned && <div style={{ position: "absolute", top: 10, right: 10, fontSize: 16, lineHeight: 1 }}>📌</div>}

      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", paddingRight: plan.pinned ? 28 : 0, lineHeight: 1.3, marginBottom: 6 }}>{plan.name}</div>
        <span style={{ fontSize: 10, fontWeight: 700, background: isPending ? "#fef3c7" : "#d1fae5", color: isPending ? "#d97706" : "#059669", borderRadius: 4, padding: "2px 6px" }}>
          {isPending ? "⏳ Pending" : "✓ Approved"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "white", fontWeight: 700, flexShrink: 0 }}>
          {(plan.sharedByName || "?").charAt(0).toUpperCase()}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plan.sharedByName || "Unknown"}</div>
      </div>

      <div style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--ink2)", flexWrap: "wrap" }}>
        <span>📋 {sessions.length} session{sessions.length !== 1 ? "s" : ""}</span>
        <span>👥 {plan.enrollCount || 0} enrolled</span>
        <span>❤️ {plan.likeCount || 0}</span>
      </div>

      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        <button onClick={onLike}
          style={{ ...smBtn, background: liked ? "#fde8e8" : "var(--bg)", color: liked ? "#e63946" : "var(--ink2)" }}>
          {liked ? "❤️" : "🤍"}
        </button>
        <button onClick={onViewSessions} style={{ ...smBtn, background: "var(--bg)", color: "var(--ink2)" }}>👁 View</button>
        <button onClick={onEnroll} disabled={enrolled || isPending}
          style={{ ...smBtn, flex: 1, justifyContent: "center", background: enrolled ? "#d1fae5" : isPending ? "var(--bg)" : "#eaf0fb", color: enrolled ? "#059669" : isPending ? "var(--ink2)" : "#2563eb", cursor: enrolled || isPending ? "default" : "pointer" }}>
          {enrolled ? "✅ Enrolled" : "➕ Enroll"}
        </button>
        {isAdmin && isPending && (
          <button onClick={onApprove} style={{ ...smBtn, background: "#eaf0fb", color: "#2563eb" }}>✓ Approve</button>
        )}
        {isAdmin && (
          <>
            <button onClick={onPin} style={{ ...smBtn, background: plan.pinned ? "#fef3c7" : "var(--bg)", color: plan.pinned ? "#d97706" : "var(--ink2)" }}>
              {plan.pinned ? "📌" : "📍"}
            </button>
            <button onClick={onRemove} style={{ ...smBtn, background: "#fde8e8", color: "#e63946" }}>🗑</button>
          </>
        )}
      </div>
    </div>
  );
}

const smBtn = { border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer", background: "var(--bg)", color: "var(--ink2)", display: "flex", alignItems: "center", gap: 3 };
