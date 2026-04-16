import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { getUserGroups } from "../firebase/groupsDb";
import useStore from "../store/useStore";
import GroupSidebar from "../components/groups/GroupSidebar";
import GroupView    from "../components/groups/GroupView";

function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return m;
}

export default function Groups() {
  const { user }     = useAuth();
  const { showToast } = useStore();
  const isMobile     = useIsMobile();
  const [groups,     setGroups]     = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadGroups = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const list = await getUserGroups(user.uid);
      setGroups(list);
      if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
    } catch { showToast("Failed to load groups"); }
    finally   { setLoading(false); }
  }, [user]); // eslint-disable-line

  useEffect(() => { loadGroups(); }, [loadGroups]);

  if (!user) return (
    <div style={{ textAlign: "center", padding: 60, color: "#6b6560" }}>
      <div style={{ fontSize: 48 }}>👥</div>
      <p style={{ marginTop: 12 }}>Sign in to access Groups.</p>
    </div>
  );

  const selected = groups.find(g => g.id === selectedId) || null;

  // Sidebar: fixed drawer on mobile, inline on desktop
  const sidebarStyle = isMobile
    ? { position: "fixed", top: 0, left: drawerOpen ? 0 : "-300px", width: 280, height: "100vh", background: "white", zIndex: 300, transition: "left .25s ease", overflowY: "auto", boxShadow: drawerOpen ? "4px 0 24px rgba(0,0,0,.2)" : "none" }
    : { width: 260, flexShrink: 0, background: "white", borderRight: "1px solid #ddd9d2", overflowY: "auto" };

  return (
    <div style={{ display: "flex", margin: "-24px -16px", minHeight: "calc(100vh - 114px)" }}>
      {/* Mobile backdrop */}
      {isMobile && drawerOpen && (
        <div onClick={() => setDrawerOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 299 }} />
      )}

      {/* Sidebar */}
      <div style={sidebarStyle}>
        <GroupSidebar
          groups={groups} selectedId={selectedId} user={user} loading={loading}
          onSelect={id => { setSelectedId(id); setDrawerOpen(false); }}
          onGroupsChange={setGroups}
          showToast={showToast}
          onClose={() => setDrawerOpen(false)}
          isMobile={isMobile}
        />
      </div>

      {/* Main area */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "#f0ede8" }}>
        {/* Mobile top bar */}
        {isMobile && (
          <div style={{ padding: "10px 14px", background: "white", borderBottom: "1px solid #ddd9d2", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <button onClick={() => setDrawerOpen(true)} style={menuBtn}>☰</button>
            <span style={{ fontWeight: 600, fontSize: 14, color: "#1a1814" }}>
              {selected?.name || "Select a Group"}
            </span>
          </div>
        )}

        {selected ? (
          <GroupView
            key={selected.id}
            group={selected}
            user={user}
            showToast={showToast}
            onGroupUpdated={g => setGroups(prev => prev.map(x => x.id === g.id ? { ...x, ...g } : x))}
            onLeave={() => { setGroups(prev => prev.filter(g => g.id !== selectedId)); setSelectedId(null); }}
            onRefresh={loadGroups}
          />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#6b6560", padding: 40, textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 48 }}>👥</div>
              <p style={{ marginTop: 12, fontSize: 14 }}>
                {groups.length ? "Select a group from the sidebar." : "Create or join a group to get started."}
              </p>
              {isMobile && (
                <button onClick={() => setDrawerOpen(true)} style={{ ...menuBtn, marginTop: 16, padding: "10px 20px" }}>
                  Open Groups
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const menuBtn = { background: "#1a1814", color: "white", border: "none", borderRadius: 6, padding: "7px 13px", fontSize: 13, cursor: "pointer" };
