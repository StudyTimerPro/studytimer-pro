const AI_FUNCTION_URL = "https://aichat-zdg7ljsrha-uc.a.run.app";

// ─── Basic call helpers ─────────────────────────────────────────────────────
export async function callAI(messages, model = "gpt-4o-mini", temperature = 0.7) {
  const res = await fetch(AI_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, model, stream: false, temperature }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `AI error ${res.status}`);
  }
  const data = await res.json();
  return data.text ?? data.choices?.[0]?.message?.content ?? data.content ?? "";
}

export async function callAIStream(messages, model = "gpt-4o-mini", onChunk, onDone) {
  const res = await fetch(AI_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, model, stream: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `AI error ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload) continue;
      try {
        const parsed = JSON.parse(payload);
        if (parsed.done) { onDone?.(); return; }
        const content = parsed.content ?? "";
        if (content) onChunk?.(content);
      } catch { /* skip */ }
    }
  }
  onDone?.();
}

// ─── Language helpers ───────────────────────────────────────────────────────
export function getLanguageReminder(language) {
  const lang = (language || "english").toLowerCase();
  if (lang === "tamil")
    return "Reminder: Always reply in Tanglish (Tamil + English mix) with friendly tone and emojis.";
  if (lang === "hindi")
    return "Reminder: Always reply in Hinglish (Hindi + English mix) with friendly tone and emojis.";
  return `Reminder: Always reply in ${lang}+English mixed style with friendly tone and emojis.`;
}

export function getLanguageSample(language) {
  const lang = (language || "english").toLowerCase();
  if (lang === "tamil") return "Example: Hey bro 😎! Naan unaku study coach da 💪🔥";
  if (lang === "hindi") return "Example: Hey bhai 😄! Main tera study coach hoon 💪✨";
  return "Example: Hey! Let's prep together 😎🔥";
}

// ─── Time helpers ───────────────────────────────────────────────────────────
export function parseTimeToMinutes(t) {
  try {
    const [h, m] = t.split(":").map(x => parseInt(x, 10));
    return h * 60 + (m || 0);
  } catch { return 6 * 60; }
}

export function minutesToTime(mins) {
  mins = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function breakStringToMins(breakStr) {
  if (!breakStr || breakStr === "No Break") return 0;
  const match = breakStr.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (!match) return 0;
  return Math.max(0, parseTimeToMinutes(match[2]) - parseTimeToMinutes(match[1]));
}

// ─── Parse study hours/timing from user message (gpt-4o-mini) ───────────────
export async function parseStudyInfo(userMsg) {
  const parsePrompt =
    `Extract study hours and timing from: '${userMsg}'\n\n` +
    `Return ONLY JSON: {"hours": "4", "timing": "06:00-10:00"}\n\n` +
    `CRITICAL: Convert times to 24-hour format correctly:\n` +
    `- 4am=04:00, 5am=05:00, 6am=06:00, 10am=10:00, 12pm=12:00\n` +
    `- 4pm=16:00, 8pm=20:00, 10pm=22:00, 11pm=23:00\n\n` +
    `Examples:\n` +
    `- "4 hours 6am to 10am" → {"hours": "4", "timing": "06:00-10:00"}\n` +
    `- "6am to 10am" → 4 hours → {"hours": "4", "timing": "06:00-10:00"}\n` +
    `- "4am to 5am" → 1 hour → {"hours": "1", "timing": "04:00-05:00"}\n` +
    `- "8pm to 11pm" → 3 hours → {"hours": "3", "timing": "20:00-23:00"}\n` +
    `- "3 hours" → {"hours": "3", "timing": "not_specified"}\n\n` +
    `IMPORTANT: timing must match the EXACT times user specified!\n` +
    `Return ONLY JSON.`;
  try {
    let response = await callAI(
      [
        { role: "system", content: "Return only JSON." },
        { role: "user", content: parsePrompt },
      ],
      "gpt-4o-mini",
      0.3
    );
    response = response.trim();
    if (response.includes("{")) {
      const s = response.indexOf("{");
      const e = response.lastIndexOf("}") + 1;
      response = response.slice(s, e);
    }
    const parsed = JSON.parse(response);
    const hours = String(parsed.hours || "");
    const timing = parsed.timing || "";
    if (timing === "not_specified" || !timing || !timing.includes("-")) {
      return hours ? { hours, timing: null } : { hours: null, timing: null };
    }
    if (hours && timing && timing.includes("-")) return { hours, timing };
    return { hours: null, timing: null };
  } catch {
    return { hours: null, timing: null };
  }
}

// ─── Stage 1: Exam analysis (gpt-4.1) ───────────────────────────────────────
export async function stage1AnalyzeExam(examName, planType, specificTopics) {
  let analysisPrompt;
  if (planType === "specific" && specificTopics) {
    analysisPrompt = `Break down "${specificTopics}" for ${examName} exam into MULTIPLE SEPARATE SUBJECTS.

CRITICAL: Create MULTIPLE SUBJECTS (each becomes a separate study plan), NOT one subject with many sessions!

For the topic "${specificTopics}", identify ALL major sub-areas that should be SEPARATE SUBJECTS:

OUTPUT FORMAT (create MULTIPLE subjects like this):
Subject_1_Name (XX-YY% weightage)
  - Topic 1
  - Topic 2
  - Topic 3

Subject_2_Name (XX-YY% weightage)
  - Topic 1
  - Topic 2
  - Topic 3

[Continue for ALL major sub-areas...]

BE COMPREHENSIVE: List ALL important sub-areas of "${specificTopics}" as SEPARATE SUBJECTS.
Each subject will become a separate study plan with its own sessions.`;
  } else {
    analysisPrompt = `List ALL subjects and topics for ${examName} exam based on PYQ analysis with their weightage percentage.

Be comprehensive and thorough:
- Include ALL subjects that appear in PYQs
- Include ALL major topics within each subject
- List domains separately (Domain_A, Domain_B, Domain_C, etc.)
- Give percentage weightage based on PYQ patterns
- Include as many relevant topics as possible for complete coverage

OUTPUT FORMAT:
Subject/Domain Name (XX-YY%)
  - Topic 1
  - Topic 2
  - Topic 3
  - [more topics if relevant]

Give me the complete comprehensive list for ${examName}.`;
  }

  return await callAI(
    [
      { role: "system", content: "You are an exam analysis expert. List ALL subjects and topics from PYQs with weightage. Be thorough and concise." },
      { role: "user", content: analysisPrompt },
    ],
    "gpt-4.1",
    0.3
  );
}

// ─── Stage 2: Parse analysis → structured JSON (gpt-4o-mini) ────────────────
export async function stage2ParseAnalysis(analysisText, studyHours, studyTime) {
  const startTimeStr = studyTime.includes("-") ? studyTime.split("-")[0].trim() : "06:00";

  const structurePrompt = `Convert this exam analysis into JSON. Create for ONE exam only (from input text).

STUDY TIME: Start from ${startTimeStr}, 10 min break between sessions, last session "No Break"

⚠️ CRITICAL RULES:
1. Include ALL subjects from the analysis for that ONE exam only
2. Merge related sub-topics into 3-7 sessions per subject (e.g., "DC Machines: EMF, torque, speed control")
3. Each session: 40-70 min. NO mega-sessions
4. Don't mix different subject categories (knowledge vs calculation vs language)
5. High weightage subjects (>20%): 5-7 sessions, Medium (10-20%): 4-6 sessions, Low (<10%): 3-5 sessions

⚠️ PRIORITY RULES (MANDATORY - EVERY subject MUST have ALL 3 levels):
- High: Core PYQ topics, fundamentals, appears every year (~40% of sessions)
- Medium: Important but less frequent, supporting concepts (~35% of sessions)
- Low: Rare/advanced, good to know, less critical (~25% of sessions)
- NEVER assign only one priority level to a subject. Each subject MUST have a MIX of High, Medium AND Low.
- Example for 5 sessions: 2 High, 2 Medium, 1 Low
- Example for 4 sessions: 2 High, 1 Medium, 1 Low
- Example for 3 sessions: 1 High, 1 Medium, 1 Low

⚠️ CREATE ALL SESSIONS - DO NOT LIMIT TO STUDY HOURS:
- Create ALL topics for complete coverage even if total duration exceeds ${studyHours} hours
- The app will automatically handle which sessions fit in the time and mark extras as skipped
- Your job: create COMPLETE topic coverage. App's job: fit into time window.

INPUT TEXT:
---
${analysisText}
---

OUTPUT JSON:
{
  "subjects": [
    {
      "name": "Actual Subject Name",
      "percentage": 25,
      "sessions": [
        ["subtopic1, subtopic2", "${startTimeStr}", "06:50", "06:50-07:00", "High"],
        ["subtopic3", "07:00", "07:50", "07:50-08:00", "High"],
        ["subtopic4", "08:00", "08:50", "08:50-09:00", "Medium"],
        ["subtopic5", "09:00", "09:40", "09:40-09:50", "Medium"],
        ["subtopic6", "09:50", "10:20", "No Break", "Low"]
      ]
    }
  ]
}

START WITH { END WITH }`;

  const sysContent = "You are a study plan creator. Convert exam analysis into structured JSON. CRITICAL RULES: (1) ONE exam only from input. (2) Merge related sub-topics into 3-7 sessions per subject. (3) 40-70 min sessions. (4) EVERY subject MUST have a mix of High, Medium AND Low priority sessions - NEVER all same priority. (5) Create ALL sessions for complete coverage - do NOT limit to study hours. (6) Don't mix subject categories. Return ONLY valid JSON.";

  let response = await callAI(
    [
      { role: "system", content: sysContent },
      { role: "user", content: structurePrompt },
    ],
    "gpt-4o-mini",
    0.0
  );

  try {
    response = response.trim();
    if (response.includes("```json")) {
      const start = response.indexOf("```json") + 7;
      const end = response.indexOf("```", start);
      response = response.slice(start, end).trim();
    } else if (response.includes("```")) {
      const start = response.indexOf("```") + 3;
      const end = response.indexOf("```", start);
      response = response.slice(start, end).trim();
    }
    if (response.includes("{")) {
      const s = response.indexOf("{");
      const e = response.lastIndexOf("}") + 1;
      response = response.slice(s, e);
    }
    const result = JSON.parse(response);
    if (!result.subjects) return null;
    return fixSessionPriorities(result);
  } catch (err) {
    console.warn("[stage2] parse error:", err);
    return null;
  }
}

// ─── Ensure every subject has a High/Medium/Low priority mix ────────────────
export function fixSessionPriorities(data) {
  if (!data.subjects) return data;
  for (const subj of data.subjects) {
    const sessions = subj.sessions || [];
    if (sessions.length < 3) {
      if (sessions.length === 2 && sessions[0].length >= 5 && sessions[1].length >= 5) {
        sessions[0][4] = "High";
        sessions[1][4] = "Medium";
      } else if (sessions.length === 1 && sessions[0].length >= 5) {
        sessions[0][4] = "High";
      }
      continue;
    }
    const priorities = sessions.filter(s => s.length >= 5).map(s => s[4]);
    const unique = new Set(priorities);
    if (unique.size <= 1) {
      const n = sessions.length;
      let high = Math.max(1, Math.round(n * 0.4));
      let low = Math.max(1, Math.round(n * 0.25));
      let med = Math.max(1, n - high - low);
      while (high + med + low > n) { if (med > 1) med--; else if (high > 1) high--; }
      while (high + med + low < n) med++;
      let idx = 0;
      for (let i = 0; i < high; i++) if (sessions[idx] && sessions[idx].length >= 5) sessions[idx++][4] = "High";
      for (let i = 0; i < med; i++) if (sessions[idx] && sessions[idx].length >= 5) sessions[idx++][4] = "Medium";
      for (let i = 0; i < low; i++) if (sessions[idx] && sessions[idx].length >= 5) sessions[idx++][4] = "Low";
    }
    const hasLow = sessions.some(s => s.length >= 5 && s[4] === "Low");
    if (!hasLow && sessions.length >= 3) sessions[sessions.length - 1][4] = "Low";
    const hasHigh = sessions.some(s => s.length >= 5 && s[4] === "High");
    if (!hasHigh && sessions.length >= 3) sessions[0][4] = "High";
  }
  return data;
}

// ─── Convert AI subjects → plans dict ───────────────────────────────────────
export function convertToPlansFormat(completeData) {
  if (!completeData || !completeData.subjects) return null;
  const result = {};
  for (const subject of completeData.subjects) {
    const name = subject.name || "Unknown";
    const sessions = subject.sessions || [];
    if (!sessions.length) continue;
    let key = name.toLowerCase().replace(/[ -]/g, "_").replace(/&/g, "and").replace(/[^a-z0-9_]/g, "");
    if (!key) key = `subject_${Object.keys(result).length + 1}`;
    const seen = new Set();
    const unique = [];
    for (const sess of sessions) {
      if (sess.length >= 5) {
        const topic = String(sess[0]).trim().toLowerCase();
        if (!seen.has(topic)) { seen.add(topic); unique.push(sess); }
      }
    }
    result[key] = { displayName: name, sessions: unique };
  }
  return result;
}

// ─── Apply session constraints based on user's study window ─────────────────
export function applyConstraints(plansDict, studyHoursStr) {
  const MIN = 30;
  const userMins = (parseFloat(studyHoursStr) || 2) * 60;
  const adjusted = {};
  for (const [planKey, entry] of Object.entries(plansDict)) {
    const sessions = entry.sessions || [];
    const parsed = sessions.filter(s => Array.isArray(s) && s.length >= 4).map(s => ({
      name: s[0], start: s[1], end: s[2], breakStr: s[3],
      priority: ["High", "Medium", "Low"].includes((s[4] || "").trim()) ? s[4].trim() : "Medium",
    }));
    const need = parsed.length * MIN;
    const order = { High: 0, Medium: 1, Low: 2 };
    parsed.sort((a, b) => order[a.priority] - order[b.priority]);
    const highN = parsed.filter(s => s.priority === "High").length;
    const medN  = parsed.filter(s => s.priority === "Medium").length;
    let current = null;
    const kept = [];
    if (userMins >= need) {
      const balance = userMins - need;
      const parts = highN * 2 + medN;
      const perPart = parts > 0 ? balance / parts : 0;
      parsed.forEach((s, i) => {
        const dur = s.priority === "High" ? MIN + Math.floor(2 * perPart)
                  : s.priority === "Medium" ? MIN + Math.floor(perPart) : MIN;
        const startTime = i === 0 ? s.start : minutesToTime(current);
        if (i === 0) current = parseTimeToMinutes(startTime);
        const endMins = current + dur;
        const endTime = minutesToTime(endMins);
        let br = "No Break";
        if (i < parsed.length - 1) { br = `${endTime}-${minutesToTime(endMins + 10)}`; current = endMins + 10; }
        kept.push([s.name, startTime, endTime, br, s.priority]);
      });
    } else {
      const max = Math.floor(userMins / MIN);
      parsed.forEach(s => {
        if (kept.length >= max) return;
        const startTime = kept.length === 0 ? s.start : minutesToTime(current);
        if (kept.length === 0) current = parseTimeToMinutes(startTime);
        const endMins = current + MIN;
        const endTime = minutesToTime(endMins);
        let br = "No Break";
        if (kept.length < max - 1) { br = `${endTime}-${minutesToTime(endMins + 10)}`; current = endMins + 10; }
        kept.push([s.name, startTime, endTime, br, s.priority]);
      });
    }
    adjusted[planKey] = { displayName: entry.displayName, sessions: kept };
  }
  return adjusted;
}

// ─── Add revision session at the end of each plan ───────────────────────────
export function addRevisionSessions(plansDict) {
  for (const entry of Object.values(plansDict)) {
    const sessions = entry.sessions;
    if (!sessions || !sessions.length) continue;
    const last = sessions[sessions.length - 1];
    const lastEndMins = parseTimeToMinutes(last[2]);
    const revStart = minutesToTime(lastEndMins + 10);
    const revEnd = minutesToTime(lastEndMins + 40);
    if (last[3] === "No Break") last[3] = `${last[2]}-${revStart}`;
    sessions.push([`${entry.displayName} Revision`, revStart, revEnd, "No Break", "High"]);
  }
  return plansDict;
}

// ─── Convert plans dict → flat Firebase-ready session records ───────────────
export function plansToFirebaseSessions(plansDict) {
  const records = [];
  for (const entry of Object.values(plansDict)) {
    const subject = entry.displayName;
    for (const s of entry.sessions) {
      if (!Array.isArray(s) || s.length < 5) continue;
      records.push({
        name: cleanSessionName(s[0]),
        subject,
        start: s[1],
        end: s[2],
        breakMins: breakStringToMins(s[3]),
        priority: String(s[4] || "medium").toLowerCase(),
        material: "",
      });
    }
  }
  return records;
}

// ─── Convert plans dict → per-subject session arrays (exam/plan structure) ──
export function plansToExamPlans(plansDict) {
  const result = [];
  for (const entry of Object.values(plansDict)) {
    const sessions = [];
    for (const s of entry.sessions) {
      if (!Array.isArray(s) || s.length < 5) continue;
      sessions.push({
        name: cleanSessionName(s[0]),
        start: s[1],
        end: s[2],
        breakMins: breakStringToMins(s[3]),
        priority: String(s[4] || "medium").toLowerCase(),
        material: "",
      });
    }
    if (sessions.length) result.push({ name: entry.displayName, sessions });
  }
  return result;
}

// ─── Save each subject as its own plan under the given exam ────────────────
export async function saveAIPlansToExam(savePlanToExam, uid, examId, plansDict) {
  const plans = plansToExamPlans(plansDict);
  let totalSessions = 0;
  for (const plan of plans) {
    await savePlanToExam(uid, examId, plan.name, plan.sessions);
    totalSessions += plan.sessions.length;
  }
  return { plansCreated: plans.length, sessionsCreated: totalSessions };
}

function cleanSessionName(n) {
  let name = String(n || "").replace(/[\u{1F300}-\u{1F9FF}]/gu, "").trim();
  name = name.replace(/_/g, " ").replace(/[,;:]+\s*$/, "").replace(/\s+/g, " ").trim();
  const words = name.split(" ");
  if (words.length > 6) name = words.slice(0, 6).join(" ");
  return name;
}
