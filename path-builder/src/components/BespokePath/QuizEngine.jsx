/**
 * QuizEngine — Interactive MCQ quiz shown after each path step.
 *
 * Props:
 * - questions: Array of {stem, choices, correct, explanation, explanations?}
 *   - explanations (optional): array aligned with Object.keys(choices); when
 *     present, the per-choice string is shown on reveal instead of the shared
 *     `explanation` fallback.
 * - stepIndex: Which path step this quiz belongs to
 * - onComplete: Callback with {stepIndex, score, total, perQuestionResults}
 *   when the quiz is finished. `perQuestionResults` is a 1:1 array with the
 *   questions prop in order; each entry is {correct: boolean}. This lets the
 *   PFA (Phase 2A) per-question skill-signal path fire with question-level
 *   granularity instead of a single coarse lesson-level signal.
 */

import { useState, useCallback } from "react";
import { scoreAnswer } from "../../services/quizService";
import "./QuizEngine.css";

export default function QuizEngine({ questions, stepIndex, onComplete }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState([]); // {isCorrect, selected, correct, explanation}

  const question = questions?.[currentQ];
  const isLastQ = currentQ === (questions?.length ?? 0) - 1;

  const handleSelect = useCallback(
    (key) => {
      if (revealed) return;
      setSelected(key);
    },
    [revealed]
  );

  const handleCheck = useCallback(() => {
    if (!selected || revealed || !question) return;
    const result = scoreAnswer(question, selected);
    setRevealed(true);
    setResults((prev) => [...prev, { ...result, selected }]);
  }, [selected, revealed, question]);

  const handleNext = useCallback(() => {
    if (isLastQ) {
      // results is indexed in question order because handleCheck appends on
      // each question before handleNext advances. pickedIndex joins the
      // selected choice back to its option index for misconception mining.
      const perQuestionResults = results.map((r, idx) => {
        const q = questions[idx];
        const choiceKeys = q ? Object.keys(q.choices || {}) : [];
        const pickedIdx = choiceKeys.indexOf(r?.selected);
        const out = { correct: !!r.isCorrect };
        if (pickedIdx >= 0) out.pickedIndex = pickedIdx;
        return out;
      });
      onComplete?.({
        stepIndex,
        score: results.filter((r) => r.isCorrect).length,
        total: questions.length,
        perQuestionResults,
      });
    } else {
      setCurrentQ((prev) => prev + 1);
      setSelected(null);
      setRevealed(false);
    }
  }, [isLastQ, results, onComplete, stepIndex, questions]);

  if (!questions || questions.length === 0) return null;

  const getChoiceClass = (key) => {
    if (!revealed) return selected === key ? "selected" : "";
    if (key === question.correct) return "correct";
    if (key === selected && key !== question.correct) return "incorrect";
    return "dimmed";
  };

  return (
    <div className="quiz-engine">
      <div className="quiz-header">
        <span className="quiz-badge">📝 Quick Check</span>
        <span className="quiz-progress">
          {currentQ + 1} / {questions.length}
        </span>
      </div>

      <div className="quiz-question">
        <p className="quiz-stem">{question.stem}</p>

        <div className="quiz-choices">
          {Object.entries(question.choices).map(([key, value]) => (
            <button
              key={key}
              className={`quiz-choice ${getChoiceClass(key)}`}
              onClick={() => handleSelect(key)}
              disabled={revealed}
            >
              <span className="choice-key">{key}</span>
              <span className="choice-text">{value}</span>
              {revealed && key === question.correct && <span className="choice-icon">✓</span>}
              {revealed && key === selected && key !== question.correct && (
                <span className="choice-icon">✗</span>
              )}
            </button>
          ))}
        </div>

        {/* Explanation after reveal — prefer per-choice explanations when present */}
        {revealed && (() => {
          const choiceKeys = Object.keys(question.choices);
          const selectedIdx = choiceKeys.indexOf(selected);
          const perChoice =
            Array.isArray(question.explanations) && selectedIdx >= 0
              ? question.explanations[selectedIdx]
              : null;
          const text = perChoice || question.explanation || "";
          return (
            <div
              className={`quiz-explanation ${selected === question.correct ? "correct" : "incorrect"}`}
            >
              <span className="explanation-icon">{selected === question.correct ? "✅" : "💡"}</span>
              <p>{text}</p>
            </div>
          );
        })()}

        {/* Action buttons */}
        <div className="quiz-actions">
          {!revealed ? (
            <button className="quiz-check-btn" onClick={handleCheck} disabled={!selected}>
              Check Answer
            </button>
          ) : (
            <button className="quiz-next-btn" onClick={handleNext}>
              {isLastQ
                ? `Finish Quiz (${results.filter((r) => r.isCorrect).length}/${questions.length})`
                : "Next Question →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
