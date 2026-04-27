// Lightweight, dependency-free text extractor for the Session Material upload
// flow. Keeps cost down by trimming whitespace and capping length before the
// extracted text is sent to the AI.

const MAX_CHARS = 6000;

export async function extractTextFromFile(file) {
  if (!file) throw new Error("No file");
  const name = (file.name || "").toLowerCase();
  const type = file.type || "";

  if (type.startsWith("text/") || /\.(txt|md|csv|json|html?)$/.test(name)) {
    const raw = await file.text();
    return cleanAndCap(raw);
  }

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    // pdfjs-dist isn't bundled — point the user to paste content instead.
    throw new Error("PDF extraction not available — paste the content into the text box below.");
  }

  if (type.startsWith("image/")) {
    throw new Error("Image OCR not available — paste the content into the text box below.");
  }

  // Fallback: try to read as text anyway. Many docs (e.g. .rtf) yield usable text.
  const raw = await file.text().catch(() => "");
  if (!raw.trim()) throw new Error("Couldn't read this file — try a .txt file or paste content directly.");
  return cleanAndCap(raw);
}

export function cleanAndCap(text) {
  const cleaned = String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (cleaned.length <= MAX_CHARS) return cleaned;
  return cleaned.slice(0, MAX_CHARS) + "\n\n[content truncated]";
}
