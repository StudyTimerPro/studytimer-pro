import React, { useEffect, useState } from "react";
import { callAI } from "../../utils/aiService";
import { extractTextFromFile, cleanAndCap } from "../../utils/extractText";
import {
  MATERIAL_TYPES, priorityToDifficulty,
  buildSimplePrompt, buildUploadPrompt,
} from "../../utils/materialPrompts";
import { saveSessionMaterial } from "../../firebase/db";
import MaterialContent from "./MaterialContent";

const DIFFS = [
  { id: "easy",   label: "Easy"   },
  { id: "medium", label: "Medium" },
  { id: "hard",   label: "Hard"   },
];
const LENS = [
  { id: "quick",    label: "Quick" },
  { id: "standard", label: "Standard" },
  { id: "deep",     label: "Deep" },
];

const TYPE_LABEL = Object.fromEntries(MATERIAL_TYPES.map(t => [t.id, t.label]));

export default function MaterialHome({
  user, examId, planId, session, examName, showToast, initialQuickType, onOpenHierarchy,
}) {
  const [mode, setMode]       = useState("home"); // home | upload | create | output
  const [type, setType]       = useState("notes");
  const [topic, setTopic]     = useState(session?.name || "");
  const [diff, setDiff]       = useState(priorityToDifficulty(session?.priority));
  const [length, setLength]   = useState("standard");
  const [pasted, setPasted]   = useState("");
  const [fileName, setFile]   = useState("");
  const [busy, setBusy]       = useState(false);
  const [output, setOutput]   = useState("");
  const [outType, setOutType] = useState(null);

  useEffect(() => {
    if (!initialQuickType) return;
    runGenerate({ mode: "create", type: initialQuickType, length: "quick", topic: session?.name || "" });
    // eslint-disable-next-line
  }, []);

  async function runGenerate(args = {}) {
    if (args.type === "hierarchy") { onOpenHierarchy?.(); return; }

    const t   = args.type   ?? type;
    const tp  = (args.topic ?? topic).trim();
    const d   = args.difficulty ?? diff;
    const len = args.length ?? length;
    if (!tp) { showToast?.("Topic is required"); return; }

    setBusy(true); setMode("output"); setOutType(t); setOutput("");
    try {
      const userMsg = args.uploadText
        ? buildUploadPrompt(args.uploadText)
        : buildSimplePrompt({ type: t, topic: tp, difficulty: d, length: len, examName });
      const text = await callAI(
        [
          { role: "system", content: "You are a concise, exam-focused study assistant. Write plain prose with light bullets. Do not use # headings, ** bold markers, or --- separators." },
          { role: "user", content: userMsg },
        ],
        "gpt-4o-mini", 0.5
      );
      setOutput(text || "");
    } catch (err) {
      setOutput(`Generation failed: ${err.message || err}`);
    } finally { setBusy(false); }
  }

  async function handleUploadGenerate() {
    const t = pasted.trim();
    if (!t) { showToast?.("Upload a file or paste content first"); return; }
    runGenerate({ uploadText: cleanAndCap(t), type: "notes" });
  }

  async function handleFile(e) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setFile(f.name);
    try {
      const text = await extractTextFromFile(f);
      setPasted(text);
      showToast?.("File loaded — review and generate");
    } catch (err) { showToast?.(err.message || String(err)); }
  }

  async function handleSave() {
    if (!output || !user) return;
    try {
      await saveSessionMaterial(user.uid, examId, planId, session.id, {
        type: outType || "notes",
        content: output,
        meta: { topic, difficulty: diff, length },
      });
      showToast?.("Saved to session");
    } catch (err) { showToast?.("Save failed: " + (err.message || err)); }
  }

  function handleExport() {
    if (!output) return;
    const blob = new Blob([output], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safe = (session?.name || "material").replace(/[^a-z0-9-_ ]+/gi, "_").trim();
    a.download = `${safe}_${outType || "notes"}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  return (
    <>
      {mode === "home" && (
        <>
          <div className="stp-mat-section">
            <div className="stp-mat-section-title">Quick actions</div>
            <div className="stp-quick-chip-row">
              <button className="stp-quick-chip" onClick={() => runGenerate({ type: "notes",   length: "quick" })}>📝 Quick notes</button>
              <button className="stp-quick-chip" onClick={() => runGenerate({ type: "mcq",     length: "quick" })}>❓ 5 MCQs</button>
              <button className="stp-quick-chip" onClick={() => runGenerate({ type: "summary", length: "quick" })}>📄 Summary</button>
              <button className="stp-quick-chip" onClick={onOpenHierarchy}>🗂 Topic hierarchy</button>
            </div>
          </div>

          <div className="stp-mat-section">
            <div className="stp-mat-section-title">Or pick a mode</div>
            <div className="stp-mode-grid">
              <button className="stp-mode-card" onClick={() => setMode("upload")}>
                <div className="stp-mode-ic">📂</div>
                <div className="stp-mode-name">Upload content</div>
                <div className="stp-mode-desc">Drop a .txt/.md file or paste content — we'll structure it.</div>
              </button>
              <button className="stp-mode-card" onClick={() => setMode("create")}>
                <div className="stp-mode-ic">✨</div>
                <div className="stp-mode-name">Create from topic</div>
                <div className="stp-mode-desc">Auto-uses session topic. Pick type & difficulty.</div>
              </button>
            </div>
          </div>
        </>
      )}

      {mode === "upload" && (
        <div className="stp-mat-section">
          <div className="stp-mat-section-title">Upload or paste content</div>
          <label className="stp-file-drop">
            <input type="file" accept=".txt,.md,.csv,.json,.html,.htm,text/*" onChange={handleFile} hidden />
            <span>📂 Choose file (.txt, .md)</span>
            {fileName && <em>{fileName}</em>}
          </label>
          <textarea
            className="stp-input"
            rows={10}
            placeholder="…or paste your study content here"
            value={pasted}
            onChange={e => setPasted(e.target.value)}
            style={{ resize: "vertical", fontFamily: "inherit", marginTop: 10 }}
          />
          <div className="stp-mat-actions">
            <button className="stp-btn" onClick={() => setMode("home")}>Back</button>
            <button className="stp-btn primary" onClick={handleUploadGenerate} disabled={busy}>
              {busy ? "Generating…" : "Generate material"}
            </button>
          </div>
        </div>
      )}

      {mode === "create" && (
        <div className="stp-mat-section">
          <div className="stp-mat-section-title">Create from topic</div>
          <div className="stp-field">
            <label>Topic</label>
            <input className="stp-input" value={topic} onChange={e => setTopic(e.target.value)} />
          </div>
          <div className="stp-field">
            <label>Type</label>
            <div className="stp-pill-row">
              {MATERIAL_TYPES.filter(t => t.id !== "hierarchy").map(t => (
                <button key={t.id} className={`stp-pill${type === t.id ? " on" : ""}`} onClick={() => setType(t.id)}>
                  <span aria-hidden>{t.ic}</span> {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="stp-row-2">
            <div className="stp-field">
              <label>Difficulty</label>
              <div className="stp-pill-row">
                {DIFFS.map(d => (
                  <button key={d.id} className={`stp-pill${diff === d.id ? " on" : ""}`} onClick={() => setDiff(d.id)}>{d.label}</button>
                ))}
              </div>
            </div>
            <div className="stp-field">
              <label>Length</label>
              <div className="stp-pill-row">
                {LENS.map(l => (
                  <button key={l.id} className={`stp-pill${length === l.id ? " on" : ""}`} onClick={() => setLength(l.id)}>{l.label}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="stp-mat-actions">
            <button className="stp-btn" onClick={() => setMode("home")}>Back</button>
            <button className="stp-btn primary" onClick={() => runGenerate({})} disabled={busy}>
              {busy ? "Generating…" : "Generate"}
            </button>
          </div>
        </div>
      )}

      {mode === "output" && (
        <div className="stp-mat-section">
          <div className="stp-mat-section-title">
            {outType ? TYPE_LABEL[outType] || "Material" : "Material"}
            {busy && <span style={{ marginLeft: 10, fontSize: 12, color: "var(--ink2)" }}>generating…</span>}
          </div>
          <div className="stp-mat-output">
            {busy && !output ? <div className="stp-mat-empty">Working on it…</div> :
              <MaterialContent text={output} empty="Nothing generated yet." />}
          </div>
          {!busy && output && (
            <>
              <div className="stp-mat-section-title" style={{ marginTop: 16 }}>Convert</div>
              <div className="stp-pill-row">
                {MATERIAL_TYPES.filter(t => t.id !== outType && t.id !== "hierarchy").map(t => (
                  <button key={t.id} className="stp-pill" onClick={() => runGenerate({ type: t.id })}>{t.ic} {t.label}</button>
                ))}
              </div>
              <div className="stp-mat-actions">
                <button className="stp-btn" onClick={() => setMode("home")}>Back</button>
                <button className="stp-btn" onClick={() => runGenerate({})} disabled={busy}>Regenerate</button>
                <button className="stp-btn" onClick={handleExport}>Export</button>
                <button className="stp-btn primary" onClick={handleSave}>Save to session</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
