import React, { useState } from "react";
import { updateProfile } from "firebase/auth";
import { auth } from "../../firebase/config";
import { saveUserSettings, saveUser, saveExam, savePlanToExam, getPlans } from "../../firebase/db";
import useStore from "../../store/useStore";
import TimePeriodPicker from "./TimePeriodPicker";
import {
  stage1AnalyzeExam, stage2ParseAnalysis, stage2FallbackParse,
  convertToPlansFormat, applyConstraints, addRevisionSessions,
  saveAIPlansToExam,
} from "../../utils/aiService";

function timingPretty(timing) {
  if (!timing || !timing.includes("-")) return "Not set";
  const [a, b] = timing.split("-");
  const fmt = t => {
    const [h, m] = t.split(":").map(Number);
    const hh12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ap = h < 12 ? "AM" : "PM";
    return `${hh12}${m === 0 ? "" : ":" + String(m).padStart(2, "0")} ${ap}`;
  };
  return `${fmt(a)} → ${fmt(b)}`;
}

function diffHours(timing) {
  if (!timing || !timing.includes("-")) return 0;
  const [a, b] = timing.split("-");
  const [sh, sm] = a.split(":").map(Number);
  const [eh, em] = b.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 10) / 10;
}

export default function FirstTimeSetup({ user, onComplete }) {
  const {
    setSettings, setUser, showToast,
    setCurrentExamId, setCurrentExamName, setExams,
    setPlans, setCurrentPlanId, setCurrentPlanName,
  } = useStore();
  const [step, setStep]   = useState(1);
  const [busy, setBusy]   = useState(false);

  const [displayName,   setDisplayName]   = useState(user?.displayName || "");
  const [dailyGoal,     setDailyGoal]     = useState(6);
  const [timezone]                        = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [examName,      setExamName]      = useState("");
  const [examDate,      setExamDate]      = useState("");
  const [studyTiming,   setStudyTiming]   = useState("06:00-10:00");
  const [showPicker,    setShowPicker]    = useState(false);

  // ── Auto plan-creation overlay state ──
  const [generating, setGenerating] = useState(false);
  const [genStage,   setGenStage]   = useState("");
  const [genError,   setGenError]   = useState("");

  const studyHours = diffHours(studyTiming);

  async function handleFinish() {
    if (!examName.trim()) { showToast?.("Please enter your exam name"); return; }
    if (!studyTiming || !studyTiming.includes("-")) { showToast?.("Please pick a study time"); return; }

    setBusy(true);
    try {
      const settings = {
        displayName, dailyGoalHours: dailyGoal, timezone,
        examName: examName.trim(), examDate,
        studyTiming, studyHours: String(studyHours),
        firstTimeSetup: true, darkMode: false, setupAt: Date.now(),
      };

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName });
        setUser({ ...auth.currentUser, displayName });
      }

      await saveUserSettings(user.uid, settings);
      await saveUser(user.uid, { name: displayName });

      // ── Kick off automatic AI plan creation BEFORE flipping settings flag ──
      // (so the modal stays mounted and the overlay shows progress)
      setBusy(false);
      await runAutoPlanCreation(settings);

      // Now flip the flag → App.jsx unmounts the setup modal
      setSettings(settings);
      onComplete(settings);
    } catch (err) {
      setBusy(false);
      showToast?.(err?.message || "Setup failed");
    }
  }

  async function runAutoPlanCreation(settings) {
    setGenerating(true);
    setGenError("");
    try {
      // 1. Create exam record
      setGenStage("📚 Creating your exam...");
      const examId = await saveExam(user.uid, { name: settings.examName });
      setCurrentExamId(examId);
      setCurrentExamName(settings.examName);
      setExams([{ id: examId, name: settings.examName, createdAt: Date.now() }]);

      // 2. Stage 1: PYQ analysis (overall — no specific topics)
      setGenStage("🧠 Stage 1: Analyzing exam pattern...");
      const analysis = await stage1AnalyzeExam(settings.examName, "overall", null);
      if (!analysis) throw new Error("Failed to analyze exam");

      // 3. Stage 2: Build structured JSON (with fallback)
      setGenStage("📊 Stage 2: Building your plan structure...");
      let data = await stage2ParseAnalysis(analysis, String(settings.studyHours), settings.studyTiming);
      if (!data) {
        setGenStage("🔄 Retrying with direct method...");
        data = await stage2FallbackParse(settings.examName, String(settings.studyHours), settings.studyTiming);
      }
      if (!data) throw new Error("Could not create plan structure");

      // 4. Convert + constraints + revision
      setGenStage("📝 Finalizing sessions...");
      let plans = convertToPlansFormat(data);
      if (!plans) throw new Error("Format conversion failed");
      plans = applyConstraints(plans, String(settings.studyHours));
      plans = addRevisionSessions(plans);

      // 5. Save plans
      setGenStage("💾 Saving your plans...");
      const { plansCreated, sessionsCreated } = await saveAIPlansToExam(
        savePlanToExam, user.uid, examId, plans
      );

      // 6. Refresh in-store list and pick first plan
      const fresh = await getPlans(user.uid, examId);
      setPlans(fresh);
      if (fresh.length) {
        setCurrentPlanId(fresh[0].id);
        setCurrentPlanName(fresh[0].name);
      }

      setGenStage(`✅ Created ${plansCreated} plans (${sessionsCreated} sessions)`);
      await new Promise(r => setTimeout(r, 1100));
    } catch (err) {
      setGenError(err?.message || "Plan creation failed. You can try again from 'Plan with AI'.");
      // Keep error visible briefly
      await new Promise(r => setTimeout(r, 2200));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 20, padding: "36px 32px", width: "min(480px,100%)", boxShadow: "0 30px 80px rgba(0,0,0,.35)", maxHeight: "90vh", overflowY: "auto", position: "relative" }}>

        {step === 1 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📚</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>Welcome to Lighthouse Prep</h2>
            <p style={{ fontSize: 15, color: "var(--ink2)", marginBottom: 32, lineHeight: 1.6 }}>
              Let's set up your study profile in just a minute.<br />It helps us personalize your experience.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 8 }}>
              {["📅 Plan sessions","⏱ Track time","📊 Spot wastage"].map(t => (
                <div key={t} style={{ background: "var(--bg)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--ink2)", textAlign: "center", flex: 1 }}>{t}</div>
              ))}
            </div>
            <button onClick={() => setStep(2)} style={primaryBtn}>Let's Get Started →</button>
          </div>
        )}

        {step === 2 && (
          <div>
            <StepHead icon="👤" title="Your Study Profile" sub="Step 2 of 3" />
            <Field label="Display Name">
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inputS} placeholder="Your name" />
            </Field>
            <Field label={`Daily Study Goal — ${dailyGoal}h`}>
              <input type="range" min={1} max={12} value={dailyGoal} onChange={e => setDailyGoal(+e.target.value)}
                style={{ width: "100%", accentColor: "var(--accent)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink2)", marginTop: 4 }}>
                <span>1h</span><span style={{ color: "var(--accent)", fontWeight: 700 }}>{dailyGoal}h / day</span><span>12h</span>
              </div>
            </Field>
            <Field label="Your Timezone">
              <input value={timezone} readOnly style={{ ...inputS, opacity: 0.7, cursor: "not-allowed" }} />
            </Field>
            <NavBtns onBack={() => setStep(1)} onNext={() => setStep(3)} />
          </div>
        )}

        {step === 3 && (
          <div>
            <StepHead icon="🎯" title="Your Exam Details" sub="Step 3 of 3" />
            <Field label="Exam Name">
              <input value={examName} onChange={e => setExamName(e.target.value)} placeholder="e.g. SSC JE Electrical" style={inputS} />
            </Field>
            <Field label="Exam Date">
              <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} style={inputS} />
            </Field>
            <Field label={`Study Hours — ${studyHours}h / day`}>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                style={{
                  ...inputS, display: "flex", justifyContent: "space-between", alignItems: "center",
                  cursor: "pointer", textAlign: "left", padding: "10px 14px",
                }}
              >
                <span style={{ fontWeight: 600 }}>⏰ {timingPretty(studyTiming)}</span>
                <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 12 }}>Change</span>
              </button>
              <div style={{ fontSize: 11, color: "var(--ink2)", marginTop: 6 }}>
                We'll auto-create your plan based on this window.
              </div>
            </Field>
            <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 24 }}>
              <button onClick={() => setStep(2)} style={backBtn} disabled={busy || generating}>← Back</button>
              <button
                onClick={handleFinish}
                disabled={busy || generating || !examName.trim()}
                style={{ ...primaryBtn, opacity: (busy || generating || !examName.trim()) ? 0.6 : 1 }}
              >
                {busy ? "Saving..." : "🎉 Finish & Create Plan"}
              </button>
            </div>
          </div>
        )}

        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 28 }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{
              width: s === step ? 28 : 8, height: 8, borderRadius: 4,
              background: s <= step ? "var(--accent)" : "var(--border)",
              transition: "all .3s ease",
            }} />
          ))}
        </div>

        {/* Auto plan-creation overlay */}
        {generating && (
          <div style={overlay}>
            <div style={overlayCard}>
              <div className="stp-spinner" style={spinner} />
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginTop: 14, textAlign: "center" }}>
                Building your study plan
              </div>
              <div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 8, textAlign: "center", minHeight: 20 }}>
                {genStage}
              </div>
              {genError && (
                <div style={{ fontSize: 12, color: "#B5453A", marginTop: 10, textAlign: "center" }}>
                  {genError}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showPicker && (
        <TimePeriodPicker
          value={studyTiming}
          onChange={({ timing }) => setStudyTiming(timing)}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

function StepHead({ icon, title, sub }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, color: "var(--ink2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{sub}</div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>{icon} {title}</h2>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink2)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function NavBtns({ onBack, onNext }) {
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 24 }}>
      <button onClick={onBack} style={backBtn}>← Back</button>
      <button onClick={onNext} style={primaryBtn}>Next →</button>
    </div>
  );
}

const inputS     = { width: "100%", padding: "10px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit", boxSizing: "border-box" };
const primaryBtn = { background: "var(--accent)", color: "white", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
const backBtn    = { background: "none", border: "1.5px solid var(--border)", borderRadius: 10, padding: "11px 20px", fontSize: 14, cursor: "pointer", color: "var(--ink2)" };
const overlay    = { position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, backdropFilter: "blur(2px)" };
const overlayCard= { background: "var(--surface)", borderRadius: 16, padding: "22px 26px", width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", alignItems: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" };
const spinner    = { width: 38, height: 38, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "stpSpin 0.9s linear infinite" };
