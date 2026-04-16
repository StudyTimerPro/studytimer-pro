import React, { useState, useEffect, useRef } from "react";
import { savePlan, getUserTokens, decrementUserTokens } from "../../firebase/db";
import { callAIStream } from "../../utils/aiService";
import useStore from "../../store/useStore";

// ── Prompts ───────────────────────────────────────────────────────────────────
const SYSTEMS = [
  /* Tab 0 — Q&A */
  `You are an AI Study Coach. Help students with study questions, concepts, and exam prep. Be concise, clear, and encouraging.`,

  /* Tab 1 — Plan */
  `You are an AI Study Planner. Have a friendly conversation to understand the student's exam, subjects, available time, and weak areas. Once you have enough detail, generate the plan by outputting a JSON array inside <plan>…</plan> tags.
Each session object: { "name": string, "subject": string, "priority": "high"|"medium"|"low", "material": string, "start": "HH:MM", "end": "HH:MM", "breakMins": number }
Rules: sessions sequential, 45–90 min each, breakMins 0–15, no time overlaps.`,
];

const GREETING = {
  role: "assistant",
  content: "Hi! I'm your AI Study Coach 📚\n\nI'll help you build a personalized study plan through a quick conversation. How would you like to start?",
  buttons: [
    { label: "📚 Overall Plan",    bg: "#16a34a" },
    { label: "🎯 Specific Topics", bg: "#2563eb" },
  ],
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function AIPlanModal({ user, onClose, onCreated }) {
  const { showToast } = useStore();
  const [tab,    setTab]    = useState(0);
  const [chats,  setChats]  = useState([[], [GREETING]]);
  const [input,  setInput]  = useState("");
  const [busy,   setBusy]   = useState(false);
  const [tokens, setTokens] = useState(null);
  const endRef  = useRef(null);

  useEffect(() => { getUserTokens(user.uid).then(setTokens); }, [user.uid]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chats, tab]);

  const msgs = chats[tab];

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || busy) return;

    // Token gate — re-fetch for accuracy
    const live = await getUserTokens(user.uid);
    setTokens(live);
    if (live <= 0) { showToast("No AI tokens remaining"); return; }

    setInput("");
    const userMsg = { role: "user", content };

    // Clear quick-reply buttons from previous messages, append user + empty AI bubble
    setChats(prev => {
      const next = [...prev];
      next[tab]  = [...prev[tab].map(m => ({ ...m, buttons: undefined })), userMsg, { role: "assistant", content: "", streaming: true }];
      return next;
    });

    setBusy(true);
    let full = "";

    // Build clean history for API (strip UI-only fields)
    const history = msgs
      .map(m => ({ role: m.role, content: m.content }))
      .filter(m => m.content);

    try {
      await callAIStream(
        [{ role: "system", content: SYSTEMS[tab] }, ...history, userMsg],
        "gpt-4o-mini",

        // onChunk — append delta to last bubble
        chunk => {
          full += chunk;
          setChats(prev => {
            const next = [...prev];
            const msgs = [...prev[tab]];
            msgs[msgs.length - 1] = { role: "assistant", content: full, streaming: true };
            next[tab] = msgs;
            return next;
          });
        },

        // onDone — finalise bubble; extract plan if Tab 1
        async () => {
          setChats(prev => {
            const next = [...prev];
            const msgs = [...prev[tab]];
            msgs[msgs.length - 1] = { role: "assistant", content: full };
            next[tab] = msgs;
            return next;
          });

          if (tab === 1) {
            const match = full.match(/<plan>([\s\S]*?)<\/plan>/);
            if (match) {
              try {
                const sessions = JSON.parse(match[1].trim());
                if (Array.isArray(sessions) && sessions.length > 0) {
                  await Promise.all(sessions.map(s => savePlan(user.uid, { ...s, createdAt: Date.now() })));
                  await decrementUserTokens(user.uid);
                  setTokens(t => Math.max(0, (t ?? 1) - 1));
                  onCreated(sessions.length);   // toast + close in parent
                }
              } catch {
                showToast("Could not read plan — ask AI to regenerate it");
              }
            }
          }
          setBusy(false);
        }
      );
    } catch (err) {
      setChats(prev => {
        const next = [...prev];
        const msgs = [...prev[tab]];
        msgs[msgs.length - 1] = { role: "assistant", content: "Something went wrong. Please try again." };
        next[tab] = msgs;
        return next;
      });
      showToast(err.message || "AI error");
      setBusy(false);
    }
  }

  const noTokens = tokens !== null && tokens <= 0;

  return (
    <div style={S.wrap}>

      {/* ── Header ── */}
      <div style={S.header}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "white", marginBottom: 10 }}>
            🤖 AI Study Coach
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["💡 Ask Questions & Problem Solving", "📅 Study Plan Creation"].map((label, i) => (
              <button
                key={i} onClick={() => !busy && setTab(i)}
                style={{ ...S.tabBtn, background: tab === i ? "white" : "rgba(255,255,255,0.18)", color: tab === i ? "var(--accent)" : "white" }}
              >{label}</button>
            ))}
          </div>
        </div>
        <button onClick={onClose} style={S.closeBtn}>✕</button>
      </div>

      {/* ── Token strip ── */}
      {tokens !== null && (
        <div style={{ ...S.tokenStrip, background: noTokens ? "#fde8e8" : "var(--bg)", color: noTokens ? "#c0392b" : "var(--ink2)" }}>
          {noTokens
            ? "❌ No AI tokens remaining"
            : `🪙 ${tokens} AI generation${tokens !== 1 ? "s" : ""} remaining`}
        </div>
      )}

      {/* ── Messages ── */}
      <div style={S.msgs}>
        {msgs.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", marginBottom: 10 }}>
              {!isUser && (
                <span style={{ fontSize: 11, color: "var(--ink2)", marginBottom: 3, marginLeft: 4 }}>AI Coach</span>
              )}
              <div style={{ ...S.bubble, ...(isUser ? S.bubbleUser : S.bubbleAI) }}>
                {m.content}
                {m.streaming && <span style={{ opacity: 0.45 }}>▋</span>}
              </div>
              {m.buttons && (
                <div style={{ display: "flex", gap: 8, marginTop: 8, marginLeft: 4, flexWrap: "wrap" }}>
                  {m.buttons.map(b => (
                    <button key={b.label} onClick={() => send(b.label)} style={{ ...S.qrBtn, background: b.bg }}>
                      {b.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* ── Input bar ── */}
      <div style={S.bar}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={noTokens ? "No tokens remaining" : "Type a message…"}
          disabled={busy || noTokens}
          style={S.inp}
        />
        <button
          onClick={() => send()}
          disabled={busy || !input.trim() || noTokens}
          style={{ ...S.sendBtn, opacity: busy || !input.trim() || noTokens ? 0.4 : 1 }}
        >➤</button>
      </div>

    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  wrap:       { position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", background: "var(--bg)" },
  header:     { background: "var(--nav-bg)", padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 12, flexShrink: 0 },
  tabBtn:     { padding: "6px 14px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 20, cursor: "pointer", transition: "all .15s", whiteSpace: "nowrap" },
  closeBtn:   { background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 32, height: 32, color: "white", fontSize: 16, cursor: "pointer", flexShrink: 0 },
  tokenStrip: { padding: "5px 16px", fontSize: 12, borderBottom: "1px solid var(--border)", flexShrink: 0 },
  msgs:       { flex: 1, overflowY: "auto", padding: "20px 16px", display: "flex", flexDirection: "column" },
  bubble:     { maxWidth: "75%", padding: "10px 14px", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", boxShadow: "0 1px 3px rgba(0,0,0,.07)" },
  bubbleUser: { background: "var(--accent)", color: "white", borderRadius: "18px 18px 4px 18px", border: "none" },
  bubbleAI:   { background: "var(--surface)", color: "var(--ink)", borderRadius: "18px 18px 18px 4px", border: "1px solid var(--border)" },
  qrBtn:      { padding: "9px 18px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "white" },
  bar:        { display: "flex", gap: 10, padding: "12px 16px", background: "var(--surface)", borderTop: "1px solid var(--border)", flexShrink: 0 },
  inp:        { flex: 1, padding: "10px 16px", borderRadius: 24, border: "1.5px solid var(--border)", fontSize: 14, background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit", outline: "none" },
  sendBtn:    { background: "var(--accent)", color: "white", border: "none", borderRadius: "50%", width: 42, height: 42, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
};
