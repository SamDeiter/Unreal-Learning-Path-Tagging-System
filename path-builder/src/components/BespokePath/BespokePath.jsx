/**
 * BespokePath — AI-generated "Fix a Problem" learning path UI
 *
 * Renders the full bespoke path experience:
 * 1. Query input → 2. Loading pipeline → 3. Sequenced path with bridge narrations
 */

import { useState, useCallback, useRef } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "../../services/firebaseConfig";
import { generateBespokePath } from "../../services/bespokePathService";
import { generateQuizForStep } from "../../services/quizService";
import { findCachedPath, cachePath, addToHistory } from "../../services/pathCacheService";
import { sanitizeQuery, checkRateLimit, recordQuery } from "../../services/securityGuardrails";
import PRE_SEEDED_PATHS from "../../data/preSeededPaths";
import PathStep from "./PathStep";
import BridgeNarration from "./BridgeNarration";
import PathProgress from "./PathProgress";
import QuizEngine from "./QuizEngine";
import PreSeededPaths from "./PreSeededPaths";
import "./BespokePath.css";

const EXAMPLE_QUERIES = [
  "How do I fix character animation jittering in multiplayer?",
  "Why does my material look different in Lumen vs path tracing?",
  "How to optimize Nanite meshes for open world performance?",
  "Setting up Gameplay Ability System for a melee combat game",
  "Why is my landscape material tiling so visible at distance?",
];

export default function BespokePath() {
  const [query, setQuery] = useState("");
  const [pathResult, setPathResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [pipelineStage, setPipelineStage] = useState("");
  const [inputError, setInputError] = useState("");

  // Quiz state
  const [quizzes, setQuizzes] = useState(new Map()); // stepIndex → questions[]
  const [quizLoading, setQuizLoading] = useState(null); // stepIndex currently loading
  const [quizScores, setQuizScores] = useState(new Map()); // stepIndex → {score, total}
  const [showQuiz, setShowQuiz] = useState(null); // stepIndex showing quiz

  // Audio briefing state
  const [briefingAudioUrl, setBriefingAudioUrl] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingStatus, setBriefingStatus] = useState("");
  const audioRef = useRef(null);

  const handleGenerate = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;

    // Security: validate + sanitize input
    const { valid, sanitized, error: sanitizeError } = sanitizeQuery(trimmed);
    if (!valid) {
      setInputError(sanitizeError);
      return;
    }
    setInputError("");

    // Security: rate limit check
    const { allowed, error: rateError } = checkRateLimit();
    if (!allowed) {
      setInputError(rateError);
      return;
    }

    recordQuery();
    setIsLoading(true);
    setPathResult(null);
    setCurrentStep(0);
    setQuizzes(new Map());
    setQuizScores(new Map());
    setShowQuiz(null);

    // 1. Check cache first (zero cost)
    setPipelineStage("Checking cache...");
    const cached = findCachedPath(trimmed);
    if (cached) {
      setPipelineStage("Found cached path!");
      setPathResult({ ...cached, fromCache: true });
      addToHistory(trimmed, cached);
      setIsLoading(false);
      setPipelineStage("");
      return;
    }

    // 2. Generate fresh path via AI pipeline
    setPipelineStage("Finding relevant content...");
    const result = await generateBespokePath(sanitized);

    if (!result.error && result.path.length > 0) {
      setPipelineStage("Path ready!");
      cachePath(trimmed, result);
      addToHistory(trimmed, result);
    }

    setPathResult(result);
    setIsLoading(false);
    setPipelineStage("");
  }, [query, isLoading]);

  // Generate quiz for a specific step (on-demand)
  const handleTakeQuiz = useCallback(
    async (stepIndex) => {
      if (quizzes.has(stepIndex) || !pathResult) {
        setShowQuiz(stepIndex);
        return;
      }
      setQuizLoading(stepIndex);
      const questions = await generateQuizForStep(pathResult.path[stepIndex], pathResult.query, 2);
      setQuizzes((prev) => new Map(prev).set(stepIndex, questions));
      setQuizLoading(null);
      setShowQuiz(stepIndex);
    },
    [quizzes, pathResult]
  );

  // Handle quiz completion for a step
  const handleQuizComplete = useCallback(({ stepIndex, score, total }) => {
    setQuizScores((prev) => new Map(prev).set(stepIndex, { score, total }));
    setShowQuiz(null);
  }, []);

  // Handle selecting a pre-seeded path (zero API cost)
  const handlePreSeededSelect = useCallback((path) => {
    // Convert pre-seeded format to the same shape as generateBespokePath output
    const fakeResult = {
      query: path.query,
      path: path.steps.map((step, i) => ({
        category: step.category,
        segment: {
          id: `${path.id}-step-${i}`,
          title: step.title,
          summary: step.summary,
          source: step.sourceType,
          text: step.summary,
        },
      })),
      bridges: path.steps.slice(1).map((_, i) => ({
        from: i,
        to: i + 1,
        text: "", // No bridge narration for pre-seeded
      })),
      segments: path.steps,
      generatedAt: new Date().toISOString(),
      isPreSeeded: true,
    };
    setPathResult(fakeResult);
    addToHistory(path.query, fakeResult);
    setQuery(path.query);
    setCurrentStep(0);
    setQuizzes(new Map());
    setQuizScores(new Map());
    setShowQuiz(null);
  }, []);

  const handleExampleClick = (example) => {
    setQuery(example);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="bespoke-path">
      {/* Query Input Section */}
      <div className="bespoke-hero">
        <h2 className="bespoke-title">
          <span className="bespoke-icon">🔧</span> Fix a Problem
        </h2>
        <p className="bespoke-subtitle">
          Describe your UE5 problem and get an AI-curated learning path with video clips, docs, and
          step-by-step guidance.
        </p>

        <div className="bespoke-input-area">
          <div className="bespoke-input-wrapper">
            <textarea
              className="bespoke-input"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (inputError) setInputError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="What UE5 problem are you trying to solve?"
              rows={2}
              maxLength={500}
              disabled={isLoading}
            />
            {/* Char counter */}
            {query.length > 400 && (
              <span
                className="char-counter"
                style={{ color: query.length >= 500 ? "#f85149" : "#8b949e" }}
              >
                {query.length}/500
              </span>
            )}
            <button
              className="bespoke-submit"
              onClick={handleGenerate}
              disabled={isLoading || !query.trim()}
            >
              {isLoading ? <span className="bespoke-spinner" /> : "🚀 Generate Path"}
            </button>
          </div>

          {/* Example queries */}
          {!pathResult && !isLoading && (
            <div className="bespoke-examples">
              <span className="examples-label">Try:</span>
              {EXAMPLE_QUERIES.map((ex, i) => (
                <button key={i} className="example-chip" onClick={() => handleExampleClick(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input error message */}
        {inputError && (
          <div className="bespoke-input-error">
            <span>⚠️</span> {inputError}
          </div>
        )}

        {/* Pre-seeded popular paths (shown before first search) */}
        {!pathResult && !isLoading && (
          <PreSeededPaths paths={PRE_SEEDED_PATHS} onSelect={handlePreSeededSelect} />
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bespoke-loading">
          <div className="pipeline-indicator">
            <div className="pipeline-dots">
              <span className="dot active" />
              <span className="dot" />
              <span className="dot" />
            </div>
            <p className="pipeline-stage">{pipelineStage}</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {pathResult?.error && (
        <div className="bespoke-error">
          <span className="error-icon">⚠️</span>
          <p>{pathResult.error}</p>
        </div>
      )}

      {/* Path Results */}
      {pathResult && !pathResult.error && pathResult.path.length > 0 && (
        <div className="bespoke-results">
          <PathProgress
            steps={pathResult.path}
            currentStep={currentStep}
            onStepClick={setCurrentStep}
          />

          {/* Audio Briefing - Top of path */}
          {!pathResult.isPreSeeded && (
            <div className="audio-briefing-section top-briefing">
              <h3>🎧 Audio Briefing</h3>
              {briefingAudioUrl ? (
                <div className="audio-player-wrapper">
                  <audio ref={audioRef} controls src={briefingAudioUrl} />
                </div>
              ) : (
                <>
                  <button
                    className="briefing-btn"
                    disabled={briefingLoading}
                    onClick={async () => {
                      setBriefingLoading(true);
                      setBriefingStatus("Generating script…");
                      try {
                        const app = getFirebaseApp();
                        const functions = getFunctions(app, "us-central1");
                        const genFn = httpsCallable(functions, "generateAudioBriefing");
                        setBriefingStatus("Synthesizing audio (this may take 30-60s)…");
                        const result = await genFn({
                          query: pathResult.query || query,
                          steps: pathResult.path.map((s) => ({
                            category: s.category,
                            summary: s.summary || s.segment?.title || "",
                            title: s.segment?.title || s.segment?.videoTitle || "",
                          })),
                        });
                        if (result.data?.audio) {
                          // Convert base64 WAV to blob URL
                          const binary = atob(result.data.audio);
                          const bytes = new Uint8Array(binary.length);
                          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                          const blob = new Blob([bytes], { type: "audio/wav" });
                          setBriefingAudioUrl(URL.createObjectURL(blob));
                          setBriefingStatus("");
                        } else {
                          setBriefingStatus("Error: No audio data returned");
                        }
                      } catch (err) {
                        console.error("Audio briefing error:", err);
                        setBriefingStatus(`Error: ${err.message}`);
                      } finally {
                        setBriefingLoading(false);
                      }
                    }}
                  >
                    {briefingLoading ? "⏳ Generating…" : "🎧 Listen to Briefing"}
                  </button>
                  {briefingStatus && <p className="briefing-status">{briefingStatus}</p>}
                </>
              )}
            </div>
          )}

          {/* Path Overview */}
          <div className="key-highlights">
            <h3>Your Learning Path</h3>
            <p className="highlights-query">For: <em>"{pathResult.query || query}"</em></p>
            <ul className="highlights-list">
              {pathResult.path.map((step, i) => (
                <li key={i} className="highlight-item" onClick={() => setCurrentStep(i)}>
                  <span className="highlight-number">{i + 1}</span>
                  <div className="highlight-content">
                    <strong className={`highlight-category cat-${step.category}`}>
                      {step.category}
                    </strong>
                    <p>{step.summary || step.segment?.title || "Review this step"}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="path-steps">
            {pathResult.path.map((step, i) => (
              <div key={step.segment.id || i}>
                {/* Bridge narration between steps */}
                {i > 0 && (
                  <BridgeNarration
                    bridge={pathResult.bridges.find((b) => b.from === i - 1 && b.to === i)}
                    fromCategory={pathResult.path[i - 1].category}
                    toCategory={step.category}
                  />
                )}

                <PathStep
                  step={step}
                  index={i}
                  isActive={i === currentStep}
                  onClick={() => setCurrentStep(i)}
                />

                {/* Quiz button or quiz component */}
                {i === currentStep && (
                  <div className="step-quiz-area">
                    {showQuiz === i && quizzes.has(i) ? (
                      <QuizEngine
                        questions={quizzes.get(i)}
                        stepIndex={i}
                        onComplete={handleQuizComplete}
                      />
                    ) : quizScores.has(i) ? (
                      <div className="quiz-score-badge">
                        ✅ Quiz: {quizScores.get(i).score}/{quizScores.get(i).total}
                      </div>
                    ) : (
                      <button
                        className="take-quiz-btn"
                        onClick={() => handleTakeQuiz(i)}
                        disabled={quizLoading === i}
                      >
                        {quizLoading === i ? "Generating quiz..." : "📝 Take Quiz on This Step"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Final Score Summary */}
          {quizScores.size > 0 && (
            <div className="bespoke-score-summary">
              <span className="score-icon">🏆</span>
              <span>
                Path Score:{" "}
                <strong>
                  {[...quizScores.values()].reduce((s, q) => s + q.score, 0)}/
                  {[...quizScores.values()].reduce((s, q) => s + q.total, 0)}
                </strong>{" "}
                across {quizScores.size} quizzes
              </span>
            </div>
          )}

          {/* Meta info */}
          <div className="bespoke-meta">
            <span>
              {pathResult.path.length} steps • {pathResult.segments.length} sources searched •{" "}
              Generated {new Date(pathResult.generatedAt).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
