import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import BurgerMenu from "./BurgerMenu";
import ProfileModal from "./ProfileModal";

const tabs = [
  { id: "/",            label: "📅 Today's Plan" },
  { id: "/live",        label: "⏱ Live Session" },
  { id: "/wastage",     label: "📊 Wastage Report" },
  { id: "/groups",      label: "👥 Groups" },
  { id: "/leaderboard", label: "🏆 Leaderboard" },
];

export default function Navbar() {
  const { user, login, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [showProfile, setShowProfile] = useState(false);

  async function handleSwitchAccount() {
    await logout();
    await login();
  }

  return (
    <>
      {showProfile && user && (
        <ProfileModal user={user} onClose={() => setShowProfile(false)} />
      )}
      {/* Top bar */}
      <div style={{
        background: "var(--nav-bg)",
        color: "white",
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BurgerMenu user={user} onLogout={logout} onSwitchAccount={handleSwitchAccount} />
          <h1 style={{ fontFamily: "monospace", fontSize: 18, letterSpacing: -0.5 }}>
            📚 StudyTimer Pro
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user ? (
            <ProfileAvatar user={user} onClick={() => setShowProfile(true)} />
          ) : (
            <button
              onClick={login}
              style={{
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "7px 14px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Sign in with Google
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        background: "var(--surface)",
        borderBottom: "2px solid var(--border)",
        padding: "0 24px",
        display: "flex",
        gap: 4,
        overflowX: "auto",
      }}>
        {tabs.map(t => {
          const isActive = location.pathname === t.id;
          return (
            <button
              key={t.id}
              onClick={() => navigate(t.id)}
              style={{
                padding: "13px 20px",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 500,
                background: "none",
                border: "none",
                borderBottom: isActive ? "3px solid var(--accent)" : "3px solid transparent",
                marginBottom: -2,
                color: isActive ? "var(--accent)" : "var(--ink2)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color .2s",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

function ProfileAvatar({ user, onClick }) {
  const name    = user.displayName || user.email || "?";
  const initials = name
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <div
        title={name}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          overflow: "hidden",
          border: "2px solid rgba(255,255,255,0.35)",
          flexShrink: 0,
          background: "var(--accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 700,
          color: "white",
          userSelect: "none",
        }}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={name}
            referrerPolicy="no-referrer"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          initials
        )}
      </div>
      <span style={{ fontSize: 14, opacity: 0.9, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name}
      </span>
    </div>
  );
}
