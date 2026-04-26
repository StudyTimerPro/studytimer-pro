import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { getUserGroups } from "../firebase/groupsDb";
import useStore from "../store/useStore";
import GroupSidebar from "../components/groups/GroupSidebar";
import GroupView    from "../components/groups/GroupView";

function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return m;
}

export default function Groups() {
  const { user }      = useAuth();
  const { showToast } = useStore();
  const isMobile      = useIsMobile();
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
    <div className="stp-content">
      <section className="stp-hero">
        <div>
          <h1>Study <em>groups</em></h1>
          <div className="stp-hero-sub">Join study groups to share progress with peers.</div>
        </div>
      </section>
      <div className="stp-groups-empty">
        <div className="ic">👥</div>
        <h3>Sign in to <em>continue</em></h3>
        <p>Sign in to access your groups, chats and shared plans.</p>
      </div>
    </div>
  );

  const selected = groups.find(g => g.id === selectedId) || null;

  const sidebarStyle = isMobile
    ? { position:"fixed", top:0, left: drawerOpen ? 0 : "-300px", width:280, height:"100vh", background:"var(--surface)", zIndex:300, transition:"left .25s ease", overflowY:"auto", boxShadow: drawerOpen ? "4px 0 24px rgba(0,0,0,.2)" : "none", borderRight:"1px solid var(--border)" }
    : { width:260, flexShrink:0, height:"100%", background:"var(--surface)", borderRight:"1px solid var(--border)", overflowY:"auto" };

  return (
    <div style={{ display:"flex", height:"100%", overflow:"hidden" }}>
      {isMobile && drawerOpen && (
        <div onClick={() => setDrawerOpen(false)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:299 }} />
      )}

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

      <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", background:"var(--bg)" }}>
        {isMobile && (
          <div className="stp-groups-mobile-bar">
            <button className="menu" onClick={() => setDrawerOpen(true)} aria-label="Open groups">☰</button>
            <span className="title">{selected?.name || "Select a group"}</span>
          </div>
        )}

        {selected ? (
          <GroupView
            key={selected.id} group={selected} user={user} showToast={showToast}
            onGroupUpdated={g => setGroups(prev => prev.map(x => x.id === g.id ? { ...x, ...g } : x))}
            onLeave={() => { setGroups(prev => prev.filter(g => g.id !== selectedId)); setSelectedId(null); }}
            onRefresh={loadGroups}
          />
        ) : (
          <div className="stp-content" style={{ overflowY:"auto", flex:1 }}>
            <section className="stp-hero">
              <div>
                <h1>Study <em>groups</em></h1>
                <div className="stp-hero-sub">
                  {groups.length
                    ? <>You're in <b>{groups.length}</b> group{groups.length !== 1 ? "s" : ""}. Pick one to view.</>
                    : <>Create or join a group to start sharing progress with peers.</>}
                </div>
              </div>
            </section>

            <div className="stp-groups-empty">
              <div className="ic">👥</div>
              <h3>{groups.length ? "Select a group" : <>Start a <em>group</em></>}</h3>
              <p>
                {groups.length
                  ? "Open the sidebar to choose any of your groups."
                  : "Create your first study group, or join one with an invite code."}
              </p>
              {isMobile && (
                <button onClick={() => setDrawerOpen(true)}
                  style={{ background:"var(--accent)", color:"#fff", border:"none", borderRadius:999, padding:"10px 22px", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                  Open groups
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
