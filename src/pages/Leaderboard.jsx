import React, { useEffect } from "react";
import { listenLeaderboard } from "../firebase/db";
import useStore from "../store/useStore";

export default function Leaderboard() {
  const { leaderboard, setLeaderboard } = useStore();

  useEffect(() => {
    const unsub = listenLeaderboard(setLeaderboard);
    return () => unsub();
  }, []);

  const onlineCount = leaderboard.filter(u => u.status === "Online").length;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <Chip label="Total Users" value={leaderboard.length} />
        <Chip label="Online Now"  value={onlineCount} color="var(--accent)" />
      </div>

      {leaderboard.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--ink2)" }}>
          <div style={{ fontSize: 40 }}>🏆</div>
          <p style={{ marginTop: 12 }}>No leaderboard data yet.</p>
        </div>
      ) : leaderboard.map((u, i) => (
        <LeaderCard key={i} user={u} rank={i + 1} />
      ))}

      <div style={{ textAlign: "center", fontSize: 12, color: "var(--ink2)", marginTop: 16 }}>
        Updates every 10 minutes · Total entries: {leaderboard.length} · Online: {onlineCount}
      </div>
    </div>
  );
}

function LeaderCard({ user: u, rank }) {
  const isOnline = u.status === "Online";
  const avatars  = ["😀","😎","🧑","👩","🧠"];
  const avatar   = avatars[(u.avatarId || 1) - 1] || "👤";

  // Medal backgrounds — intentionally keep warm tones in both modes
  let medal = "", cardBg = "var(--surface)", cardBorder = "var(--border)";
  if (rank === 1) { medal = "🥇"; cardBg = "#ffeaa7"; cardBorder = "#f9ca24"; }
  if (rank === 2) { medal = "🥈"; cardBg = "var(--bg)"; }
  if (rank === 3) { medal = "🥉"; cardBg = "#fde3d8"; cardBorder = "#fab1a0"; }

  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "14px 18px", marginBottom: 8, borderRadius: 12,
      background: cardBg, border: `1px solid ${cardBorder}`,
      boxShadow: "var(--shadow)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 24 }}>{avatar}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{medal} {u.name || "User"}</div>
          <div style={{ fontSize: 12, color: isOnline ? "#27ae60" : "var(--ink2)", marginTop: 2 }}>
            {isOnline ? "🟢 Online" : "⚫ Offline"}
          </div>
        </div>
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--ink2)" }}>#{rank}</div>
      <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, color: "var(--accent)" }}>
        {u.weekHours || 0}h
      </div>
    </div>
  );
}

function Chip({ label, value, color = "var(--ink)" }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontFamily: "monospace", color: "var(--ink)" }}>
      {label}: <span style={{ fontWeight: 700, color }}>{value}</span>
    </div>
  );
}
