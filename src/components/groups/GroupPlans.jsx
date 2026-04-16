import React, { useEffect, useState } from "react";
import { loadMemberPlans } from "../../firebase/groupsDb";

export default function GroupPlans({ members, groupId }) {
  const [plans,   setPlans]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadMemberPlans(members)
      .then(setPlans)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [groupId]); // reload when group changes

  if (loading) return <p style={{ color: "#6b6560", padding: 8, fontSize: 13 }}>Loading plans...</p>;
  if (plans.length === 0) return <p style={{ color: "#6b6560", padding: 8, fontSize: 13 }}>No members found.</p>;

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "#1a1814" }}>Members' Today Plans</h3>
      {plans.map(({ uid, name, photo, sessions }) => {
        const sorted = sessions.slice().sort((a, b) => (a.start || "").localeCompare(b.start || ""));
        return (
          <div key={uid} style={{ background: "white", borderRadius: 10, padding: "14px 16px", marginBottom: 12, border: "1px solid #ddd9d2", boxShadow: "0 1px 6px rgba(0,0,0,.05)" }}>
            {/* Member header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: sessions.length > 0 ? 10 : 0 }}>
              {photo
                ? <img src={photo} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                : <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#ddd9d2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</div>}
              <span style={{ fontWeight: 600, fontSize: 14, color: "#1a1814", flex: 1 }}>{name}</span>
              <span style={{ fontSize: 12, color: "#6b6560" }}>
                {sessions.length} session{sessions.length !== 1 ? "s" : ""}
              </span>
            </div>

            {sessions.length === 0 ? (
              <p style={{ fontSize: 12, color: "#aaa", margin: 0 }}>No sessions planned today.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {sorted.map(s => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "7px 10px", background: "#f8f6f2", borderRadius: 8, gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 500 }}>{s.name}</span>
                      {s.subject && <span style={{ color: "#6b6560", fontSize: 11, marginLeft: 6 }}>({s.subject})</span>}
                    </div>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "#6b6560", whiteSpace: "nowrap" }}>
                      {fmt12(s.start)} – {fmt12(s.end)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function fmt12(t) {
  if (!t) return "—";
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}
