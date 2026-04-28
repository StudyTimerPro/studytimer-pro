import React, { useState, useEffect, useRef } from "react";
import {
  saveExam, savePlanToExam, getExams, getPlans,
} from "../../firebase/db";
import { listenWallet, ensureWallet, DEFAULT_LIMIT } from "../../utils/tokenTracker";
import {
  callAI, callAIStream, getLanguageReminder, getLanguageSample,
  parseStudyInfo, stage1AnalyzeExam, stage2ParseAnalysis,
  convertToPlansFormat, applyConstraints, addRevisionSessions,
  saveAIPlansToExam,
} from "../../utils/aiService";
import useStore from "../../store/useStore";
import LoadingAnimation from "../common/LoadingAnimation";

// ── Small utilities ──────────────────────────────────────────────────────────
const daysLeft = (examDate) => {
  if (!examDate) return null;
  const diff = (new Date(examDate) - new Date()) / 86400000;
  return Math.max(0, Math.ceil(diff));
};

const msgT = (lang, en, ta, hi) => (lang === "tamil" ? ta : lang === "hindi" ? hi : en);

// ── Component ────────────────────────────────────────────────────────────────
export default function AIPlanModal({ user, onClose, onCreated }) {
  const {
    showToast, settings,
    currentExamId, setCurrentExamId,
    currentExamName, setCurrentExamName,
    exams, setExams, setPlans,
    setCurrentPlanId, setCurrentPlanName,
  } = useStore();
  const language   = (settings?.language || "english").toLowerCase();
  const fallbackExamName = (settings?.examName || "").trim() || "Unknown Exam";
  const examName   = (currentExamName || "").trim() || fallbackExamName;
  const examDate   = settings?.examDate || "";

  const [tab, setTab]       = useState(1);
  const [qaChat, setQaChat] = useState([]);
  const [planChat, setPlanChat] = useState([]);
  const [input, setInput]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [wallet, setWallet] = useState({ used: 0, limit: DEFAULT_LIMIT });
  const [splash, setSplash] = useState(false);
  const [stage, setStage]   = useState(null);
  const [waitingExamName, setWaitingExamName] = useState(false);

  const planHistory   = useRef([]);
  const qaHistory     = useRef([]);
  const planStarted   = useRef(false);
  const qaStarted     = useRef(false);
  const planType      = useRef(null);
  const specTopics    = useRef(null);
  const waitingHours  = useRef(false);
  const waitingTopics = useRef(false);
  const studyHours    = useRef(null);
  const studyTime     = useRef(null);
  const endRef        = useRef(null);

  // ── Wallet listener ──
  useEffect(() => {
    if (!user?.uid) return;
    ensureWallet(user.uid).catch(() => {});
    const unsub = listenWallet(user.uid, setWallet);
    return () => typeof unsub === "function" && unsub();
  }, [user?.uid]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [qaChat, planChat, tab, splash]);

  // ── Auto-start tabs ──
  useEffect(() => {
    if (tab === 1 && !planStarted.current) { planStarted.current = true; autoStartPlan(); }
    if (tab === 0 && !qaStarted.current)   { qaStarted.current = true;   autoStartQA(); }
  }, [tab]);

  // ── UI helpers ──
  const appendPlan = (role, content) => setPlanChat(p => [...p, { role, content }]);
  const appendQA   = (role, content) => setQaChat(p => [...p, { role, content }]);

  // ── Q&A tab auto-start ──
  function autoStartQA() {
    const greeting = msgT(language,
      "Hello! 👋 What can I help you with today? 😎🔥📚",
      "Vanakkam! 👋 Ena doubt iruku? Kelu bro! 😎🔥📚",
      "Namaste! 👋 Kya doubt hai? Pucho yaar! 😎🔥📚"
    );
    const systemPrompt =
      `You are an AI study assistant. Help with exam tips, doubt clearing, and problem solving. ` +
      `User is preparing for ${examName}. Speak in ${language}+English mix with emojis. ` +
      `Be concise, helpful, and encouraging.\n\n` +
      `IMPORTANT: Format all math in PLAIN TEXT using simple notation:\n` +
      `- Use * for multiplication (5 * 3)\n` +
      `- Use / for division (10 / 2)\n` +
      `- Use ^ for powers (x^2)\n` +
      `- Use sqrt() for square root (sqrt(25))\n` +
      `- Show step-by-step calculations clearly\n` +
      `- NEVER use LaTeX or special math symbols like \\text, \\frac, \\times\n` +
      `- Write formulas in readable format: Speed = Distance / Time`;
    qaHistory.current = [{ role: "system", content: systemPrompt }];
    appendQA("assistant", greeting);
  }

  // ── Plan tab auto-start: kickoff AI-generated greeting then splash ──
  async function autoStartPlan() {
    // First ensure we have a current exam selected
    if (!currentExamId) {
      appendPlan("assistant", msgT(language,
        "Before I create a plan — what exam are you preparing for? Type the exam name (eg: SSC JE Electrical).",
        "Plan create panra munadi — enna exam ku prep panra? Exam name type pannu (eg: SSC JE Electrical).",
        "Plan banane se pehle — kaunsa exam hai? Exam naam likho (eg: SSC JE Electrical)."
      ));
      setWaitingExamName(true);
      return;
    }

    appendPlan("assistant", "Please wait Setting things up… ⚡");
    const dleft = daysLeft(examDate);
    try {
      const systemPrompt =
        `You are an AI study coach. Speak in ${language}+English mix with emojis. ` +
        getLanguageSample(language);
      const kickoff =
        `SYLLABUS:\nExam: ${examName}\n\n` +
        `PROFILE:\n${JSON.stringify({ examName, examDate, language, daysLeft: dleft })}\n` +
        `Exam Date: ${examDate || "not set"}${dleft != null ? ` (${dleft} days left)` : ""}\n\n` +
        `Speak in ${language}+English with emojis. Greet the student by name of exam "${examName}"` +
        `${dleft != null ? ` and mention the ${dleft} days left to exam` : ""}. ` +
        `DO NOT create plan yet. First chat with user, understand their needs, ` +
        `then ask if they want to create a study plan.`;

      planHistory.current = [
        { role: "system", content: systemPrompt },
        { role: "user", content: kickoff },
      ];
      const reply = await callAI(
        [...planHistory.current, { role: "system", content: getLanguageReminder(language) }],
        "gpt-4o-mini", 0.7, "ai_coach.kickoff"
      );
      planHistory.current.push({ role: "assistant", content: reply });
      setPlanChat([{ role: "assistant", content: reply }]);
      setTimeout(() => setSplash(true), 2500);
    } catch (err) {
      appendPlan("assistant", `Failed to start: ${err.message || err}`);
    }
  }

  // ── Handle splash button clicks ──
  function onOverall() {
    planType.current = "overall";
    setSplash(false);
    const msg = msgT(language,
      `👍 Overall plan for '${examName}'!\n\n⏰ How many hours? (eg: 4 hours 6am-10am)`,
      `👍 '${examName}' ku overall plan!\n\n⏰ Evlo hours? (eg: 4 hours 6am-10am)`,
      `👍 '${examName}' ke liye overall plan!\n\n⏰ Kitne hours? (eg: 4 hours 6am-10am)`
    );
    appendPlan("assistant", msg);
    waitingHours.current = true;
  }

  function onSpecific() {
    planType.current = "specific";
    setSplash(false);
    const msg = msgT(language,
      "🎯 Specific topics! Which ones?\n\n(eg: Physics, Chemistry, General awarness, Current affairs.....)",
      "🎯 Specific topics! Enna topics venum?\n\n(eg: Physics, Chemistry, General awarness, Current affairs.....)",
      "🎯 Specific topics! Kaunse topics?\n\n(eg: Physics, Chemistry, General awarness, Current affairs.....)"
    );
    appendPlan("assistant", msg);
    waitingTopics.current = true;
  }

  // ── Send message dispatcher ──
  async function send(textArg) {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    setInput("");

    if (tab === 0) return sendQA(text);
    return sendPlan(text);
  }

  // ── Q&A tab send ──
  async function sendQA(text) {
    appendQA("user", text);
    qaHistory.current.push({ role: "user", content: text });
    setBusy(true);
    let full = "";
    appendQA("assistant", "");
    try {
      await callAIStream(
        qaHistory.current,
        "gpt-4o-mini",
        chunk => {
          full += chunk;
          setQaChat(p => { const n = [...p]; n[n.length - 1] = { role: "assistant", content: full, streaming: true }; return n; });
        },
        () => {
          setQaChat(p => { const n = [...p]; n[n.length - 1] = { role: "assistant", content: full }; return n; });
          qaHistory.current.push({ role: "assistant", content: full });
          setBusy(false);
        },
        "ai_coach.qa"
      );
    } catch (err) {
      setQaChat(p => { const n = [...p]; n[n.length - 1] = { role: "assistant", content: "Something went wrong." }; return n; });
      showToast(err.message || "AI error"); setBusy(false);
    }
  }

  // ── Plan tab send — handles flow states ──
  async function sendPlan(text) {
    appendPlan("user", text);

    if (waitingExamName) {
      setWaitingExamName(false);
      try {
        const examId = await saveExam(user.uid, { name: text.trim() });
        setCurrentExamId(examId);
        setCurrentExamName(text.trim());
        const fresh = await getExams(user.uid);
        setExams(fresh);
        appendPlan("assistant", msgT(language,
          `✅ Exam "${text.trim()}" saved! Let's set things up...`,
          `✅ Exam "${text.trim()}" save aachu! Setup pandren...`,
          `✅ Exam "${text.trim()}" save ho gaya! Setup kar raha...`
        ));
        // Continue to plan kickoff
        setTimeout(() => autoStartPlan(), 400);
      } catch (err) {
        appendPlan("assistant", `⚠️ Failed to save exam: ${err.message || err}`);
      }
      return;
    }

    if (waitingTopics.current) {
      specTopics.current = text;
      waitingTopics.current = false;
      const msg = msgT(language,
        `👍 Perfect! I'll create a plan for: '${text}'!\n\n⏰ How many hours can you study and what time?\n\nExample: 4 hours 6am to 10am`,
        `👍 Seri bro! '${text}' ku plan create panren!\n\n⏰ Evlo hours padika mudiyum and enna time la?\n\nExample: 4 hours 6am to 10am`,
        `👍 Thik hai! '${text}' ke liye plan banaunga!\n\n⏰ Kitne hours aur kab?\n\nExample: 4 hours 6am to 10am`
      );
      appendPlan("assistant", msg);
      waitingHours.current = true;
      return;
    }

    if (waitingHours.current) {
      appendPlan("assistant", msgT(language, "Processing... ⚡", "Wait pannu... ⚡", "Thodi der... ⚡"));
      setBusy(true);
      const { hours, timing } = await parseStudyInfo(text);
      if (hours && timing) {
        waitingHours.current = false;
        studyHours.current = hours; studyTime.current = timing;
        appendPlan("assistant", `✅ ${hours}h, ${timing}! Creating...`);
        await generatePlan();
      } else if (hours && !timing) {
        waitingHours.current = false;
        studyHours.current = hours; studyTime.current = "06:00-22:00";
        appendPlan("assistant", `✅ ${hours} hours! Using flexible timing. Creating...`);
        await generatePlan();
      } else {
        setBusy(false);
        appendPlan("assistant", msgT(language,
          "🤔 I couldn't understand the time format. Try like:\n• 4 hours 6am to 10am\n• 6 to 10 morning\n• 3 hours evening\n• Just '4 hours' also works!\n\nTell me! 😊",
          "🤔 Time format puriyala bro... Ipdi try pannu:\n• 4 hours 6am to 10am\n• 6 to 10 morning\n• 3 hours evening\n• Just '4 hours' also works!\n\nSollu! 😊",
          "🤔 Time format samajh nahi aaya... Aise try karo:\n• 4 hours 6am to 10am\n• 6 to 10 morning\n• 3 hours evening\n• Sirf '4 hours' bhi chalega!\n\nBatao! 😊"
        ));
      }
      return;
    }

    // Free-form conversation with AI
    planHistory.current.push({ role: "user", content: text });
    setBusy(true);
    let full = "";
    appendPlan("assistant", "");
    try {
      await callAIStream(
        [...planHistory.current, { role: "system", content: getLanguageReminder(language) }],
        "gpt-4o-mini",
        chunk => {
          full += chunk;
          setPlanChat(p => { const n = [...p]; n[n.length - 1] = { role: "assistant", content: full, streaming: true }; return n; });
        },
        () => {
          setPlanChat(p => { const n = [...p]; n[n.length - 1] = { role: "assistant", content: full }; return n; });
          planHistory.current.push({ role: "assistant", content: full });
          setBusy(false);
        },
        "ai_coach.plan_chat"
      );
    } catch (err) {
      setPlanChat(p => { const n = [...p]; n[n.length - 1] = { role: "assistant", content: "Something went wrong." }; return n; });
      showToast(err.message || "AI error"); setBusy(false);
    }
  }

  // ── Two-stage plan generation ──
  async function generatePlan() {
    setBusy(true);
    appendPlan("assistant", msgT(language,
      "Perfect! 📅 Analyzing PYQ patterns... ⚡",
      "Perfect bro! 📅 PYQ patterns analyze pandren... ⚡",
      "Perfect! 📅 PYQ patterns analyze kar raha hoon... ⚡"
    ));
    try {
      setStage(1);
      appendPlan("assistant", msgT(language,
        "🧠 Stage 1: Analyzing exam pattern...",
        "🧠 Stage 1: Exam pattern analyze pandren...",
        "🧠 Stage 1: Exam pattern analyze kar raha..."
      ));
      const analysis = await stage1AnalyzeExam(examName, planType.current, specTopics.current);
      if (!analysis) { appendPlan("assistant", "⚠️ Failed to analyze exam."); setBusy(false); return; }

      setStage(2);
      appendPlan("assistant", msgT(language,
        "📊 Stage 2: Creating complete structure...",
        "📊 Stage 2: Complete structure create pandren...",
        "📊 Stage 2: Complete structure bana raha..."
      ));
      const data = await stage2ParseAnalysis(analysis, studyHours.current, studyTime.current);
      if (!data) { appendPlan("assistant", "⚠️ Could not create structure. Please try again."); setBusy(false); return; }

      let plans = convertToPlansFormat(data);
      if (!plans) { appendPlan("assistant", "⚠️ Could not convert format."); setBusy(false); return; }

      plans = applyConstraints(plans, studyHours.current);
      plans = addRevisionSessions(plans);

      if (!currentExamId) {
        appendPlan("assistant", "⚠️ No exam selected. Please add an exam first.");
        setStage(null); setBusy(false); return;
      }

      const { plansCreated, sessionsCreated } = await saveAIPlansToExam(
        savePlanToExam, user.uid, currentExamId, plans
      );

      // Refresh plans list in store so ExamPlanSelector picks up new plans
      const freshPlans = await getPlans(user.uid, currentExamId);
      setPlans(freshPlans);
      if (freshPlans.length && !freshPlans.find(p => p.id)) {
        // noop safety
      }
      // Auto-select the first newly created plan so sessions appear immediately
      const firstNew = freshPlans[freshPlans.length - plansCreated];
      if (firstNew) { setCurrentPlanId(firstNew.id); setCurrentPlanName(firstNew.name); }

      const summary = [`✅ Created ${plansCreated} plans with ${sessionsCreated} sessions under ${examName}\n`];
      for (const entry of Object.values(plans)) {
        const highCount = entry.sessions.filter(s => s[4] === "High").length;
        summary.push(`• ${entry.displayName}: ${entry.sessions.length} sessions (${highCount} High priority)`);
      }
      appendPlan("assistant", summary.join("\n"));
      setStage(null);
      setBusy(false);
      onCreated?.(sessionsCreated, plansCreated);
    } catch (err) {
      setStage(null); setBusy(false);
      appendPlan("assistant", `⚠️ Error: ${err.message || err}\n\nPlease try again.`);
    }
  }

  const noTokens = (wallet.limit || DEFAULT_LIMIT) - (wallet.used || 0) <= 0;
  const msgs = tab === 0 ? qaChat : planChat;

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "white", marginBottom: 10 }}>🤖 AI Study Planner & Guider</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["💡 Ask Questions & Problem Solving", "📅 Study Plan Creation"].map((label, i) => (
              <button key={i} onClick={() => !busy && setTab(i)}
                style={{ ...S.tabBtn, background: tab === i ? "white" : "rgba(255,255,255,0.18)", color: tab === i ? "var(--accent)" : "white" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={onClose} style={S.closeBtn}>✕</button>
      </div>


      <div style={S.msgs}>
        {msgs.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", marginBottom: 10 }}>
              {!isUser && <span style={{ fontSize: 11, color: "var(--ink2)", marginBottom: 3, marginLeft: 4 }}>AI Coach</span>}
              <div style={{ ...S.bubble, ...(isUser ? S.bubbleUser : S.bubbleAI) }}>
                {m.content}{m.streaming && <span style={{ opacity: 0.45 }}>▋</span>}
              </div>
            </div>
          );
        })}

        {tab === 1 && splash && (
          <div style={S.splash}>
            <div style={{ fontWeight: 600, marginBottom: 10, color: "var(--ink)" }}>
              {msgT(language, "📋 Select plan type:", "📋 Plan type select pannu:", "📋 Plan type select karo:")}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={onOverall} style={{ ...S.qrBtn, background: "#16a34a" }}>
                📚 Overall ({examName.length > 15 ? examName.slice(0, 15) + ".." : examName})
              </button>
              <button onClick={onSpecific} style={{ ...S.qrBtn, background: "#2563eb" }}>🎯 Specific Topics</button>
            </div>
          </div>
        )}

        {busy && !stage && tab === 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px" }}>
            <LoadingAnimation size={32} />
            <span style={{ fontSize: 12, color: "var(--ink2)" }}>Thinking…</span>
          </div>
        )}
        {stage && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px" }}>
            <LoadingAnimation size={32} />
            <span style={{ fontSize: 12, color: "var(--ink2)" }}>Generating plan — Stage {stage} of 2…</span>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div style={S.bar}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={noTokens ? "No tokens remaining" : "Type a message…"}
          disabled={busy || noTokens}
          style={S.inp}
        />
        <button onClick={() => send()} disabled={busy || !input.trim() || noTokens}
          style={{ ...S.sendBtn, opacity: busy || !input.trim() || noTokens ? 0.4 : 1 }}>➤</button>
      </div>
    </div>
  );
}

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
  splash:     { alignSelf: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", margin: "12px 0", boxShadow: "0 4px 12px rgba(0,0,0,.08)" },
};
