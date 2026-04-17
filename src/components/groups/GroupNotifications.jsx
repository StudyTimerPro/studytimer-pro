import React from "react";
import { approveJoinRequest, rejectJoinRequest, approveGroupPlan, rejectGroupPlan } from "../../firebase/groupsDb";
import { approveLibraryItem, rejectLibraryItem } from "../../firebase/groupsLibrary";

export default function GroupNotifications({ groupId, joinRequests, pendingPlans, pendingLibrary, onClose, showToast }) {
  const total = joinRequests.length + pendingPlans.length + pendingLibrary.length;

  async function act(fn, okMsg, errMsg) {
    try { await fn(); showToast(okMsg); }
    catch (err) { console.error(err); showToast(errMsg); }
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 500, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: "16px 16px 0" }}>
      <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, width: "min(360px,95vw)", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>🔔 Notifications ({total})</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--ink2)", lineHeight: 1 }}>✕</button>
        </div>

        {total === 0 && <p style={{ color: "var(--ink2)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No pending items.</p>}

        {joinRequests.length > 0 && (
          <Section title={`👤 Join Requests (${joinRequests.length})`}>
            {joinRequests.map(r => (
              <NotifRow key={r.id} label={r.name} sub="Wants to join this group"
                onApprove={() => act(() => approveJoinRequest(groupId, r.uid, r.name, r.photo), `${r.name} approved ✓`, "Failed to approve")}
                onReject={()  => act(() => rejectJoinRequest(groupId, r.id), "Request rejected", "Failed to reject")}
              />
            ))}
          </Section>
        )}

        {pendingLibrary.length > 0 && (
          <Section title={`📚 Library Items (${pendingLibrary.length})`}>
            {pendingLibrary.map(i => (
              <NotifRow key={i.id} label={i.name} sub={`By ${i.uploadedByName}`}
                onApprove={() => act(() => approveLibraryItem(groupId, i.id), "Item approved ✓", "Failed")}
                onReject={()  => act(() => rejectLibraryItem(groupId, i.id), "Item rejected", "Failed")}
              />
            ))}
          </Section>
        )}

        {pendingPlans.length > 0 && (
          <Section title={`📅 Shared Plans (${pendingPlans.length})`}>
            {pendingPlans.map(p => {
              const sessions = Array.isArray(p.sessions) ? p.sessions : Object.values(p.sessions || {});
              return (
                <NotifRow key={p.id} label={p.name} sub={`By ${p.sharedByName} · ${sessions.length} session${sessions.length !== 1 ? "s" : ""}`}
                  onApprove={() => act(() => approveGroupPlan(groupId, p.id), "Plan approved ✓", "Failed")}
                  onReject={()  => act(() => rejectGroupPlan(groupId, p.id), "Plan rejected", "Failed")}
                />
              );
            })}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function NotifRow({ label, sub, onApprove, onReject }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--ink2)", marginTop: 1 }}>{sub}</div>
      </div>
      <button onClick={onApprove} style={aBtn("#eaf0fb", "#2563eb")}>✓</button>
      <button onClick={onReject}  style={aBtn("#fde8e8", "#e63946")}>✕</button>
    </div>
  );
}

const aBtn = (bg, color) => ({ background: bg, color, border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 });
