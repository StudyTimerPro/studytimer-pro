import React, { useEffect, useState } from "react";
import { listenSessionMaterials, deleteSessionMaterial } from "../../firebase/db";
import { MATERIAL_TYPES } from "../../utils/materialPrompts";
import { toPlainText } from "../../utils/cleanMarkdown";
import MaterialContent from "./MaterialContent";

const TYPE_LABEL = Object.fromEntries(MATERIAL_TYPES.map(t => [t.id, t.label]));

function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function MaterialHistory({
  user, examId, planId, session, showToast,
}) {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (!user || !examId || !planId || !session?.id) return;
    const u = listenSessionMaterials(user.uid, examId, planId, session.id, setList);
    return () => typeof u === "function" && u();
  }, [user, examId, planId, session?.id]);

  async function handleDelete(id) {
    if (!confirm("Delete this saved material?")) return;
    await deleteSessionMaterial(user.uid, examId, planId, session.id, id);
    if (open?.id === id) setOpen(null);
    showToast?.("Deleted");
  }

  if (open) {
    return (
      <div className="stp-mat-section">
        <div className="stp-mat-detail-head">
          <button className="stp-btn small ghost" onClick={() => setOpen(null)}>← Back</button>
          <div className="stp-mat-detail-meta">
            <div className="stp-mat-detail-name">{TYPE_LABEL[open.type] || open.type}</div>
            <div className="stp-mat-detail-sub">{fmtTime(open.createdAt)}</div>
          </div>
        </div>
        <div className="stp-mat-output" style={{ marginTop: 14 }}>
          <MaterialContent text={open.content} />
        </div>
      </div>
    );
  }

  if (!list.length) {
    return (
      <div className="stp-mat-section">
        <div className="stp-mat-empty-card">
          <div className="stp-mat-empty-emoji">📂</div>
          <div className="stp-mat-empty-title">No saved material yet</div>
          <div className="stp-mat-empty-desc">Generated content you save will show up here for later review.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="stp-mat-section">
      <div className="stp-mat-section-title">Saved ({list.length})</div>
      <div className="stp-mat-list">
        {list.map(h => (
          <div key={h.id} className="stp-mat-row">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="stp-mat-type">{TYPE_LABEL[h.type] || h.type} <span style={{ color: "var(--ink2)", fontWeight: 400 }}>· {fmtTime(h.createdAt)}</span></div>
              <div className="stp-mat-snip">{toPlainText(h.content).slice(0, 140)}…</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="stp-btn small" onClick={() => setOpen(h)}>Open</button>
              <button className="stp-btn small ghost" onClick={() => handleDelete(h.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
