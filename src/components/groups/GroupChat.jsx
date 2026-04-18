import React, { useEffect, useState, useRef } from "react";
import { sendMessage } from "../../firebase/groupsDb";

export default function GroupChat({ group, user, messages }) {
  const [text,         setText]         = useState("");
  const [sending,      setSending]      = useState(false);
  const [mentionSearch,setMentionSearch]= useState(null);
  const [mentionIdx,   setMentionIdx]   = useState(0);
  const bottomRef  = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const allMembers = Object.entries(group.members || {})
    .filter(([uid]) => uid !== user.uid)
    .map(([uid, m]) => ({ uid, name: m.name || "Member" }));

  const mentionables = mentionSearch === null ? [] : allMembers
    .filter(m => m.name.toLowerCase().includes(mentionSearch.toLowerCase()))
    .slice(0, 5);

  function handleChange(e) {
    const val    = e.target.value;
    setText(val);
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const atIdx  = before.lastIndexOf("@");
    if (atIdx !== -1) {
      const query = before.slice(atIdx + 1);
      if (!query.includes(" ")) { setMentionSearch(query); setMentionIdx(0); return; }
    }
    setMentionSearch(null);
  }

  function insertMention(member) {
    const cursor = textareaRef.current?.selectionStart ?? text.length;
    const before = text.slice(0, cursor);
    const atIdx  = before.lastIndexOf("@");
    const newText = text.slice(0, atIdx) + `@${member.name} ` + text.slice(cursor);
    setText(newText);
    setMentionSearch(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function handleKey(e) {
    if (mentionSearch !== null && mentionables.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, mentionables.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === "Escape")    { setMentionSearch(null); return; }
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); insertMention(mentionables[mentionIdx]); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const mentions = allMembers.filter(m => trimmed.includes(`@${m.name}`));
    try {
      await sendMessage(group.id, user.uid, user, trimmed, mentions);
      setText(""); setMentionSearch(null);
    } catch { }
    finally { setSending(false); }
  }

  function timeLabel(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function renderText(text, mentions) {
    if (!mentions?.length) return text;
    let parts = [text];
    for (const m of mentions) {
      const tag = `@${m.name}`;
      parts = parts.flatMap(part => {
        if (typeof part !== "string") return [part];
        const segs = part.split(tag);
        return segs.flatMap((s, i) => i < segs.length - 1
          ? [s, <span key={`${m.uid}-${i}`} style={{ color: "#2563eb", fontWeight: 700 }}>{tag}</span>]
          : [s]
        );
      });
    }
    return parts;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--ink2)", padding: "40px 20px", fontSize: 14 }}>
            No messages yet. Say hello! 👋
          </div>
        )}
        {messages.map(msg => {
          const isMe     = msg.uid === user.uid;
          const isSystem = msg.uid === "system";
          if (isSystem) return (
            <div key={msg.id} style={{ textAlign: "center", fontSize: 12, color: "var(--ink2)", padding: "2px 0" }}>{msg.text}</div>
          );
          return (
            <div key={msg.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-end", gap: 8 }}>
              {!isMe && (
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--border)", overflow: "hidden", flexShrink: 0 }}>
                  {msg.photo
                    ? <img src={msg.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>👤</div>}
                </div>
              )}
              <div style={{ maxWidth: "72%", minWidth: 60 }}>
                {!isMe && <div style={{ fontSize: 11, color: "var(--ink2)", marginBottom: 2, marginLeft: 4 }}>{msg.name}</div>}
                <div style={{ background: isMe ? "var(--accent)" : "var(--surface)", color: isMe ? "white" : "var(--ink)", borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "9px 13px", fontSize: 14, lineHeight: 1.4, border: isMe ? "none" : "1px solid var(--border)", boxShadow: "0 1px 4px rgba(0,0,0,.07)", wordBreak: "break-word" }}>
                  {renderText(msg.text, msg.mentions)}
                </div>
                <div style={{ fontSize: 10, color: "var(--ink2)", marginTop: 2, textAlign: isMe ? "right" : "left", paddingLeft: isMe ? 0 : 4 }}>
                  {timeLabel(msg.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "10px 14px 12px", borderTop: "1px solid var(--border)", background: "var(--surface)", display: "flex", gap: 8, flexShrink: 0, position: "relative" }}>
        {mentionSearch !== null && mentionables.length > 0 && (
          <div style={{ position: "absolute", bottom: "100%", left: 14, right: 68, zIndex: 100, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,.15)", maxHeight: 200, overflowY: "auto", marginBottom: 4 }}>
            {mentionables.map((m, i) => (
              <div key={m.uid} onMouseDown={e => { e.preventDefault(); insertMention(m); }}
                style={{ padding: "8px 12px", cursor: "pointer", background: i === mentionIdx ? "var(--accent-light)" : "transparent", fontSize: 13, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8, borderBottom: i < mentionables.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "white", fontWeight: 700, flexShrink: 0 }}>{(m.name || "?")[0].toUpperCase()}</div>
                {m.name}
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder="Message… (@ to mention)"
          rows={2}
          style={{ flex: 1, padding: "9px 12px", border: "1.5px solid var(--border)", borderRadius: 10, fontSize: 14, fontFamily: "inherit", resize: "none", background: "var(--bg)", color: "var(--ink)", outline: "none", lineHeight: 1.4 }}
        />
        <button onClick={handleSend} disabled={!text.trim() || sending}
          style={{ background: text.trim() && !sending ? "var(--accent)" : "var(--border)", color: "white", border: "none", borderRadius: 10, padding: "0 16px", fontSize: 20, cursor: text.trim() && !sending ? "pointer" : "not-allowed", alignSelf: "stretch", transition: "background .2s" }}>
          ➤
        </button>
      </div>
    </div>
  );
}
