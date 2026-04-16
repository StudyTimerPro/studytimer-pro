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
    <div>
      {/* Stats bar */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <Chip label="Total Users" value={leaderboard.length} />
        <Chip label="Online Now"  value={onlineCount} color="#2d6a4f" />
      </div>

      {/* Leaderboard list */}
      {leaderboard.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#6b6560" }}>
          <div style={{ fontSize: 40 }}>🏆</div>
          <p style={{ marginTop: 12 }}>No leaderboard data yet.</p>
        </div>
      ) : leaderboard.map((u, i) => (
        <LeaderCard key={i} user={u} rank={i + 1} />
      ))}

      <div style={{ textAlign: "center", fontSize: 12, color: "#aaa", marginTop: 16 }}>
        Updates every 10 minutes · Total entries: {leaderboard.length} · Online: {onlineCount}
      </div>
    </div>
  );
}

function LeaderCard({ user: u, rank }) {
  const isOnline = u.status === "Online";
  const avatars  = ["😀","😎","🧑","👩","🧠"];
  const avatar   = avatars[(u.avatarId || 1) - 1] || "👤";

  let medal = "";
  let cardBg = "white";
  let cardBorder = "#ddd9d2";

  if (rank === 1) { medal = "🥇"; cardBg = "#ffeaa7"; cardBorder = "#f9ca24"; }
  if (rank === 2) { medal = "🥈"; cardBg = "#f0f0f0"; }
  if (rank === 3) { medal = "🥉"; cardBg = "#fde3d8"; cardBorder = "#fab1a0"; }

  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "14px 18px", marginBottom: 8, borderRadius: 12,
      background: cardBg, border: `1px solid ${cardBorder}`,
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 24 }}>{avatar}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{medal} {u.name || "User"}</div>
          <div style={{ fontSize: 12, color: isOnline ? "#27ae60" : "#aaa", marginTop: 2 }}>
            {isOnline ? "🟢 Online" : "⚫ Offline"}
          </div>
        </div>
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 12, color: "#6b6560" }}>#{rank}</div>
      <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, color: "#2d6a4f" }}>
        {u.weekHours || 0}h
      </div>
    </div>
  );
}

function Chip({ label, value, color = "#1a1814" }) {
  return (
    <div style={{ background: "white", border: "1px solid #ddd9d2", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontFamily: "monospace" }}>
      {label}: <span style={{ fontWeight: 700, color }}>{value}</span>
    </div>
  );
}