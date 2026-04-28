// materialPrompts.js
// Ported (and slimmed) from material_handler_mixin.py:
//   _create_enhanced_material_prompt  → buildTopicHierarchyPrompt
//   _get_enhanced_capsule_prompt      → buildCapsulePrompt
// Plus simple prompts for Notes / MCQs / Summary / Upload-content.

export const CAPSULES = [
  { id: "important_notes", emoji: "⭐", title: "Important Notes" },
  { id: "objectives", emoji: "🎯", title: "Scoring Objectives" },
  { id: "concepts",   emoji: "📖", title: "Core Concepts" },
  { id: "formulas",   emoji: "📐", title: "Key Formulas" },
  { id: "practice",   emoji: "📚", title: "Practice Problems" },
  { id: "strategy",   emoji: "💡", title: "Exam Strategy" },
  { id: "sources",    emoji: "📑", title: "Study Materials" },
  { id: "preview",    emoji: "🔮", title: "Tomorrow's Preview" },
];

export const MATERIAL_TYPES = [
  { id: "notes",     label: "Notes",          ic: "📝", desc: "Structured study notes" },
  { id: "mcq",       label: "MCQs",           ic: "❓", desc: "Practice questions with answers" },
  { id: "summary",   label: "Summary",        ic: "📄", desc: "Quick revision sheet" },
  { id: "hierarchy", label: "Topic Hierarchy",ic: "🗂", desc: "Day-wise topic breakdown" },
];

export function priorityToDifficulty(priority) {
  const p = String(priority || "").toLowerCase();
  if (p === "high") return "hard";
  if (p === "low")  return "easy";
  return "medium";
}

function urgencyOf(daysUntilExam) {
  const d = Number(daysUntilExam) || 999;
  if (d <= 3)  return { tag: "CRITICAL", note: "Focus ONLY on highest priority topics. Skip basics completely." };
  if (d <= 7)  return { tag: "HIGH",     note: "Prioritize high-weightage topics only. Quick coverage needed." };
  if (d <= 15) return { tag: "MEDIUM",   note: "Balance coverage and depth. Focus on important topics." };
  return        { tag: "NORMAL",   note: "Comprehensive coverage with gradual progression possible." };
}

// ── Topic hierarchy ───────────────────────────────────────────────────────
export function buildTopicHierarchyPrompt({
  sessionName, examName, planName, durationMinutes,
  daysUntilExam, currentDay,
}) {
  const subject = planName || sessionName;
  const u = urgencyOf(daysUntilExam);

  return `Create a COMPLETE topic hierarchy for ${sessionName} (${examName || "exam"}).

SESSION: ${sessionName}
SUBJECT: ${subject}
EXAM: ${examName || "—"}
DAYS LEFT: ${daysUntilExam ?? "unknown"}
URGENCY: ${u.tag} — ${u.note}

REQUIREMENTS:
1. Generate ALL topics in priority order: High → Medium → Low.
2. Each topic must have 3-8 subtopics. Each subtopic = 1 day of focused study.
3. Subtopic names must be SPECIFIC and actionable (not "Day X focus").
4. Stay strictly within the subject domain — do not mix subjects.
5. Use HONEST language: "commonly tested", "high priority", "frequently asked".
   Do NOT invent years (e.g. "asked in 2019, 2021"). Do NOT invent statistics.

Return ONLY valid JSON in this exact shape (no markdown, no commentary):

{
  "strategy": {
    "total_content_scope": "string",
    "why_these_topics": "string",
    "expected_topics": "string",
    "time_allocation": "Progressive reveal based on session duration"
  },
  "topics": [
    {
      "topic": "Fundamental Rights",
      "importance": "High",
      "exam_frequency": "Very frequently asked",
      "scoring_potential": "3-5 marks per question typical",
      "estimated_days": 5,
      "subtopics": [
        {
          "subtopic_name": "Right to Equality - Articles 12-18",
          "day_number": 1,
          "focus": "Equality provisions and landmark cases",
          "content_brief": "150-300 words covering key concepts",
          "scoring_tips": "Common question patterns and mark allocation",
          "estimated_time": "${durationMinutes || 60} minutes"
        }
      ]
    }
  ]
}

Rules:
- 12-25 topics total (complete subject coverage).
- 3-8 subtopics per topic.
- Strict priority order: High → Medium → Low.
- Valid JSON only, no trailing commas, no extra prose.`;
}

// ── Deep-dive capsules ────────────────────────────────────────────────────
export function buildCapsulePrompt({
  capsuleId, topicName, sessionName, examName,
  contentBrief, currentDay, daysUntilExam, durationMinutes,
}) {
  const ctx = `Topic: ${topicName} (Day ${currentDay || 1})
Exam: ${examName || "—"}
Session: ${sessionName}
Days Left: ${daysUntilExam ?? "unknown"}
Focus: ${contentBrief || "—"}

Requirements:
- Use HONEST language. Do NOT invent years or statistics.
- Specific to this exam pattern. Help score marks, not just theory.
- Plain prose with simple bullets. NO heavy markdown — light structure only.
`;

  switch (capsuleId) {
    case "important_notes":
      return ctx + `
IMPORTANT NOTES — actual study content (NOT tips, NOT strategy, NOT guidance).

Generate the SUBSTANTIVE notes a learner needs for this topic, prioritized by what's
been frequently asked in the last ~5 years of ${examName || "this exam"} pattern and
what is broadly considered most important.

Sections (use these exact section headings):
1. High-priority facts & definitions — the must-know factual content. Each item: the fact, then a short clarifying line. Mark each with priority (HIGH / IMPORTANT / FREQUENT).
2. Frequently-asked concepts — concepts that appear in PYP patterns repeatedly. For each: concept name, 2-4 line explanation, why it matters in this exam.
3. Key data / numbers / years / articles — exact figures, dates, article numbers, formulas, constants etc. that are commonly tested. Bullet list, dense.
4. Must-remember terminology — domain-specific terms with crisp 1-line definitions.
5. Common confusions & distinctions — pairs/triplets of things students mix up + how to tell them apart.
6. PYP-style highlight points — points that have shown up in question patterns frequently. Phrase each as a teachable nugget, NOT as a question.

Rules:
- This is CONTENT, not advice. No "focus on", "remember to", "be sure to" sentences.
- Use HONEST language: "frequently asked", "commonly tested" — never invent specific years.
- Bold the key term/fact at the start of each bullet so it scans cleanly.
- Aim for substantial depth (this is the primary study source).`;

    case "important_notes_more":
      return ctx + `
IMPORTANT NOTES — CONTINUATION.

The learner has already read the first batch of important notes for this topic and
asked to load MORE. Generate ADDITIONAL substantive notes that go DEEPER and BROADER
than typical first-pass notes. DO NOT repeat what would obviously be in the first batch.

Sections:
1. Advanced / less-obvious facts — second-tier content that still appears in tougher questions.
2. Edge cases & exceptions — the carve-outs, exceptions, special provisions, boundary conditions.
3. Cross-topic connections — where this topic touches other topics in the syllabus and how questions combine them.
4. Expanded examples / illustrations — concrete examples that solidify the harder ideas.
5. Higher-order PYP-style highlight points — the trickier patterns, often-missed nuances.

Rules:
- Do NOT repeat the basic / introductory facts already covered in the first batch.
- Bold the key term/fact at the start of each bullet.
- Substantial depth — this is the deeper-dive batch.`;

    case "objectives":
      return ctx + `
Create 5-7 SCORING OBJECTIVES (skills the learner will master).
For each: specific question type, scoring potential, expected solving time, target accuracy.

Examples (style only — replace with topic-relevant ones):
- Solve article-based matching questions (typically 2 marks each, 1 min/question)
- Master quick recall of constitutional amendments (high-frequency, 2 marks typical, aim 80%+ accuracy)

Output as a clean numbered list with one objective per item. No fake years.`;

    case "concepts":
      return ctx + `
Cover CORE CONCEPTS for this topic in 4 sections:
1. Important concepts — each with priority tag (High / Commonly tested / Important) and scoring potential.
2. Question patterns — how this concept is tested (direct recall, calculation, comparison) + common traps.
3. Quick revision points — bullet points for last-minute revision, memory tricks, must-remember facts.
4. Concept connections — how this links to related topics; combination-question potential.

No generic theory. Exam-focused content only.`;

    case "formulas":
      return ctx + `
List 8-15 KEY FORMULAS for this topic (skip if not formula-heavy — instead list 8-12 must-remember facts/figures).

For each formula:
- Formula (plain text)
- Priority (High / Commonly used / Important)
- When asked (typical question pattern)
- Common mistake (what students get wrong)
- Quick check (sanity check on the answer)
- Solving time (30s / 1min / 2min)
- Shortcut (faster method, if any)

Use plain symbols: η α β π Δ Σ √ × ÷ ≈ ≤ ≥ θ ω λ μ.`;

    case "practice":
      return ctx + `
PRACTICE PROBLEMS — exam-style. Don't invent fake PYQ years.

Section A — Solved Examples (3 problems):
Each: question type, typical marks, full question, complete solution with steps,
the shortcut/trick, why each wrong option is wrong, expected solving time.

Section B — Practice Set (6 problems):
2 easy, 2 medium, 2 hard. Each ends with "Answer: ..." and a 1-2 line explanation.

Section C — Common Mistakes (top 5):
Wrong approach → why it's wrong → correct approach.

Section D — Scoring Strategy:
Which questions to attempt first; when to skip; time allocation per question.`;

    case "strategy":
      return ctx + `
EXAM STRATEGY for this topic — actionable, step-by-step:

1. Question identification — keywords/phrases that signal this topic; how to spot it fast.
2. Solving sequence — Step 1, Step 2, Step 3 with time per step. When to use shortcuts.
3. Elimination techniques — for MCQs: how to remove obviously-wrong options, traps to watch.
4. Time management — expected time per question type; when to skip and move on.
5. Mark maximization — partial-marking tactics; negative-marking risk-vs-reward.
6. Last-minute tips — what to revise 5 minutes before exam.

Be specific to ${examName || "this exam"}'s pattern.`;

    case "sources":
      return ctx + `
STUDY MATERIALS — only widely-used, aspirant-verified resources for ${examName || "this exam"}.

Sections:
📚 Recommended Books (3-5): full name, author, chapters/pages to focus, why recommended.
🌐 Online Resources: only well-known sites (NCERT, official exam portal, etc.). Include URL only if you are highly confident it's correct and stable.
📺 YouTube Channels: name + best playlist for this topic + language.
📱 Apps: name, platform, specific use, free/paid.
💡 Effective usage tips — how to combine these resources, recommended sequence.

Rules:
- Prioritize FREE resources first.
- Do NOT make up URLs. If unsure, omit the URL — just describe how to find the resource.
- No affiliate links or paid promotions.`;

    case "preview":
      return ctx + `
TOMORROW'S PREVIEW (Day ${(currentDay || 1) + 1}) — concrete and actionable:

1. EXACT TOPICS (2-4 items): topic name, what learner will do, scoring potential.
2. TIME BREAKDOWN — fit ${durationMinutes || 60} minutes total. Use ranges:
   • 00-15 min: [activity + deliverable]
   • 15-35 min: [activity + deliverable]
   • etc. (segments must sum to total)
3. PRACTICE PLAN — exact number of questions, time limit, target accuracy.
4. CONNECTION TO TODAY — 2-3 sentences on how tomorrow builds on ${topicName}.
5. PREPARATION CHECKLIST — what to keep ready tonight; quick pre-read; mindset tip.

Be SPECIFIC. This is an action plan, not a wish list.`;

    default:
      return ctx + `\nGenerate exam-focused content for this topic.`;
  }
}

// ── Simple types (Notes / MCQ / Summary) ──────────────────────────────────
export function buildSimplePrompt({ type, topic, difficulty, length, examName }) {
  const lenHint =
    length === "quick" ? "Keep it under ~150 words for a 1-minute read." :
    length === "deep"  ? "Be thorough; include depth and worked examples." :
                         "Standard length; concise and exam-focused.";
  const examLine = examName ? `Tailor for: ${examName}.` : "";

  if (type === "notes") {
    return `Create structured study notes on: ${topic}

Cover:
- Key concepts and definitions
- Important formulas (if applicable)
- 3-5 worked examples
- Quick revision points (bullets)

${lenHint}
Difficulty: ${difficulty}. ${examLine}
Use light structure with short paragraphs and bullets — NO heavy markdown.`;
  }

  if (type === "mcq") {
    const n = length === "quick" ? 5 : length === "deep" ? 15 : 10;
    return `Create ${n} exam-style MCQs on: ${topic}

Format each question:
Q1. <question>
A) <option>
B) <option>
C) <option>
D) <option>
Answer: <letter>
Why: <1-2 line explanation>

Difficulty: ${difficulty}. ${examLine}
Don't repeat answer letter distribution; use realistic distractors.`;
  }

  // summary
  return `Summarize ${topic} into a 1-page quick revision sheet.

Sections:
- Key points (bullets)
- Important terms
- Must-remember facts

${lenHint}
Difficulty: ${difficulty}. ${examLine}
Use bullets and short lines.`;
}

// ── Revision questions (spaced-repetition) ────────────────────────────────
// Generate level-appropriate questions for a single subtopic.
// Format:
//   level 0 → MCQ          (1st revision — recognise)
//   level 1 → Hint recall   (2nd revision — reduce support)
//   level 2 → Pure recall   (3rd revision — no options)
//   level 3 → Timed recall  (4th revision — speed)
//   level 4 → Applied       (5th revision — twisted)
//   level 5 → Master refresh (mixed twisted)
export function buildRevisionQuestionsPrompt({
  topicName, subtopicName, focus, examName, level,
}) {
  const lvl = Math.max(0, Math.min(5, Number(level) || 0));
  const formatLine = [
    "Format: 4-option MCQ. Provide options A-D, the correct letter, and a 1-2 line explanation.",
    "Format: Hint-based recall. Provide a SHORT hint (max 12 words) plus the full answer and a 1-2 line explanation.",
    "Format: Pure recall. Plain question, NO options, NO hint. Provide the full answer and explanation.",
    "Format: Timed recall. Short snappy question that can be answered in under 5 seconds. Provide the answer and explanation.",
    "Format: Applied / twisted. Re-frame the concept in a slightly altered scenario or comparison so the learner must reason. Provide the answer and explanation.",
    "Format: Mixed master refresh — a hard applied question that combines this concept with adjacent ideas. Provide the answer and explanation.",
  ][lvl];

  return `Generate exam-style revision questions for ONE subtopic.

EXAM: ${examName || "—"}
TOPIC: ${topicName}
SUBTOPIC: ${subtopicName}
FOCUS BRIEF: ${focus || "—"}
REVISION LEVEL: ${lvl} (${LEVEL_LABELS[lvl]})
${formatLine}

PROCESS (follow these steps internally before writing JSON):
1. Extract 3-5 KEY POINTS from the subtopic — the actual facts, definitions, formulas,
   rules, exceptions or distinctions a learner must know. Skip filler.
2. Generate EXACTLY ONE question per key point (one concept per question).
3. If the subtopic is genuinely tiny, fall back to 2 questions; if it's huge, cap at 7.
4. Stay within the subtopic — do not test adjacent topics.
5. Use HONEST language. Do NOT invent years or fabricate statistics.

Return ONLY valid JSON in this exact shape:

{
  "key_points": ["string", ...],
  "questions": [
    {
      "key_point": "string",
      "question": "string",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],   // ONLY for MCQ; OMIT this field for other formats
      "hint": "string",                                       // ONLY for hint-recall; OMIT otherwise
      "answer": "string",
      "explanation": "string"
    }
  ]
}

Rules:
- Questions array length must equal key_points array length (1:1).
- Aim for 3-5 questions, minimum 2, maximum 7.
- For MCQ: provide exactly 4 options labelled "A) ...", "B) ...", "C) ...", "D) ...".
- For non-MCQ formats: do NOT include the options field.
- For hint-recall: include the "hint" field; for all other formats omit it.
- Valid JSON only. No markdown. No commentary. No trailing commas.`;
}

const LEVEL_LABELS = [
  "Level 1 — MCQ recognition",
  "Level 2 — Hint-based recall",
  "Level 3 — Pure recall",
  "Level 4 — Timed recall",
  "Level 5 — Applied / twisted",
  "Mastered — long-term refresh",
];

export function buildUploadPrompt(extracted) {
  return `You are a study assistant.
Convert the uploaded content below into structured exam-focused study material.

Output sections:
1. Key Concepts (bullets)
2. Short Summary (max 150 words)
3. Important Points to Remember (bullets)
4. 5 MCQs with answers and short explanations
5. 3 Revision Questions (open-ended)

CONTENT:
---
${extracted}
---`;
}

// ── Helpers ───────────────────────────────────────────────────────────────
export function safeParseJSON(text) {
  if (!text) return null;
  // Strip markdown code fences if model returned ```json ... ```
  const cleaned = String(text)
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try { return JSON.parse(cleaned); } catch {}
  // Fallback: find first { ... last }
  const a = cleaned.indexOf("{");
  const b = cleaned.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try { return JSON.parse(cleaned.slice(a, b + 1)); } catch {}
  }
  return null;
}

// Subtopic activation logic — pick subtopics that fit today's session duration.
// Mirrors _filter_topics_by_duration: shorter duration → fewer subtopics.
export function pickActiveSubtopics(topics, durationMinutes) {
  const d = Number(durationMinutes) || 60;
  let perTopic;
  if (d <= 30)       perTopic = 1;
  else if (d <= 60)  perTopic = 2;
  else if (d <= 90)  perTopic = 3;
  else if (d <= 120) perTopic = 4;
  else               perTopic = 6;
  return (topics || []).flatMap(t =>
    (t.subtopics || []).slice(0, perTopic).map(st => ({
      topic: t.topic,
      importance: t.importance,
      ...st,
    }))
  );
}

export function topicSlug(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
