import React, { useEffect } from "react";
import { listenLeaderboard } from "../firebase/db";
import useStore from "../store/useStore";

const AVATARS = ["😀","😎","🧑","👩","🧠"];

export default function Leaderboard() {
  const { leaderboard, setLeaderboard } = useStore();

  useEffect(() => {
    const unsub = listenLeaderboard(setLeaderboard);
    return () => unsub();
  }, []); // eslint-disable-line

  const onlineCount = leaderboard.filter(u => u.status === "Online").length;
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div className="stp-content">
      <section className="stp-hero">
        <div>
          <h1>Leader<em>board</em></h1>
          <div className="stp-hero-sub">
            Weekly study hours · refreshes every 10 minutes
          </div>
        </div>
        <div className="stp-stats">
          <Stat label="Total"  value={leaderboard.length} />
          <Stat label="Online" value={onlineCount} />
          <Stat label="Top"    value={top3[0]?.weekHours || 0} unit="h" />
        </div>
      </section>

      {leaderboard.length === 0 ? (
        <div className="stp-groups-empty">
          <div className="ic">🏆</div>
          <h3>No <em>data</em> yet</h3>
          <p>Be the first to log study hours this week.</p>
        </div>
      ) : (
        <>
          {/* Podium — top 3 */}
          <div className="stp-podium">
            {top3[1] ? <PodiumCard u={top3[1]} rank={2} /> : <PodiumPlaceholder rank={2} />}
            {top3[0] ? <PodiumCard u={top3[0]} rank={1} /> : <PodiumPlaceholder rank={1} />}
            {top3[2] ? <PodiumCard u={top3[2]} rank={3} /> : <PodiumPlaceholder rank={3} />}
          </div>

          {/* Remaining ranks */}
          {rest.length > 0 && (
            <div>
              {rest.map((u, i) => <RankRow key={i} u={u} rank={i + 4} />)}
            </div>
          )}
        </>
      )}

      <div style={{ textAlign:"center", fontSize:11, color:"var(--ink3)", marginTop:20, fontFamily:"var(--mono)", letterSpacing:".08em", textTransform:"uppercase" }}>
        {leaderboard.length} entries · {onlineCount} online
      </div>
    </div>
  );
}

function PodiumCard({ u, rank }) {
  const tone   = rank === 1 ? "gold" : rank === 2 ? "silver" : "bronze";
  const medal  = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
  const avatar = AVATARS[(u.avatarId || 1) - 1] || "👤";
  const isOnline = u.status === "Online";
  return (
    <div className={`stp-podium-card ${tone}`}>
      <div className="medal">{medal}</div>
      <div style={{ fontSize:24, marginTop:4 }}>{avatar}</div>
      <div className="name">{u.name || "User"}</div>
      <div className="hours">{u.weekHours || 0}h</div>
      <div className="lbl">{isOnline ? "● Online" : "Offline"}</div>
    </div>
  );
}

function PodiumPlaceholder({ rank }) {
  const tone  = rank === 1 ? "gold" : rank === 2 ? "silver" : "bronze";
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
  return (
    <div className={`stp-podium-card ${tone}`} style={{ opacity:.55 }}>
      <div className="medal">{medal}</div>
      <div className="name">—</div>
      <div className="hours">0h</div>
      <div className="lbl">Open spot</div>
    </div>
  );
}

function RankRow({ u, rank }) {
  const avatar   = AVATARS[(u.avatarId || 1) - 1] || "👤";
  const isOnline = u.status === "Online";
  return (
    <div className="stp-rank-row">
      <div className="rank">#{rank}</div>
      <div className="who">
        <div className="av">{avatar}</div>
        <div style={{ minWidth:0 }}>
          <div className="name">{u.name || "User"}</div>
          <div className={`status${isOnline ? " online" : ""}`}>{isOnline ? "● Online" : "Offline"}</div>
        </div>
      </div>
      <div className="hours">{u.weekHours || 0}h</div>
    </div>
  );
}

function Stat({ label, value, unit }) {
  return (
    <div className="stp-stat">
      <div className="l">{label}</div>
      <div className="v">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  );
}
