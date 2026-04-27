// cleanMarkdown.js
// Parses raw AI markdown into a clean block tree for the Material UI.
// Strips: ##/###, **/__, ---, leading bullet markers (-, *, •).
// Preserves: bold runs (rendered with <strong>), URLs, ordered/unordered lists,
//            headings (rendered as styled blocks), paragraph spacing.

const URL_RE = /(https?:\/\/[^\s)]+)/g;
const BOLD_RE = /\*\*(.+?)\*\*|__(.+?)__/g;

function stripBoldMarkers(s) {
  return String(s || "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1");
}

// Returns array of inline tokens: { kind: "text"|"bold"|"link", text, href? }
export function parseInline(line) {
  const out = [];
  if (!line) return out;
  let s = String(line);

  // Pass 1: split by bold runs while preserving them
  const bolds = [];
  let last = 0;
  s.replace(BOLD_RE, (m, a, b, idx) => {
    if (idx > last) bolds.push({ bold: false, text: s.slice(last, idx) });
    bolds.push({ bold: true, text: a || b });
    last = idx + m.length;
    return m;
  });
  if (last < s.length) bolds.push({ bold: false, text: s.slice(last) });

  // Pass 2: extract URLs from each segment
  for (const seg of bolds) {
    const t = seg.text;
    let p = 0;
    URL_RE.lastIndex = 0;
    let m;
    while ((m = URL_RE.exec(t))) {
      if (m.index > p) out.push({ kind: seg.bold ? "bold" : "text", text: t.slice(p, m.index) });
      out.push({ kind: "link", text: m[0], href: m[0] });
      p = m.index + m[0].length;
    }
    if (p < t.length) out.push({ kind: seg.bold ? "bold" : "text", text: t.slice(p) });
  }
  return out.filter(t => t.text && t.text.length);
}

// Block kinds: heading (level 1..3), para, ul, ol, divider, mcq-q, mcq-opt, kv
export function parseMarkdown(raw) {
  if (!raw) return [];
  const lines = String(raw).replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];

  let para = [];
  let list = null; // { kind: "ul"|"ol", items: [] }

  const flushPara = () => {
    if (para.length) {
      const text = para.join(" ").trim();
      if (text) blocks.push({ kind: "para", inline: parseInline(text) });
      para = [];
    }
  };
  const flushList = () => {
    if (list && list.items.length) blocks.push(list);
    list = null;
  };
  const flushAll = () => { flushPara(); flushList(); };

  // Labels rendered with bold prefix on the same line (Answer: X, Why: X …)
  const KV_LABEL_RE = /^(Answer|Ans|Correct\s*answer|Why|Explanation|Reason|Solution|Hint|Note|Tip|Trap|Shortcut|Common\s*mistake|Quick\s*check|Solving\s*time|Priority|When\s*asked|Marks?|Difficulty|Format)\s*[:\-–]\s*(.+)$/i;

  for (let raw of lines) {
    const line = raw.replace(/\t/g, "  ");
    const stripped = line.trim();

    if (!stripped) { flushAll(); continue; }

    // Marker for "load-more" boundary inserted between batches
    if (stripped === "--more--") {
      flushAll();
      blocks.push({ kind: "divider", variant: "more" });
      continue;
    }

    // Divider: ---, ***, ===, or strings of dashes / equals
    if (/^[-=*_]{3,}$/.test(stripped)) {
      flushAll();
      blocks.push({ kind: "divider" });
      continue;
    }

    // Heading: # / ## / ### — convert to styled heading blocks
    const hMatch = stripped.match(/^(#{1,6})\s*(.+?)\s*#*$/);
    if (hMatch) {
      flushAll();
      const level = Math.min(hMatch[1].length, 3);
      const text = stripBoldMarkers(hMatch[2]).replace(/[:\s]+$/, "");
      blocks.push({ kind: "heading", level, inline: parseInline(text) });
      continue;
    }

    // MCQ question: "Q1.", "Q1)", "Question 1:"
    const qMatch = stripped.match(/^(?:Q\.?\s*(\d+)|Question\s+(\d+))[.)\s:-]+\s*(.+)$/i);
    if (qMatch) {
      flushAll();
      const num = qMatch[1] || qMatch[2];
      blocks.push({
        kind: "mcq-q",
        num: String(num),
        inline: parseInline(stripBoldMarkers(qMatch[3])),
      });
      continue;
    }

    // MCQ option: "A)", "A.", "(A)" followed by text
    const optMatch = stripped.match(/^[(\[]?([A-Da-d])[)\].]\s+(.+)$/);
    if (optMatch) {
      flushPara();
      flushList();
      blocks.push({
        kind: "mcq-opt",
        letter: optMatch[1].toUpperCase(),
        inline: parseInline(optMatch[2]),
      });
      continue;
    }

    // Inline label rows: "Answer: B", "Why: …", "Hint: …", etc.
    const kvMatch = stripped.match(KV_LABEL_RE);
    if (kvMatch) {
      flushAll();
      blocks.push({
        kind: "kv",
        label: kvMatch[1],
        inline: parseInline(kvMatch[2]),
      });
      continue;
    }

    // Numbered list: "1.", "1)" — preserve ordinal
    const olMatch = stripped.match(/^(\d+)[.)]\s+(.+)$/);
    if (olMatch) {
      flushPara();
      if (!list || list.kind !== "ol") { flushList(); list = { kind: "ol", items: [] }; }
      list.items.push({ inline: parseInline(olMatch[2]) });
      continue;
    }

    // Bullet list: -, *, •
    const ulMatch = stripped.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      flushPara();
      if (!list || list.kind !== "ul") { flushList(); list = { kind: "ul", items: [] }; }
      list.items.push({ inline: parseInline(ulMatch[1]) });
      continue;
    }

    // Section-style "label:" lines that look like mini-headings
    // Only treat short lines (<60 chars) ending with ':' as label heads
    if (stripped.length < 60 && /:$/.test(stripped) && !/[.?!]/.test(stripped.slice(0, -1))) {
      flushAll();
      blocks.push({
        kind: "heading",
        level: 3,
        inline: parseInline(stripBoldMarkers(stripped.replace(/:$/, ""))),
      });
      continue;
    }

    // Otherwise: accumulate paragraph
    flushList();
    para.push(stripped);
  }
  flushAll();
  return blocks;
}

// Quick plain-text version (used for previews and saved-snippet listing)
export function toPlainText(raw) {
  return String(raw || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^[-*•]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/^[-=*_]{3,}\s*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
