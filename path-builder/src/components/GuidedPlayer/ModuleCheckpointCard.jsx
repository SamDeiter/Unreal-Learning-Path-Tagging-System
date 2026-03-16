/**
 * ModuleCheckpointCard.jsx — Post-Module Verification UI
 *
 * Rendered during the CHECKPOINT stage in the guided player.
 * Collects:
 *   - Confidence before/after (1-5 Likert scale)
 *   - 1-3 targeted quiz questions
 *   - "Did this help with your actual issue?" prompt
 *
 * On submission, evaluates the verdict and triggers replanning.
 */

import { useState } from "react";
import { evaluateCheckpoint } from "../../services/checkpointService";

// ── Confidence Labels ──────────────────────────────────────────────
const CONFIDENCE_LABELS = [
  "", // 0 = not selected
  "No clue",
  "Vaguely familiar",
  "I get the idea",
  "Pretty confident",
  "Could teach it",
];

// ── Component ─────────────────────────────────────────────────────

export default function ModuleCheckpointCard({
  checkpoint,
  quizQuestions,
  moduleName,
  onSubmit,
  onSkip,
}) {
  const [confBefore, setConfBefore] = useState(0);
  const [confAfter, setConfAfter] = useState(0);
  const [answers, setAnswers] = useState({});
  const [helped, setHelped] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [verdict, setVerdict] = useState(null);

  // Calculate quiz results from answers
  const quizResult = {
    correct: 0,
    total: quizQuestions?.length || 0,
    questions: [],
  };

  if (quizQuestions) {
    for (let i = 0; i < quizQuestions.length; i++) {
      const q = quizQuestions[i];
      const selected = answers[i];
      const isCorrect = q.type === "self-report"
        ? selected === 0 // first option = "Yes, I can do this"
        : selected === q.correctIndex;
      if (isCorrect) quizResult.correct++;
      quizResult.questions.push({
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        selectedIndex: selected ?? -1,
      });
    }
  }

  const canSubmit = confBefore > 0 && confAfter > 0 && helped !== null;

  const handleSubmit = () => {
    const completed = {
      ...checkpoint,
      confidenceBefore: confBefore,
      confidenceAfter: confAfter,
      quizResult,
      helpedWithIssue: helped,
      timestamp: new Date().toISOString(),
    };
    completed.verdict = evaluateCheckpoint(completed);
    setVerdict(completed.verdict);
    setSubmitted(true);

    // Wait a moment to show the verdict, then proceed
    setTimeout(() => onSubmit(completed), 1800);
  };

  // ── Verdict display ──
  const verdictConfig = {
    pass: { emoji: "✅", label: "Great progress!", color: "#3fb950" },
    struggle: { emoji: "🔧", label: "Let's reinforce this", color: "#d29922" },
    irrelevant: { emoji: "⏭️", label: "Noted — adjusting path", color: "#8b949e" },
    skipped: { emoji: "⏩", label: "Skipped", color: "#8b949e" },
  };

  return (
    <div className="checkpoint-card">
      <div className="checkpoint-header">
        <span className="checkpoint-badge">📋 Module Checkpoint</span>
        <h2>{moduleName || "Module Review"}</h2>
        {checkpoint.originalProblem && (
          <p className="checkpoint-problem">
            <strong>Your original question:</strong> {checkpoint.originalProblem}
          </p>
        )}
      </div>

      {submitted && verdict ? (
        <div className="checkpoint-verdict" style={{ borderColor: verdictConfig[verdict]?.color }}>
          <span className="verdict-emoji">{verdictConfig[verdict]?.emoji}</span>
          <span className="verdict-label">{verdictConfig[verdict]?.label}</span>
        </div>
      ) : (
        <>
          {/* Confidence Before */}
          <div className="checkpoint-section">
            <h3>Before this module, how confident were you about this topic?</h3>
            <div className="confidence-scale">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={`conf-btn ${confBefore === n ? "active" : ""}`}
                  onClick={() => setConfBefore(n)}
                  title={CONFIDENCE_LABELS[n]}
                >
                  {n}
                  <span className="conf-label">{CONFIDENCE_LABELS[n]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Confidence After */}
          <div className="checkpoint-section">
            <h3>After completing this module, how confident are you now?</h3>
            <div className="confidence-scale">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={`conf-btn ${confAfter === n ? "active" : ""}`}
                  onClick={() => setConfAfter(n)}
                  title={CONFIDENCE_LABELS[n]}
                >
                  {n}
                  <span className="conf-label">{CONFIDENCE_LABELS[n]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quiz Questions */}
          {quizQuestions && quizQuestions.length > 0 && (
            <div className="checkpoint-section checkpoint-quiz">
              <h3>Quick Check</h3>
              {quizQuestions.map((q, qi) => (
                <div key={qi} className="quiz-question">
                  <p className="quiz-q-text">{q.question}</p>
                  {q.options && (
                    <div className="quiz-options">
                      {q.options.map((opt, oi) => (
                        <button
                          key={oi}
                          className={`quiz-option ${answers[qi] === oi ? "selected" : ""}`}
                          onClick={() => setAnswers((prev) => ({ ...prev, [qi]: oi }))}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Did this help? */}
          <div className="checkpoint-section">
            <h3>Did this module help with your actual issue?</h3>
            <div className="helped-options">
              {[
                { value: "yes", label: "✅ Yes", desc: "This directly addressed my problem" },
                { value: "partially", label: "🔶 Partially", desc: "Helpful context, but not the fix" },
                { value: "no", label: "❌ No", desc: "Not relevant to my issue" },
              ].map(({ value, label, desc }) => (
                <button
                  key={value}
                  className={`helped-btn ${helped === value ? "active" : ""}`}
                  onClick={() => setHelped(value)}
                  title={desc}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="checkpoint-actions">
            <button
              className="checkpoint-submit"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              Submit & Continue
            </button>
            <button
              className="checkpoint-skip"
              onClick={() => {
                const skipped = { ...checkpoint, verdict: "skipped", timestamp: new Date().toISOString() };
                onSkip(skipped);
              }}
            >
              Skip Checkpoint
            </button>
          </div>
        </>
      )}
    </div>
  );
}
