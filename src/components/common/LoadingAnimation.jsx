import React, { useEffect, useState } from "react";
import Lottie from "lottie-react";

const CSS = `@keyframes _la_spin { to { transform: rotate(360deg); } }`;

export default function LoadingAnimation({ size = 80, message }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/loading.json").then(r => r.json()).then(setData).catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <style>{CSS}</style>
      {data
        ? <Lottie animationData={data} style={{ width: size, height: size }} loop autoplay />
        : <div style={{ width: size * 0.5, height: size * 0.5, borderRadius: "50%", border: "3px solid rgba(255,255,255,.35)", borderTopColor: "white", animation: "_la_spin 1s linear infinite" }} />
      }
      {message && <div style={{ fontSize: 13, fontWeight: 500, color: "white", textAlign: "center" }}>{message}</div>}
    </div>
  );
}

export function LoadingOverlay({ message, size = 60 }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "inherit" }}>
      <LoadingAnimation size={size} message={message} />
    </div>
  );
}
