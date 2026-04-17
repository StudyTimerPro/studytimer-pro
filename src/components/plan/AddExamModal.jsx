import React, { useState } from "react";
import useStore from "../../store/useStore";
import { useAuth } from "../../hooks/useAuth";
import { saveExam, saveUserSettings } from "../../firebase/db";

export default function AddExamModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const { showToast, settings, setSettings } = useStore();
  const [name, setName] = useState("");
  const [date, setDate] = useState(settings?.examDate || "");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!user) { showToast("Please sign in first"); return; }
    if (!name.trim()) { showToast("Exam name required"); return; }
    setBusy(true);
    try {
      const examId = await saveExam(user.uid, { name: name.trim() });
      if (date && date !== settings?.examDate) {
        await saveUserSettings(user.uid, { examDate: date });
        setSettings({ ...(settings || {}), examDate: date });
      }
      showToast("Exam added ✓");
      onCreated?.(examId, name.trim());
    } catch (err) {
      showToast(err.message || "Could not save exam");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={S.backdrop}>
      <div style={S.modal}>
        <h3 style={S.title}>Add Exam</h3>

        <Field label="Exam Name">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. SSC JE Electrical"
            style={S.input}
            autoFocus
          />
        </Field>

        <Field label="Exam Date (optional)">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={S.input}
          />
        </Field>

        <div style={S.actions}>
          <button onClick={onClose} disabled={busy} style={S.cancel}>Cancel</button>
          <button onClick={handleSave} disabled={busy} style={S.save}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

const S = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" },
  modal:    { background: "var(--surface)", borderRadius: 14, padding: 24, width: "min(420px, 94vw)", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" },
  title:    { fontSize: 18, marginBottom: 16, color: "var(--ink)" },
  label:    { fontSize: 12, fontWeight: 600, color: "var(--ink2)", textTransform: "uppercase", letterSpacing: 0.4 },
  input:    { width: "100%", padding: "9px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit" },
  actions:  { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 },
  cancel:   { background: "none", border: "1.5px solid var(--border)", borderRadius: 8, padding: "9px 20px", fontSize: 14, cursor: "pointer", color: "var(--ink)" },
  save:     { background: "var(--accent)", color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 500, cursor: "pointer" },
};
