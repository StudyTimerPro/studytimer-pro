import React from "react";

const CSS = `@keyframes _la_spin { to { transform: rotate(360deg); } }`;

export default function LoadingAnimation({ size = 40, message }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <style>{CSS}</style>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        border: "3px solid var(--border)",
        borderTopColor: "var(--accent)",
        animation: "_la_spin .8s linear infinite",
        flexShrink: 0,
      }} />
      {message && <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink2)", textAlign: "center" }}>{message}</div>}
    </div>
  );
}

export function LoadingOverlay({ message, size = 40 }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.25)", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "inherit" }}>
      <LoadingAnimation size={size} message={message} />
    </div>
  );
}
