/**
 * AdaptivePath — Diagnostic quiz + depth-adjusted learning path
 *
 * Flow: INPUT → DIAGNOSING → PROFILE_READY → PATH_READY
 *
 * 1. User types a question
 * 2. Diagnostic quiz (3-5 narrowing questions) assesses knowledge
 * 3. Knowledge profile shows what they know vs gaps
 * 4. Generate a depth-adjusted BespokePath based on the profile
 */

import { useState, useCallback } from "react";
import useAdaptiveQuiz from "../../hooks/useAdaptiveQuiz";
import { sanitizeQuery, checkRateLimit, recordQuery } from "../../services/securityGuardrails";
import { generateBespokePath } from "../../services/bespokePathService";
import { findCachedPath, cachePath } from "../../services/pathCacheService";
import PathStep from "../BespokePath/PathStep";
import QuizEngine from "../BespokePath/QuizEngine";
import { generateStepAudio, generateStepTakeaways } from "../../services/stepBriefingService";
import "./AdaptivePath.css";

const DEFAULT_SUGGESTIONS = [
  "Why is my multiplayer character not replicating properly?",
  "How do I set up Gameplay Ability System from scratch?",
  "My landscape material looks tiled — how to fix it?",
  "How to optimize draw calls in a large open world?",
  "Why does my AI Behavior Tree keep failing?",
];

const LETTERS = ["A", "B", "C", "D"];

export default function AdaptivePath() {
  const [query, setQuery] = useState("");
  const [pathData, setPathData] = useState(null);
  const [pathLoading, setPathLoading] = useState(false);
  const [pathError, setPathError] = useState(null);

  // Step expansion / briefing state (mirrors BespokePath)
  const [expandedStep, setExpandedStep] = useState(null);
  const [stepAudio, setStepAudio] = useState({});
  const [stepTakeaways, setStepTakeaways] = useState({});
  const [quizStep, setQuizStep] = useState(null);
  const [pathNarration, setPathNarration] = useState(null);

  const {
    stage,
    questions,
    currentIndex,
    currentQuestion,
    knowledgeProfile,
    error: quizError,
    startDiagnostic,
    submitAnswer,
    reset,
    STAGES,
  } = useAdaptiveQuiz();

  /**
   * Handle starting the diagnostic quiz
   */
  const handleStart = useCallback(async () => {
    const result = sanitizeQuery(query);
    if (!result.valid) return;

    const cleaned = result.sanitized;
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) return;

    recordQuery(cleaned);
    startDiagnostic(cleaned);
  }, [query, startDiagnostic]);

  /**
   * After diagnostic, generate the depth-adjusted path
   */
  const handleGeneratePath = useCallback(async () => {
    if (!knowledgeProfile) return;

    setPathLoading(true);
    setPathError(null);

    try {
      // Check cache first (include profile hash in cache key)
      const profileKey = `${query}_adaptive_${knowledgeProfile.level}`;
      const cached = await findCachedPath(profileKey);
      if (cached) {
        setPathData(cached);
        setPathLoading(false);
        return;
      }

      // Generate path with knowledge profile context
      const result = await generateBespokePath(query, knowledgeProfile);

      if (result.error) {
        setPathError(result.error);
      } else {
        setPathData(result);
        cachePath(profileKey, result);
      }
    } catch (err) {
      setPathError(err.message || "Failed to generate learning path.");
    } finally {
      setPathLoading(false);
    }
  }, [query, knowledgeProfile]);

  /**
   * Start over completely
   */
  const handleReset = useCallback(() => {
    reset();
    setQuery("");
    setPathData(null);
    setPathError(null);
    setPathLoading(false);
    setExpandedStep(null);

    setStepAudio({});
    setStepTakeaways({});
    setQuizStep(null);
    setPathNarration(null);
  }, [reset]);

  // Audio/takeaway handlers (same pattern as BespokePath)
  const handleStepAudio = useCallback(
    async (index, step) => {
      if (stepAudio[index]) return;
      setStepAudio((prev) => ({ ...prev, [index]: { loading: true } }));
      try {
        const audio = await generateStepAudio(query, step);
        setStepAudio((prev) => ({ ...prev, [index]: { url: audio.url, loading: false } }));
      } catch {
        setStepAudio((prev) => ({ ...prev, [index]: { error: true, loading: false } }));
      }
    },
    [query, stepAudio]
  );

  const handleStepTakeaways = useCallback(
    async (index, step) => {
      if (stepTakeaways[index]) return;
      setStepTakeaways((prev) => ({ ...prev, [index]: { loading: true } }));
      try {
        const result = await generateStepTakeaways(query, step);
        setStepTakeaways((prev) => ({
          ...prev,
          [index]: { items: result.takeaways, loading: false },
        }));
      } catch {
        setStepTakeaways((prev) => ({
          ...prev,
          [index]: { error: true, loading: false },
        }));
      }
    },
    [query, stepTakeaways]
  );

  // ── RENDER: Input Stage ──
  if (stage === STAGES.IDLE) {
    return (
      <div className="adaptive-path">
        <div className="adaptive-input-section">
          <h1 className="adaptive-title">🎯 Adaptive Learning Path</h1>
          <p className="adaptive-subtitle">
            Tell us what you want to learn about. We&apos;ll start with a quick diagnostic to
            understand what you already know, then build a personalized path that goes deep where it
            matters most.
          </p>

          <div className="adaptive-input-wrapper">
            <textarea
              className="adaptive-textarea"
              placeholder="Describe what you want to learn or the problem you're facing..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleStart();
                }
              }}
            />
            <button className="adaptive-start-btn" onClick={handleStart} disabled={!query.trim()}>
              🧪 Start Diagnostic
            </button>

            <div className="adaptive-pills">
              <span className="adaptive-pills-label">Suggested:</span>
              {DEFAULT_SUGGESTIONS.map((s, i) => (
                <button key={i} className="adaptive-pill" onClick={() => setQuery(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER: Loading (generating questions) ──
  if (stage === STAGES.LOADING) {
    return (
      <div className="adaptive-path">
        <div className="adaptive-loading">
          <div className="adaptive-loading-spinner" />
          <p className="adaptive-loading-text">
            Analyzing your topic and preparing diagnostic questions...
          </p>
        </div>
      </div>
    );
  }

  // ── RENDER: Error ──
  if (stage === STAGES.ERROR) {
    return (
      <div className="adaptive-path">
        <div className="adaptive-error">
          <p className="adaptive-error-msg">⚠️ {quizError}</p>
          <button className="adaptive-retry-btn" onClick={handleReset}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER: Diagnostic Quiz ──
  if (stage === STAGES.QUIZZING && currentQuestion) {
    const progress = ((currentIndex + 1) / questions.length) * 100;

    return (
      <div className="adaptive-path">
        <div className="diagnostic-quiz">
          <div className="diagnostic-header">
            <h2>📋 Knowledge Diagnostic</h2>
            <p>Answer these questions so we can personalize your learning path</p>
          </div>

          <div className="diagnostic-progress">
            <div className="diagnostic-progress-fill" style={{ width: `${progress}%` }} />
          </div>

          <div className="diagnostic-card" key={currentIndex}>
            <div className="diagnostic-question-num">
              Question {currentIndex + 1} of {questions.length}
            </div>

            {currentQuestion.concept && (
              <span className="diagnostic-concept-tag">
                {currentQuestion.concept.replace(/_/g, " ")}
              </span>
            )}

            <p className="diagnostic-question-text">{currentQuestion.q}</p>

            <div className="diagnostic-options">
              {currentQuestion.options.map((option, optIdx) => (
                <button
                  key={optIdx}
                  className="diagnostic-option"
                  onClick={() => submitAnswer(optIdx)}
                >
                  <span className="diagnostic-option-letter">{LETTERS[optIdx]}</span>
                  {option}
                </button>
              ))}

              <button className="diagnostic-unsure" onClick={() => submitAnswer(-1)}>
                🤔 I&apos;m not sure
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER: Knowledge Profile (quiz complete, path not yet generated) ──
  if (stage === STAGES.COMPLETE && knowledgeProfile && !pathData && !pathLoading) {
    return (
      <div className="adaptive-path">
        <div className="knowledge-summary">
          <h2>📊 Your Knowledge Profile</h2>
          <p>Based on your diagnostic, here&apos;s what we found:</p>

          <span className={`knowledge-level-badge ${knowledgeProfile.level}`}>
            {knowledgeProfile.level.charAt(0).toUpperCase() + knowledgeProfile.level.slice(1)} Level
          </span>

          <div className="knowledge-lists">
            <div className="knowledge-list knows">
              <h3>✅ You Know</h3>
              <ul>
                {knowledgeProfile.knows.length > 0 ? (
                  knowledgeProfile.knows.map((c, i) => <li key={i}>{c.replace(/_/g, " ")}</li>)
                ) : (
                  <li style={{ fontStyle: "italic" }}>No strong areas detected</li>
                )}
              </ul>
            </div>
            <div className="knowledge-list gaps">
              <h3>🔍 Gaps to Fill</h3>
              <ul>
                {knowledgeProfile.gaps.length > 0 ? (
                  knowledgeProfile.gaps.map((c, i) => <li key={i}>{c.replace(/_/g, " ")}</li>)
                ) : (
                  <li style={{ fontStyle: "italic" }}>No gaps detected — nice!</li>
                )}
              </ul>
            </div>
          </div>

          <button className="adaptive-generate-btn" onClick={handleGeneratePath}>
            ✨ Generate Personalized Path
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER: Path loading ──
  if (pathLoading) {
    return (
      <div className="adaptive-path">
        <div className="adaptive-loading">
          <div className="adaptive-loading-spinner" />
          <p className="adaptive-loading-text">
            Building your personalized learning path based on your knowledge profile...
          </p>
        </div>
      </div>
    );
  }

  // ── RENDER: Path error ──
  if (pathError) {
    return (
      <div className="adaptive-path">
        <div className="adaptive-error">
          <p className="adaptive-error-msg">⚠️ {pathError}</p>
          <button className="adaptive-retry-btn" onClick={handleReset}>
            Start Over
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER: Path ready (reuses BespokePath step rendering) ──
  if (pathData && pathData.path) {
    return (
      <div className="adaptive-path">
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <h2 className="adaptive-title" style={{ fontSize: "1.4rem" }}>
            🎯 Your Adaptive Learning Path
          </h2>
          <p className="adaptive-subtitle" style={{ marginBottom: "0.5rem" }}>
            Personalized for your <strong>{knowledgeProfile?.level}</strong> level —{" "}
            {pathData.path.length} steps
          </p>
          {knowledgeProfile?.gaps.length > 0 && (
            <p style={{ fontSize: "0.8rem", color: "var(--accent-orange)" }}>
              Deep focus on: {knowledgeProfile.gaps.map((g) => g.replace(/_/g, " ")).join(", ")}
            </p>
          )}

          <button
            className="adaptive-retry-btn"
            onClick={handleReset}
            style={{ marginTop: "0.75rem" }}
          >
            🔄 Start New Diagnostic
          </button>
        </div>

        {pathData.path.map((step, index) => (
          <PathStep
            key={index}
            step={step}
            index={index}
            total={pathData.path.length}
            bridge={pathData.bridges?.[index - 1]}
            expanded={expandedStep === index}
            onToggle={() => setExpandedStep(expandedStep === index ? null : index)}
            audio={stepAudio[index]}
            onRequestAudio={() => handleStepAudio(index, step)}
            takeaways={stepTakeaways[index]}
            onRequestTakeaways={() => handleStepTakeaways(index, step)}
            onQuiz={() => setQuizStep(index)}
            narration={pathNarration}
            query={query}
          />
        ))}

        {/* Quiz overlay */}
        {quizStep !== null && pathData.path[quizStep] && (
          <QuizEngine
            step={pathData.path[quizStep]}
            query={query}
            onClose={() => setQuizStep(null)}
          />
        )}
      </div>
    );
  }

  return null;
}
