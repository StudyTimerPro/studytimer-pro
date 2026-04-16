const AI_FUNCTION_URL = "https://aichat-zdg7ljsrha-uc.a.run.app";

export async function callAI(messages, model = "gpt-4o-mini") {
  const res = await fetch(AI_FUNCTION_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ messages, model, stream: false }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `AI error ${res.status}`);
  }

  const data = await res.json();
  console.log("[callAI] full response:", data);
  return data.text ?? data.choices?.[0]?.message?.content ?? data.content ?? "";
}

export async function callAIStream(messages, model = "gpt-4o-mini", onChunk, onDone) {
  const res = await fetch(AI_FUNCTION_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ messages, model, stream: true }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `AI error ${res.status}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    // keep the last (potentially incomplete) line in the buffer
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const payload = trimmed.slice(5).trim();
      if (!payload) continue;

      try {
        const parsed = JSON.parse(payload);
        console.log("[callAIStream] chunk received:", parsed);

        if (parsed.done) {
          onDone?.();
          return;
        }

        const content = parsed.content ?? "";
        if (content) onChunk(content);
      } catch {
        // non-JSON SSE line — skip
      }
    }
  }

  onDone?.();
}
