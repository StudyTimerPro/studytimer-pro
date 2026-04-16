import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import BurgerMenu from "./BurgerMenu";

const tabs = [
  { id: "/",            label: "📅 Today's Plan" },
  { id: "/live",        label: "⏱ Live Session" },
  { id: "/wastage",     label: "📊 Wastage Report" },
  { id: "/groups",      label: "👥 Groups" },
  { id: "/leaderboard", label: "🏆 Leaderboard" },
];

export default function Navbar() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <>
      {/* Top bar */}
      <div style={{
        background: "#1a1814",
        color: "white",
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BurgerMenu user={user} />
          <h1 style={{ fontFamily: "monospace", fontSize: 18, letterSpacing: -0.5 }}>
            📚 StudyTimer Pro
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
          <span style={{ opacity: 0.8 }}>
            {user ? user.displayName : "Not logged in"}
          </span>
          <button
            onClick={user ? logout : login}
            style={{
              background: "#2d6a4f",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "7px 14px",
              fontSize: 13,
              cursor: "pointer"
            }}
          >
            {user ? "Sign out" : "Sign in with Google"}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        background: "white",
        borderBottom: "2px solid #ddd9d2",
        padding: "0 24px",
        display: "flex",
        gap: 4,
        overflowX: "auto"
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
                borderBottom: isActive ? "3px solid #2d6a4f" : "3px solid transparent",
                marginBottom: -2,
                color: isActive ? "#2d6a4f" : "#6b6560",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color .2s"
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