import React, { useEffect, useMemo, useRef, useState } from "react";
import { callAI } from "../../utils/aiService";
import { extractTextFromFile, cleanAndCap } from "../../utils/extractText";
import {
  saveSessionMaterial, listenSessionMaterials, deleteSessionMaterial,
} from "../../firebase/db";

/*
 * Bottom-sheet "Session Material" feature.
 * - Upload flow: file (.txt/.md) OR pasted text → structured study material
 * - Create flow: topic + type + difficulty + length → AI-generated content
 * - Quick actions for one-tap generation (Quick Notes / 5 MCQs / Flashcards / Summary)
 * - Saved materials are persisted under the session and listed in this sheet.
 *
 * Cost rules (per spec): GPT-4o-mini only, send only topic/type/difficulty/length.
 */

const TYPES = [
  { id: "notes",      label: "Notes",      ic: "📝" },
  { id: "mcq",        label: "MCQs",       ic: "❓" },
  { id: "flashcards", label: "Flashcards", ic: "🎴" },
  { id: "summary",    label: "Summary",    ic: "📄" },
];
const DIFFS  = [{ id: "easy", label: "Easy" }, { id: "medium", label: "Medium" }, { id: "hard", label: "Hard" }];
const LENS   = [{ id: "quick", label: "Quick (1 min)" }, { id: "standard", label: "Standard" }, { id: "deep", label: "Deep" }];

function priorityToDifficulty(priority) {
  const p = String(priority || "").toLowerCase();
  if (p === "high") return "hard";
  if (p === "low")  return "easy";
  return "medium";
}

function buildPrompt({ type, topic, difficulty, length }) {
  const lenHint =
    length === "quick" ? "Keep it under ~150 words for a 1-minute read." :
    length === "deep"  ? "Be thorough; include depth and worked examples." :
                         "Standard length; concise and exam-focused.";
  if (type === "notes") {
    return `Create structured study notes on: ${topic}

Include:
- Key concepts
- Definitions
- Examples
- Important formulas (if applicable)
- Quick revision points

${lenHint}
Difficulty: ${difficulty}.
Use clear markdown headings and bullet points.`;
  }
  if (type === "mcq") {
    const n = length === "quick" ? 5 : length === "deep" ? 15 : 10;
    return `Create ${n} TNPSC-style MCQs on: ${topic}

Rules:
- 4 options per question (A–D)
- Only one correct answer
- Provide the correct answer below each question
- Add a short explanation (1–2 lines)

Difficulty: ${difficulty}.`;
  }
  if (type === "flashcards") {
    const n = length === "quick" ? 5 : length === "deep" ? 15 : 10;
    return `Create ${n} flashcards for: ${topic}

Format each as:
Q: <question>
A: <answer>

Focus on key concepts. Difficulty: ${difficulty}.`;
  }
  // summary
  return `Summarize ${topic} into a 1-page quick revision sheet.

Include:
- Key points
- Important terms
- Quick facts

${lenHint}
Difficulty: ${difficulty}.
Use markdown bullet points.`;
}

function buildUploadPrompt(extracted) {
  return `You are a study assistant.
Analyze the uploaded content and convert into structured study material.

Output format:
1. Key Concepts (bullet points)
2. Short Summary (max 150 words)
3. Important Points to Remember
4. 5 MCQs with answers
5. 3 Revision Questions

Keep it simple, clear, and exam-focused.

CONTENT:
---
${extracted}
---`;
}

const TYPE_LABEL = Object.fromEntries(TYPES.map(t => [t.id, t.label]));

export default function SessionMaterialSheet({
  user, examId, planId, session, onClose, showToast,
  initialQuickType, // optional: "notes" | "mcq" — opens generating immediately
}) {
  const sheetRef = useRef(null);
  const [step, setStep] = useState("home"); // home | upload | create | output
  const [type, setType] = useState("notes");
  const [topic, setTopic] = useState(session?.name || "");
  const [difficulty, setDifficulty] = useState(priorityToDifficulty(session?.priority));
  const [length, setLength] = useState("standard");
  const [pasted, setPasted] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState("");
  const [outputType, setOutputType] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Lock body scroll while sheet is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Subscribe to saved materials
  useEffect(() => {
    if (!user || !examId || !planId || !session?.id) return;
    const unsub = listenSessionMaterials(user.uid, examId, planId, session.id, setHistory);
    return () => typeof unsub === "function" && unsub();
  }, [user, examId, planId, session?.id]);

  // One-tap from card: open already running
  useEffect(() => {
    if (!initialQuickType) return;
    runGenerate({
      mode: "create",
      type: initialQuickType,
      topic: session?.name || "",
      difficulty: priorityToDifficulty(session?.priority),
      length: initialQuickType === "mcq" ? "quick" : "quick",
      forcedType: initialQuickType,
    });
    // eslint-disable-next-line
  }, []);

  async function runGenerate(args = {}) {
    const t      = args.type      ?? type;
    const tp     = (args.topic    ?? topic).trim();
    const diff   = args.difficulty ?? difficulty;
    const len    = args.length     ?? length;
    if (!tp) { showToast?.("Topic is required"); return; }

    setBusy(true);
    setStep("output");
    setOutputType(t);
    setOutput("");
    try {
      const userMsg = args.mode === "upload"
        ? buildUploadPrompt(args.extracted || "")
        : buildPrompt({ type: t, topic: tp, difficulty: diff, length: len });

      const text = await callAI(
        [
          { role: "system", content: "You are a concise, exam-focused study assistant. Reply in clean markdown." },
          { role: "user", content: userMsg },
        ],
        "gpt-4o-mini",
        0.5,
      );
      setOutput(text || "");
    } catch (err) {
      setOutput(`⚠️ Generation failed: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadGenerate() {
    let extracted = pasted.trim();
    if (!extracted) { showToast?.("Upload a file or paste some content"); return; }
    extracted = cleanAndCap(extracted);
    runGenerate({ mode: "upload", type: "notes", extracted });
  }

  async function handleFilePick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await extractTextFromFile(file);
      setPasted(text);
      showToast?.("File loaded — review and generate");
    } catch (err) {
      showToast?.(err.message || String(err));
    }
  }

  async function handleSave() {
    if (!output || !user || !examId || !planId || !session?.id) return;
    try {
      await saveSessionMaterial(user.uid, examId, planId, session.id, {
        type: outputType || "notes",
        content: output,
        meta: { topic, difficulty, length },
      });
      showToast?.("Saved to session ✓");
    } catch (err) {
      showToast?.("Save failed: " + (err.message || err));
    }
  }

  function handleExport() {
    if (!output) return;
    const blob = new Blob([output], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(session?.name || "material").replace(/[^a-z0-9-_ ]+/gi, "_").trim()}_${outputType || "notes"}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function handleConvert(nextType) {
    runGenerate({ mode: "create", type: nextType });
    setType(nextType);
  }

  async function handleDelete(materialId) {
    if (!confirm("Delete this saved material?")) return;
    await deleteSessionMaterial(user.uid, examId, planId, session.id, materialId);
    showToast?.("Deleted");
  }

  const headerInfo = useMemo(() => ([
    { l: "Topic",    v: session?.name || "—" },
    { l: "Duration", v: durationLabel(session) },
    { l: "Priority", v: prettyPri(session?.priority) },
  ]), [session]);

  return (
    <div className="stp-sheet-scrim" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={sheetRef} className="stp-sheet" role="dialog" aria-label="Session Material">
        <div className="stp-sheet-handle" />
        <div className="stp-sheet-head">
          <div>
            <h3>Session <em>Material</em></h3>
            <div className="stp-sheet-info">
              {headerInfo.map(b => (
                <div key={b.l} className="stp-sheet-chip">
                  <span className="l">{b.l}</span>
                  <span className="v">{b.v}</span>
                </div>
              ))}
            </div>
          </div>
          <button className="stp-act" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="stp-sheet-body">
          {step === "home" && (
            <>
              {/* Quick suggestions — one-tap */}
              <div className="stp-sheet-section">
                <div className="stp-sheet-section-title">Quick actions</div>
                <div className="stp-quick-chip-row">
                  <button className="stp-quick-chip" onClick={() => runGenerate({ mode: "create", type: "notes", length: "quick" })}>
                    📝 Quick notes
                  </button>
                  <button className="stp-quick-chip" onClick={() => runGenerate({ mode: "create", type: "mcq", length: "quick" })}>
                    ❓ 5 MCQs
                  </button>
                  <button className="stp-quick-chip" onClick={() => runGenerate({ mode: "create", type: "flashcards", length: "quick" })}>
                    🎴 Flashcards
                  </button>
                  <button className="stp-quick-chip" onClick={() => runGenerate({ mode: "create", type: "summary", length: "quick" })}>
                    📄 Summary
                  </button>
                </div>
              </div>

              {/* Mode selection */}
              <div className="stp-sheet-section">
                <div className="stp-sheet-section-title">Or choose a mode</div>
                <div className="stp-mode-grid">
                  <button className="stp-mode-card" onClick={() => setStep("upload")}>
                    <div className="stp-mode-ic">📂</div>
                    <div className="stp-mode-name">Upload content</div>
                    <div className="stp-mode-desc">Drop a .txt or paste content — we'll structure it.</div>
                  </button>
                  <button className="stp-mode-card" onClick={() => setStep("create")}>
                    <div className="stp-mode-ic">✨</div>
                    <div className="stp-mode-name">Create from topic</div>
                    <div className="stp-mode-desc">Auto-uses session topic. Pick type & difficulty.</div>
                  </button>
                </div>
              </div>

              {/* Saved materials */}
              {history.length > 0 && (
                <div className="stp-sheet-section">
                  <button className="stp-sheet-toggle" onClick={() => setHistoryOpen(o => !o)}>
                    {historyOpen ? "▾" : "▸"} Saved ({history.length})
                  </button>
                  {historyOpen && (
                    <div className="stp-mat-list">
                      {history.map(h => (
                        <div key={h.id} className="stp-mat-row">
                          <div style={{ minWidth: 0 }}>
                            <div className="stp-mat-type">{TYPE_LABEL[h.type] || h.type}</div>
                            <div className="stp-mat-snip">{(h.content || "").slice(0, 90).replace(/\n/g, " ")}…</div>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="stp-act" title="Open" onClick={() => { setOutput(h.content); setOutputType(h.type); setStep("output"); }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                            <button className="stp-act danger" title="Delete" onClick={() => handleDelete(h.id)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {step === "upload" && (
            <div className="stp-sheet-section">
              <div className="stp-sheet-section-title">Upload or paste content</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label className="stp-file-drop">
                  <input type="file" accept=".txt,.md,.csv,.json,.html,.htm,text/*" onChange={handleFilePick} hidden />
                  <span>📂 Choose file (.txt, .md)</span>
                  {fileName && <em>{fileName}</em>}
                </label>
                <textarea
                  className="stp-input"
                  rows={8}
                  placeholder="…or paste your study content here"
                  value={pasted}
                  onChange={e => setPasted(e.target.value)}
                  style={{ resize: "vertical", fontFamily: "inherit" }}
                />
              </div>
              <div className="stp-sheet-actions">
                <button className="stp-btn" onClick={() => setStep("home")}>Back</button>
                <button className="stp-btn primary" onClick={handleUploadGenerate} disabled={busy}>
                  {busy ? "Generating…" : "Generate material"}
                </button>
              </div>
            </div>
          )}

          {step === "create" && (
            <div className="stp-sheet-section">
              <div className="stp-sheet-section-title">Create from topic</div>
              <div className="stp-field">
                <label>Topic</label>
                <input className="stp-input" value={topic} onChange={e => setTopic(e.target.value)} />
              </div>
              <div className="stp-field">
                <label>Type</label>
                <div className="stp-pill-row">
                  {TYPES.map(t => (
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
                      <button key={d.id} className={`stp-pill${difficulty === d.id ? " on" : ""}`} onClick={() => setDifficulty(d.id)}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="stp-field">
                  <label>Length</label>
                  <div className="stp-pill-row">
                    {LENS.map(l => (
                      <button key={l.id} className={`stp-pill${length === l.id ? " on" : ""}`} onClick={() => setLength(l.id)}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="stp-sheet-actions">
                <button className="stp-btn" onClick={() => setStep("home")}>Back</button>
                <button className="stp-btn primary" onClick={() => runGenerate({ mode: "create" })} disabled={busy}>
                  {busy ? "Generating…" : "Generate"}
                </button>
              </div>
            </div>
          )}

          {step === "output" && (
            <div className="stp-sheet-section">
              <div className="stp-sheet-section-title">
                {outputType ? TYPE_LABEL[outputType] || "Material" : "Material"}
                {busy && <span style={{ marginLeft: 10, fontSize: 12, color: "var(--ink2)" }}>generating…</span>}
              </div>
              <div className="stp-mat-output">
                {output ? <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>{output}</pre>
                        : <div style={{ color: "var(--ink2)" }}>{busy ? "Working on it…" : "Nothing generated yet."}</div>}
              </div>
              {!busy && output && (
                <>
                  <div className="stp-sheet-section-title" style={{ marginTop: 16 }}>Convert</div>
                  <div className="stp-pill-row">
                    {TYPES.filter(t => t.id !== outputType).map(t => (
                      <button key={t.id} className="stp-pill" onClick={() => handleConvert(t.id)}>
                        {t.ic} {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="stp-sheet-actions">
                    <button className="stp-btn" onClick={() => setStep("home")}>Back</button>
                    <button className="stp-btn" onClick={() => runGenerate({ mode: "create" })} disabled={busy}>Regenerate</button>
                    <button className="stp-btn" onClick={handleExport}>Export</button>
                    <button className="stp-btn primary" onClick={handleSave}>Save to session</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function durationLabel(s) {
  if (!s) return "—";
  if (Number(s.durationMins) > 0) {
    const m = Number(s.durationMins);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  }
  if (s.start && s.end) {
    const [sh, sm] = s.start.split(":").map(Number);
    const [eh, em] = s.end.split(":").map(Number);
    const m = Math.max((eh * 60 + em) - (sh * 60 + sm), 0);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  }
  return "—";
}
function prettyPri(p) {
  if (!p) return "Medium";
  return p[0].toUpperCase() + p.slice(1);
}
