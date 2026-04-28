import React, { useEffect, useState } from "react";
import { callAI } from "../../utils/aiService";
import {
  buildRevisionQuestionsPrompt, safeParseJSON, topicSlug,
} from "../../utils/materialPrompts";
import { recordRevisionResult } from "../../firebase/revisionDb";
import { LEVEL_FORMATS } from "../../utils/revisionScheduler";

/**
 * RevisionQuiz
 *  - Loads N AI-generated questions for ONE subtopic at the item's current level.
 *  - User answers each: submit → reveal answer + explanation.
 *  - 1 retry allowed per wrong question.
 *  - When the queue ends, calls onDone({correct, weakKeyPoints}) so the parent
 *    can persist the result and decide whether to advance to the next topic.
 *
 * Props:
 *  - user, examId, planId, examName
 *  - item    — { slug, topic, subtopic_name, focus, level, ... }
 *  - onDone  — callback({correct: boolean, level: number, weak: boolean})
 *  - onSkip  — called if the user closes / skips this topic
 *  - showToast
 */
export default function RevisionQuiz({
  user, examId, planId, examName, item, onDone, onSkip, showToast,
}) {
  const [questions, setQuestions] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [idx,       setIdx]       = useState(0);
  const [pending,   setPending]   = useState("");      // current text/letter input
  const [revealed,  setRevealed]  = useState(null);    // {correct, retried}
  const [retried,   setRetried]   = useState(false);
  const [results,   setResults]   = useState([]);      // [{key_point, correct (first try)}]
  const [tStart,    setTStart]    = useState(0);
  const [tNow,      setTNow]      = useState(0);

  const level = Math.max(0, Math.min(5, Number(item?.level) || 0));
  const fmt = LEVEL_FORMATS[level];
  const isMcq    = level === 0;
  const isHint   = level === 1;
  const isPure   = level === 2;
  const isTimed  = level === 3;
  const isApplied= level === 4 || level === 5;

  // Generate questions on mount.
  useEffect(() => {
    let alive = true;
    if (!item?.subtopic_name) return;
    setLoading(true); setError("");
    (async () => {
      try {
        const prompt = buildRevisionQuestionsPrompt({
          topicName: item.topic,
          subtopicName: item.subtopic_name,
          focus: item.focus || "",
          examName: examName || "",
          level,
        });
        const raw = await callAI(
          [
            { role: "system", content: "Return ONLY valid JSON. No markdown. No commentary." },
            { role: "user",   content: prompt },
          ],
          "gpt-4o-mini", 0.5,
          `revision.q.level${level}`,
        );
        const parsed = safeParseJSON(raw);
        if (!alive) return;
        if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
          setError("Couldn't load questions — try again.");
        } else {
          const trimmed = parsed.questions.slice(0, 7);
          setQuestions(trimmed);
          setTStart(Date.now());
        }
      } catch (e) {
        if (!alive) return;
        const code = e?.code === "TOKEN_LIMIT" ? "Out of AI tokens." : (e?.message || "Failed to load");
        setError(code);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [item?.subtopic_name, level]); // eslint-disable-line

  // Lightweight ticker for timed-recall mode.
  useEffect(() => {
    if (!isTimed || revealed || !tStart) return;
    const id = setInterval(() => setTNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [isTimed, revealed, tStart, idx]);

  // Reset per-question state whenever idx advances.
  useEffect(() => {
    setPending(""); setRevealed(null); setRetried(false);
    if (isTimed) setTStart(Date.now());
  }, [idx, isTimed]);

  function normalize(s) {
    return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function evaluate(q, given) {
    if (!given) return false;
    const ans = String(q.answer || "").trim();
    if (q.options && q.options.length) {
      // MCQ: compare selected letter against the answer letter.
      const letter = String(given).trim().toUpperCase().slice(0, 1);
      const ansLetter = (ans.match(/[A-D]/i) || [""])[0].toUpperCase();
      return letter === ansLetter;
    }
    // Recall / applied: forgiving substring match either direction.
    const a = normalize(ans), g = normalize(given);
    if (!a) return false;
    if (a === g) return true;
    if (a.length >= 3 && g.includes(a)) return true;
    if (g.length >= 3 && a.includes(g)) return true;
    return false;
  }

  function submit() {
    const q = questions?.[idx]; if (!q) return;
    const correct = evaluate(q, pending);
    setRevealed({ correct, retried });
    if (!correct && !retried) return; // first wrong → allow retry
    // Lock in result for this question (uses FIRST-attempt correctness).
    setResults(prev => [...prev, {
      key_point: q.key_point || q.question?.slice(0, 40) || "",
      correct: correct && !retried,
    }]);
  }

  function retry() {
    setRevealed(null); setPending(""); setRetried(true);
    if (isTimed) setTStart(Date.now());
  }

  async function next() {
    if (idx + 1 < (questions?.length || 0)) {
      setIdx(idx + 1);
      return;
    }
    // All questions answered → record overall result.
    const allCorrect = results.length > 0 && results.every(r => r.correct);
    try {
      const out = await recordRevisionResult(user.uid, examId, planId, item.slug || topicSlug(item.subtopic_name), {
        correct: allCorrect,
      });
      onDone?.({
        correct: allCorrect,
        level: out?.level ?? level,
        weak:  out?.weak  ?? !allCorrect,
        results,
      });
    } catch (e) {
      showToast?.("Couldn't save result: " + (e.message || e));
      onDone?.({ correct: allCorrect, level, weak: !allCorrect, results });
    }
  }

  if (loading) {
    return (
      <div className="stp-rev-quiz">
        <div className="stp-rev-loading">Loading questions…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="stp-rev-quiz">
        <div className="stp-rev-err">{error}</div>
        <div className="stp-rev-foot">
          <button className="stp-btn" onClick={onSkip}>Skip topic</button>
        </div>
      </div>
    );
  }
  if (!questions) return null;

  const q = questions[idx];
  const total = questions.length;
  const elapsedSec = isTimed && tStart ? Math.max(0, Math.floor((tNow - tStart) / 1000)) : 0;
  const timeLimit = 10; // seconds — warning threshold for timed recall
  const overTime = isTimed && !revealed && elapsedSec >= timeLimit;

  return (
    <div className="stp-rev-quiz">
      <div className="stp-rev-quiz-head">
        <span className="stp-rev-level-pill" data-lvl={level}>L{level + 1} · {fmt.name}</span>
        <span className="stp-rev-progress">Q{idx + 1} / {total}</span>
        {isTimed && !revealed && (
          <span className={`stp-rev-timer${overTime ? " over" : ""}`}>{elapsedSec}s</span>
        )}
      </div>

      <div className="stp-rev-key-hint">{q.key_point}</div>
      <div className="stp-rev-q">{q.question}</div>

      {isHint && q.hint && !revealed && (
        <div className="stp-rev-hint">💡 {q.hint}</div>
      )}

      {isMcq && Array.isArray(q.options) && q.options.length > 0 && (
        <div className="stp-rev-opts">
          {q.options.map((opt) => {
            const letter = (opt.match(/[A-D]/i) || [""])[0].toUpperCase();
            const text = opt.replace(/^[A-D][\)\.\s]+/i, "").trim();
            const sel = pending.toUpperCase() === letter;
            return (
              <button
                key={letter}
                className={`stp-rev-opt${sel ? " on" : ""}`}
                disabled={!!revealed}
                onClick={() => setPending(letter)}
              >
                <span className="ltr">{letter}</span>
                <span className="txt">{text}</span>
              </button>
            );
          })}
        </div>
      )}

      {!isMcq && (
        <input
          className="stp-input stp-rev-input"
          placeholder={isTimed ? "Quick! Type your answer…" : "Type your answer"}
          value={pending}
          disabled={!!revealed}
          autoFocus
          onChange={e => setPending(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
        />
      )}

      {revealed && (
        <div className={`stp-rev-reveal ${revealed.correct ? "ok" : "bad"}`}>
          <div className="stp-rev-reveal-head">
            {revealed.correct
              ? (revealed.retried ? "Correct on retry" : "Correct ✓")
              : (retried ? "Still incorrect ✕" : "Not quite ✕")}
          </div>
          <div className="stp-rev-reveal-line"><b>Answer:</b> {q.answer}</div>
          {q.explanation && <div className="stp-rev-reveal-line"><b>Why:</b> {q.explanation}</div>}
        </div>
      )}

      <div className="stp-rev-foot">
        <button className="stp-btn" onClick={onSkip}>Skip topic</button>
        {!revealed && (
          <button className="stp-btn primary" onClick={submit} disabled={!pending}>
            Submit
          </button>
        )}
        {revealed && !revealed.correct && !retried && (
          <button className="stp-btn primary" onClick={retry}>Retry once</button>
        )}
        {revealed && (revealed.correct || retried) && (
          <button className="stp-btn primary" onClick={next}>
            {idx + 1 < total ? "Next question" : "Finish"}
          </button>
        )}
      </div>
    </div>
  );
}
