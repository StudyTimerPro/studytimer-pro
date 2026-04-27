import React from "react";
import { parseMarkdown } from "../../utils/cleanMarkdown";

// Renders parsed blocks from cleanMarkdown — no raw ##, **, -- ever shown.
// Bold runs use <strong>; URLs become real links; headings get a styled block.

function Inline({ tokens }) {
  return tokens.map((t, i) => {
    if (t.kind === "bold") return <strong key={i}>{t.text}</strong>;
    if (t.kind === "link") return <a key={i} href={t.href} target="_blank" rel="noreferrer">{t.text}</a>;
    return <span key={i}>{t.text}</span>;
  });
}

export default function MaterialContent({ text, empty = "Nothing here yet." }) {
  const blocks = React.useMemo(() => parseMarkdown(text), [text]);
  if (!blocks.length) {
    return <div className="stp-mat-empty">{empty}</div>;
  }
  return (
    <div className="stp-mat-render">
      {blocks.map((b, i) => {
        if (b.kind === "heading") {
          const cls = `stp-mat-h stp-mat-h${b.level}`;
          return <div key={i} className={cls}><Inline tokens={b.inline} /></div>;
        }
        if (b.kind === "para") {
          return <p key={i} className="stp-mat-p"><Inline tokens={b.inline} /></p>;
        }
        if (b.kind === "ul") {
          return (
            <ul key={i} className="stp-mat-ul">
              {b.items.map((it, j) => <li key={j}><Inline tokens={it.inline} /></li>)}
            </ul>
          );
        }
        if (b.kind === "ol") {
          return (
            <ol key={i} className="stp-mat-ol">
              {b.items.map((it, j) => <li key={j}><Inline tokens={it.inline} /></li>)}
            </ol>
          );
        }
        if (b.kind === "divider") {
          return <div key={i} className="stp-mat-divider" />;
        }
        return null;
      })}
    </div>
  );
}
