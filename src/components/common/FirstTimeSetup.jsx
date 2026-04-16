import React, { useState } from "react";
import { saveUserSettings } from "../../firebase/db";
import useStore from "../../store/useStore";

export default function FirstTimeSetup({ user, onComplete }) {
  const { setSettings } = useStore();
  const [step, setStep]   = useState(1);
  const [busy, setBusy]   = useState(false);

  const [displayName,   setDisplayName]   = useState(user?.displayName || "");
  const [dailyGoal,     setDailyGoal]     = useState(6);
  const [timezone]                        = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [examName,      setExamName]      = useState("");
  const [examDate,      setExamDate]      = useState("");
  const [planName,      setPlanName]      = useState("");
  const [subjectCount,  setSubjectCount]  = useState(5);

  async function handleFinish() {
    setBusy(true);
    try {
      const settings = {
        displayName, dailyGoalHours: dailyGoal, timezone,
        examName, examDate, planName, subjectCount,
        firstTimeSetup: true, darkMode: false, setupAt: Date.now(),
      };
      await saveUserSettings(user.uid, settings);
      setSettings(settings);
      onComplete(settings);
    } finally { setBusy(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 20, padding: "36px 32px", width: "min(480px,100%)", boxShadow: "0 30px 80px rgba(0,0,0,.35)", maxHeight: "90vh", overflowY: "auto" }}>

        {step === 1 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📚</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>Welcome to StudyTimer Pro</h2>
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
              <input value={examName} onChange={e => setExamName(e.target.value)} placeholder="e.g. TNPSC Group 4" style={inputS} />
            </Field>
            <Field label="Exam Date">
              <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} style={inputS} />
            </Field>
            <Field label="Plan Name">
              <input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="e.g. General Tamil" style={inputS} />
            </Field>
            <Field label={`Number of Subjects — ${subjectCount}`}>
              <input type="range" min={1} max={20} value={subjectCount} onChange={e => setSubjectCount(+e.target.value)}
                style={{ width: "100%", accentColor: "var(--accent)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink2)", marginTop: 4 }}>
                <span>1</span><span style={{ color: "var(--accent)", fontWeight: 700 }}>{subjectCount} subjects</span><span>20</span>
              </div>
            </Field>
            <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 24 }}>
              <button onClick={() => setStep(2)} style={backBtn}>← Back</button>
              <button onClick={handleFinish} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }}>
                {busy ? "Saving..." : "🎉 Finish Setup"}
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
      </div>
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
