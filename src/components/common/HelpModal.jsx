import React from "react";

const sections = [
  {
    icon: "📅",
    title: "Today's Plan",
    body: "Create your daily study sessions here. Add subjects, set start/end times, and mark them complete as you go.",
  },
  {
    icon: "⏱",
    title: "Live Session",
    body: "Start a real-time timer for an active session. The timer tracks exactly how long you studied and saves it automatically.",
  },
  {
    icon: "📊",
    title: "Wastage Report",
    body: "See where your time is going. Any planned sessions you missed are logged here so you can spot patterns and improve.",
  },
  {
    icon: "👥",
    title: "Groups",
    body: "Join or create study groups. Share your progress, chat with group members, and keep each other accountable.",
  },
  {
    icon: "🏆",
    title: "Leaderboard",
    body: "See how you stack up against other Lighthouse Prep users based on weekly study hours.",
  },
  {
    icon: "📄",
    title: "Export PDF",
    body: "Use the burger menu → Export PDF Report to download a full summary of your sessions and wastage history.",
  },
];

export default function HelpModal({ onClose }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div style={{ background: "var(--surface)", borderRadius: 16, padding: "32px 28px", width: "min(460px,100%)", boxShadow: "0 24px 64px rgba(0,0,0,.3)", maxHeight: "90vh", overflowY: "auto" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>❓ Help & Guide</h2>
        <p style={{ fontSize: 13, color: "var(--ink2)", marginBottom: 24 }}>Everything you need to know about Lighthouse Prep.</p>

        {sections.map(s => (
          <div key={s.title} style={{ marginBottom: 20, padding: "14px 16px", background: "var(--bg)", borderRadius: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 4 }}>{s.icon} {s.title}</div>
            <div style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6 }}>{s.body}</div>
          </div>
        ))}

        <div style={{ marginTop: 8, padding: "14px 16px", background: "var(--bg)", borderRadius: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 4 }}>💡 Tips</div>
          <ul style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.8, margin: 0, paddingLeft: 18 }}>
            <li>Use Dark Mode (burger menu) to reduce eye strain during night study.</li>
            <li>Set a realistic daily goal in Settings so the app can track your progress.</li>
            <li>Complete sessions in order to build a streak — streaks show in the burger menu.</li>
          </ul>
        </div>

        <button
          onClick={onClose}
          style={{ marginTop: 24, width: "100%", background: "var(--accent)", color: "white", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          Got it!
        </button>
      </div>
    </div>
  );
}
