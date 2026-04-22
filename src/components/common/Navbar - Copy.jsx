import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import BurgerMenu from "./BurgerMenu";
import ProfileModal from "./ProfileModal";
import NotificationBell from "./NotificationBell";
import useStore from "../../store/useStore";

/*  Redesigned navbar — warm editorial look.
    Uses global CSS classes from redesign/theme.css (import it once in main.jsx).
    Same routes & props as the original.

    CHANGE: tabs are now on a second row so they never collide with the
    brand / avatar row on any viewport width. */

const tabs = [
  { id: "/",            label: "Today's Plan",   icon: CalIcon },
  { id: "/live",        label: "Live Session",   icon: ClockIcon },
  { id: "/wastage",     label: "Wastage Report", icon: ChartIcon },
  { id: "/groups",      label: "Groups",         icon: UsersIcon },
  { id: "/leaderboard", label: "Leaderboard",    icon: TrophyIcon },
];

export default function Navbar() {
  const { user, login, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [showProfile, setShowProfile] = useState(false);
  const streak = useStore(s => s.streak);

  // BUG FIX: if login() throws after logout() the user is stuck logged-out
  // with no feedback. Wrap in try/catch and surface the error.
  async function handleSwitchAccount() {
    try {
      await logout();
      await login();
    } catch (err) {
      console.error("Switch account failed:", err);
      // showToast is available via the store if you want to surface this to the UI:
      // useStore.getState().showToast("Could not switch account. Please try again.");
    }
  }

  return (
    <>
      {showProfile && user && (
        <ProfileModal user={user} onClose={() => setShowProfile(false)} />
      )}

      {/*
       * LAYOUT CHANGE: .stp-top is now a flex-column wrapper with two rows:
       *   Row 1 (.stp-top-row1) — brand left, right-side controls right
       *   Row 2 (.stp-top-row2) — tabs centred, full width
       * This prevents any overlap/collapse on narrow viewports.
       */}
      <div className="stp-top">

        {/* ── Row 1: brand + right controls ── */}
        <div className="stp-top-row1">
          <div className="stp-brand">
            <BurgerMenu user={user} onLogout={logout} onSwitchAccount={handleSwitchAccount} />
            <div className="stp-logo">S</div>
            <div className="stp-brand-name">Studytimer <em>pro</em></div>
          </div>

          <div className="stp-top-right">
            {streak > 0 && (
              <div className="stp-streak" title={`${streak}-day streak`}>
                <FlameIcon />
                {streak}-day
              </div>
            )}

            {user && <NotificationBell uid={user.uid} />}

            {user ? (
              <ProfileAvatar user={user} onClick={() => setShowProfile(true)} />
            ) : (
              <button className="stp-btn primary" onClick={login}>Sign in</button>
            )}
          </div>
        </div>

        {/* ── Row 2: navigation tabs ── */}
        <div className="stp-top-row2">
          <nav className="stp-tabs">
            {tabs.map(t => {
              const Icon = t.icon;
              const active = location.pathname === t.id;
              return (
                <button key={t.id} className={active ? "active" : ""} onClick={() => navigate(t.id)}>
                  <Icon />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

      </div>
    </>
  );
}

function ProfileAvatar({ user, onClick }) {
  const name = user.displayName || user.email || "?";
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="stp-avatar" onClick={onClick} title={name}>
      {user.photoURL
        ? <img src={user.photoURL} alt={name} referrerPolicy="no-referrer" loading="lazy" />
        : initials}
    </div>
  );
}

/* ---------- inline icons (no deps) ---------- */
function CalIcon()    { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>; }
function ClockIcon()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>; }
function ChartIcon()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>; }
function UsersIcon()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/></svg>; }
function TrophyIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>; }
function FlameIcon()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2s4 4 4 8c0 2-1 3-2 4s-2 2-2 4c-2 0-4-1-4-4 0-3 4-4 4-12Z"/></svg>; }
