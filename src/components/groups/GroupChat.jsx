import React, { useEffect, useState, useRef } from "react";
import { sendMessage } from "../../firebase/groupsDb";

export default function GroupChat({ group, user, messages }) {
  const [text,    setText]    = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await sendMessage(group.id, user.uid, user, trimmed);
      setText("");
    } catch { /* silent */ }
    finally  { setSending(false); }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function timeLabel(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      {/* Message list */}
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
            <div key={msg.id} style={{ textAlign: "center", fontSize: 12, color: "var(--ink2)", padding: "2px 0" }}>
              {msg.text}
            </div>
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
                {!isMe && (
                  <div style={{ fontSize: 11, color: "var(--ink2)", marginBottom: 2, marginLeft: 4 }}>{msg.name}</div>
                )}
                <div style={{
                  background: isMe ? "var(--accent)" : "var(--surface)",
                  color: isMe ? "white" : "var(--ink)",
                  borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  padding: "9px 13px", fontSize: 14, lineHeight: 1.4,
                  border: isMe ? "none" : "1px solid var(--border)",
                  boxShadow: "0 1px 4px rgba(0,0,0,.07)",
                  wordBreak: "break-word",
                }}>
                  {msg.text}
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

      {/* Input bar */}
      <div style={{ padding: "10px 14px 12px", borderTop: "1px solid var(--border)", background: "var(--surface)", display: "flex", gap: 8, flexShrink: 0 }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Message… (Enter to send, Shift+Enter for new line)"
          rows={2}
          style={{ flex: 1, padding: "9px 12px", border: "1.5px solid var(--border)", borderRadius: 10, fontSize: 14, fontFamily: "inherit", resize: "none", background: "var(--bg)", color: "var(--ink)", outline: "none", lineHeight: 1.4 }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          style={{ background: text.trim() && !sending ? "var(--accent)" : "var(--border)", color: "white", border: "none", borderRadius: 10, padding: "0 16px", fontSize: 20, cursor: text.trim() && !sending ? "pointer" : "not-allowed", alignSelf: "stretch", transition: "background .2s" }}>
          ➤
        </button>
      </div>
    </div>
  );
}
