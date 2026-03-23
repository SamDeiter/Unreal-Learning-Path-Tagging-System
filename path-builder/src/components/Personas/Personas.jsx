import React, { useState } from "react";
import GuidedPlayer from "../GuidedPlayer/GuidedPlayer";
import CartPanel from "../CartPanel/CartPanel";
import "../ProblemFirst/ProblemFirst.css";
import { useVideoCart } from "../../hooks/useVideoCart";
import {
  Rocket,
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  Loader,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import "./Personas.css";

// Extracted modules
import { QUESTIONS } from "./onboardingQuestions";
import {
  OnboardingDocsSection,
  OnboardingYouTubeSection,
  OnboardingVideosByRole,
} from "./OnboardingContent";
import useOnboardingPath from "./useOnboardingPath";

/**
 * Onboarding Path Builder - Help new learners get over the 5-10hr hump
 */
export default function Personas() {
  const [step, setStep] = useState(0); // Quiz step
  const [answers, setAnswers] = useState({
    startPrompt: "",
    role: null,
    experience: null,
    goal: null,
  });

  // Path generation hook (RAG + local fallback)
  const {
    detectedPersona,
    generatedPath,
    blendedPath,
    isRAGLoading,
    ragState,
    ragError,
    RAG_STATES,
    handleGeneratePath,
    reset: resetPathState,
  } = useOnboardingPath(answers);

  // Track which course (if any) is being watched in GuidedPlayer
  const [watchingCourse, setWatchingCourse] = useState(null);
  const { cart, addToCart, removeFromCart, clearCart, isInCart } = useVideoCart();

  const handleAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    // Auto-advance for choice questions
    if (QUESTIONS[step].type === "choice" && step < QUESTIONS.length - 1) {
      setStep((prev) => prev + 1);
    }
  };

  const handlePromptSubmit = () => {
    // Advance past free-text step
    if (step < QUESTIONS.length - 1) {
      setStep((prev) => prev + 1);
    }
  };

  const resetQuiz = () => {
    setStep(0);
    setAnswers({ startPrompt: "", role: null, experience: null, goal: null });
    setWatchingCourse(null);
    clearCart();
    resetPathState();
    localStorage.removeItem("detected_persona");
  };

  const switchPersona = () => {
    // Return to role selection (step 1), keep startPrompt
    setStep(1);
    setAnswers((prev) => ({ ...prev, role: null, experience: null, goal: null }));
    setWatchingCourse(null);
    resetPathState();
    localStorage.removeItem("detected_persona");
  };

  // Check if all required questions answered
  const allAnswered = answers.role && answers.experience && answers.goal;

  // Current question
  const currentQ = QUESTIONS[step];

  return (
    <div className="personas-page">
      <header className="personas-header">
        <h1>
          <Rocket size={24} className="icon-inline" /> New to UE5? Let's Get You Started
        </h1>
        <p className="personas-subtitle">
          Answer a few quick questions and we'll create your personalized first 10-hour learning
          path
        </p>
      </header>

      {isRAGLoading ? (
        /* RAG Pipeline Loading State */
        <section className="quiz-section rag-loading">
          <div className="rag-loader">
            <Loader size={40} className="spin-icon" />
            <h2>
              {ragState === RAG_STATES.PLANNING && "Analyzing your profile..."}
              {ragState === RAG_STATES.SEARCHING && "Searching course library..."}
              {ragState === RAG_STATES.ASSEMBLING && "Building your curriculum..."}
            </h2>
            <p className="rag-loader-sub">
              {ragState === RAG_STATES.PLANNING && "Our AI is understanding your learning goals"}
              {ragState === RAG_STATES.SEARCHING && "Finding the most relevant video segments"}
              {ragState === RAG_STATES.ASSEMBLING && "Crafting a personalized learning path"}
            </p>
            <div className="rag-progress-bar">
              <div
                className="rag-progress-fill"
                style={{
                  width:
                    ragState === RAG_STATES.PLANNING
                      ? "33%"
                      : ragState === RAG_STATES.SEARCHING
                        ? "66%"
                        : "90%",
                }}
              />
            </div>
          </div>
        </section>
      ) : !generatedPath ? (
        <>
          {/* Progress indicator */}
          <div className="quiz-progress">
            {QUESTIONS.map((q, i) => (
              <div
                key={q.id}
                className={`progress-step ${i <= step ? "active" : ""} ${
                  q.type === "freetext"
                    ? answers[q.id]
                      ? "completed"
                      : i < step
                        ? "completed"
                        : ""
                    : answers[q.id]
                      ? "completed"
                      : ""
                }`}
              >
                {(q.type === "freetext" ? i < step : answers[q.id]) ? <Check size={16} /> : i + 1}
              </div>
            ))}
          </div>

          {/* RAG error banner */}
          {ragError && (
            <div className="rag-error-banner">
              ⚠️ AI personalization unavailable — using local recommendations instead.
            </div>
          )}

          {/* Current question */}
          <section className="quiz-section">
            <h2>{currentQ.question}</h2>
            {currentQ.subtitle && <p className="quiz-subtitle">{currentQ.subtitle}</p>}

            {currentQ.type === "freetext" ? (
              /* Free-text input */
              <div className="freetext-input">
                <div className="freetext-wrapper">
                  <MessageSquare size={18} className="freetext-icon" />
                  <textarea
                    value={answers.startPrompt}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, startPrompt: e.target.value }))
                    }
                    placeholder={currentQ.placeholder}
                    rows={3}
                    className="freetext-textarea"
                  />
                </div>
                <button className="freetext-next" onClick={handlePromptSubmit}>
                  {answers.startPrompt ? "Next" : "Skip"} <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              /* Choice options */
              <div className="quiz-options">
                {currentQ.options.map((option) => {
                  const Icon = option.icon || Sparkles;
                  return (
                    <button
                      key={option.value}
                      className={`quiz-option ${answers[currentQ.id] === option.value ? "selected" : ""}`}
                      onClick={() => handleAnswer(currentQ.id, option.value)}
                    >
                      <span className="option-icon-wrapper">
                        <Icon size={18} />
                      </span>
                      <span className="option-content">
                        <span className="option-label">{option.label}</span>
                        {option.description && (
                          <span className="option-description">{option.description}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Navigation */}
            <div className="quiz-nav">
              {step > 0 && (
                <button className="quiz-back" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft size={16} /> Back
                </button>
              )}
              {allAnswered && (
                <button
                  className="quiz-generate"
                  onClick={handleGeneratePath}
                  disabled={isRAGLoading}
                >
                  Generate My Path <ArrowRight size={16} />
                </button>
              )}
            </div>
          </section>

          {/* Persona preview */}
          {detectedPersona && (
            <div className="persona-preview">
              <span className="preview-icon">
                {detectedPersona.emoji ? (
                  <span style={{ fontSize: "32px" }}>{detectedPersona.emoji}</span>
                ) : (
                  <Sparkles size={32} />
                )}
              </span>
              <div className="preview-text">
                <strong>{detectedPersona.name}</strong>
                <p>{detectedPersona.description}</p>
              </div>
            </div>
          )}
        </>
      ) : watchingCourse ? (
        /* GuidedPlayer — break out of the 900px container */
        <div className="guided-player-breakout">
          <GuidedPlayer
            courses={(() => {
              // Sort videos within each course by part number (same fix as Fix a Problem)
              const sortVideos = (course) => {
                if (!course?.videos?.length) return course;
                const sorted = [...course.videos].sort((a, b) => {
                  const getNum = (v) => {
                    const m = (v.title || v.name || "").match(/part\s*(\d+)/i);
                    return m ? parseInt(m[1], 10) : 999;
                  };
                  return getNum(a) - getNum(b);
                });
                return { ...course, videos: sorted };
              };

              const raw =
                cart.length > 0
                  ? cart.map((c) => {
                      const full = generatedPath?.courses?.find(
                        (gc) => gc.code === c.code || gc.title === c.title
                      );
                      return full || c;
                    })
                  : [watchingCourse];
              return raw.map(sortVideos);
            })()}
            problemSummary={`New to UE5 — ${detectedPersona?.name || "General"}, ${QUESTIONS[2].options.find((o) => o.value === answers.experience)?.label || ""}, wants to ${QUESTIONS[3].options.find((o) => o.value === answers.goal)?.label || "explore"}`}
            pathSummary={{
              path_summary: `A personalized learning path for ${generatedPath.persona.name}. This path covers foundational UE5 skills tailored to your background, starting with the essentials and building toward hands-on projects.`,
              topics_covered: generatedPath.courses.map((c) => c.title || c.name),
            }}
            onComplete={() => setWatchingCourse(null)}
            onExit={() => setWatchingCourse(null)}
          />
        </div>
      ) : (
        <>
          {/* Shopping layout — cart at top right, content on left */}
          <div className="shopping-layout">
            <div className="results-column">
              {/* Path header — no card wrapper, just content */}
              <div className="path-header">
                <span className="path-icon">
                  <Rocket size={40} />
                </span>
                <div>
                  <h2>Your Personalized Learning Path</h2>
                  <p>
                    Optimized for {generatedPath.persona.name} — pick the courses you want to watch
                  </p>
                </div>
                <div className="path-actions">
                  <button className="switch-persona-btn" onClick={switchPersona}>
                    <RefreshCw size={14} /> Switch Persona
                  </button>
                  <button className="reset-btn" onClick={resetQuiz}>
                    <RefreshCw size={16} /> Start Over
                  </button>
                </div>
              </div>

              {/* Persona card — own visual card */}
              {detectedPersona && (
                <div className="persona-result-card">
                  <div className="persona-result-header">
                    {detectedPersona.emoji && (
                      <span className="persona-emoji">{detectedPersona.emoji}</span>
                    )}
                    <div>
                      <h3>{detectedPersona.name}</h3>
                      <p>{detectedPersona.description}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Motivation chips */}
              <div className="motivation-messages">
                {generatedPath.messaging.map((msg, i) => (
                  <div key={i} className="motivation-card">
                    {msg}
                  </div>
                ))}
              </div>

              {/* Video sections grouped by role */}
              <OnboardingVideosByRole
                courses={generatedPath.courses}
                isInCart={isInCart}
                addToCart={addToCart}
                removeFromCart={removeFromCart}
                userQuery={answers.startPrompt || ""}
                experience={answers.experience}
                persona={detectedPersona}
              />

              {blendedPath?.docs?.length > 0 && (
                <OnboardingDocsSection
                  docs={blendedPath.docs}
                  isInCart={isInCart}
                  addToCart={addToCart}
                  removeFromCart={removeFromCart}
                  persona={detectedPersona}
                />
              )}
              {blendedPath?.youtube?.length > 0 && (
                <OnboardingYouTubeSection
                  youtube={blendedPath.youtube}
                  isInCart={isInCart}
                  addToCart={addToCart}
                  removeFromCart={removeFromCart}
                />
              )}

              <div className="path-summary">
                <p>
                  Total time:{" "}
                  <strong>{Math.round((generatedPath.totalTime / 60) * 10) / 10} hours</strong>
                </p>
              </div>
            </div>

            {/* Cart sidebar — separate column, starts at top right */}
            <div className="cart-column">
              <CartPanel
                cart={cart}
                onRemove={removeFromCart}
                onClear={clearCart}
                onWatchPath={() => {
                  if (cart.length > 0) setWatchingCourse(cart[0]);
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
