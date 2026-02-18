/**
 * ProblemFirst - Main page component for Problem-First Learning
 * Orchestrates: Input → Video Shopping Cart → GuidedPlayer
 *
 * Business logic extracted to:
 *   hooks/useProblemFirst.js — state management + handleSubmit pipeline
 *   domain/courseMatching.js — course matching pipeline
 *   domain/videoRanking.js  — video flattening + persona weighting
 *   domain/buildGuidedCourses.js — cart → GuidedPlayer course array
 */
import React from "react";
import ProblemInput from "./ProblemInput";
import CaseReportForm from "../FixProblem/CaseReportForm";
import ClarifyStep from "../FixProblem/ClarifyStep";
import AnswerView from "../FixProblem/AnswerView";
import GuidedPlayer from "../GuidedPlayer/GuidedPlayer";
import CartPanel from "../CartPanel/CartPanel";
import VideoResultCard from "../VideoResultCard/VideoResultCard";
import useProblemFirst, { STAGES } from "../../hooks/useProblemFirst";
import { buildGuidedCourses } from "../../domain/buildGuidedCourses";
import "./ProblemFirst.css";

export default function ProblemFirst() {
  const {
    stage,
    diagnosisData,
    error,
    blendedPath,
    videoResults,
    answerData,
    clarifyData,
    isRerunning,
    courses,
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    isInCart,
    handleSubmit,
    handleReset,
    handleAskAgain,
    handleClarifyAnswer,
    handleClarifySkip,
    handleFeedback,
    handleBackToVideos,
    handleVideoToggle,
    handleWatchPath,
    setCaseReport,
    getDetectedPersona,
  } = useProblemFirst();

  return (
    <div className="problem-first-page">
      <header className="page-header">
        <h1>🔧 Fix a Problem</h1>
        <p>Describe your issue. We&apos;ll diagnose it and show you how to fix it.</p>
      </header>

      {(stage === STAGES.INPUT || stage === STAGES.LOADING) && (
        <>
          <ProblemInput
            onSubmit={handleSubmit}
            detectedPersona={getDetectedPersona()}
            isLoading={stage === STAGES.LOADING}
          />
          <CaseReportForm onUpdate={setCaseReport} disabled={stage === STAGES.LOADING} />
        </>
      )}

      {stage === STAGES.CLARIFYING && clarifyData && (
        <ClarifyStep
          question={clarifyData.question}
          options={clarifyData.options}
          whyAsking={clarifyData.whyAsking}
          onAnswer={handleClarifyAnswer}
          onSkip={handleClarifySkip}
          isLoading={false}
        />
      )}

      {stage === STAGES.ANSWERED && answerData && (
        <AnswerView
          answer={answerData}
          onFeedback={handleFeedback}
          onBackToVideos={handleBackToVideos}
          onStartOver={handleReset}
          isRerunning={isRerunning}
        />
      )}

      {stage === STAGES.ERROR && (
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>Something went wrong</h3>
          <p>{error}</p>
          <button className="retry-btn" onClick={handleReset}>
            Try Again
          </button>
        </div>
      )}

      {stage === STAGES.DIAGNOSIS && diagnosisData && (
        <div className="shopping-layout">
          <div className="results-column">
            <div className="tldr-diagnosis">
              <div className="tldr-user-query">
                <span className="tldr-query-label">🔍 You asked:</span>
                <p className="tldr-query-text">{diagnosisData.userQuery}</p>
              </div>
              {diagnosisData._localFallback && (
                <div
                  className="tldr-fallback-notice"
                  style={{
                    background: "rgba(255, 193, 7, 0.1)",
                    border: "1px solid rgba(255, 193, 7, 0.3)",
                    borderRadius: "8px",
                    padding: "8px 14px",
                    margin: "8px 0",
                    fontSize: "0.85rem",
                    color: "var(--text-muted, #aaa)",
                  }}
                >
                  ⚡ <strong>Fast results</strong> — AI diagnosis temporarily unavailable. Videos
                  matched by tag taxonomy. Try again in a moment for AI-powered results.
                </div>
              )}
              {diagnosisData.diagnosis?.problem_summary && (
                <p className="tldr-bridge">
                  Based on your question, we think these videos will help you:
                </p>
              )}
            </div>

            {/* 🎬 Videos for You — Grouped by Role */}
            <h2 className="results-title">🎬 Videos for You ({videoResults.length})</h2>

            {videoResults.length === 0 && (
              <div className="no-results">
                <p>No matching videos found. Try rephrasing your question.</p>
              </div>
            )}

            <VideosByRole
              videoResults={videoResults}
              isInCart={isInCart}
              handleVideoToggle={handleVideoToggle}
              userQuery={diagnosisData?.userQuery || ""}
            />

            {/* 📚 Recommended Reading — Official Epic Docs */}
            {blendedPath?.docs?.length > 0 && (
              <DocsSection
                docs={blendedPath.docs}
                isInCart={isInCart}
                addToCart={addToCart}
                removeFromCart={removeFromCart}
              />
            )}

            {/* 📺 Official Epic YouTube */}
            {blendedPath?.youtube?.length > 0 && (
              <YouTubeSection
                youtube={blendedPath.youtube}
                isInCart={isInCart}
                addToCart={addToCart}
                removeFromCart={removeFromCart}
              />
            )}

            {/* Bottom actions */}
            <div className="results-actions-bottom">
              <button className="back-btn" onClick={handleReset}>
                ← Start Over
              </button>
              <button className="ask-again-btn" onClick={handleAskAgain}>
                + Ask Another Question
              </button>
            </div>
          </div>

          <div className="cart-column">
            <CartPanel
              cart={cart}
              onRemove={removeFromCart}
              onClear={clearCart}
              onWatchPath={handleWatchPath}
            />
          </div>
        </div>
      )}

      {stage === STAGES.GUIDED && (
        <GuidedPlayer
          courses={buildGuidedCourses(cart, courses, diagnosisData?.microLesson?.quick_fix?.steps)}
          diagnosis={diagnosisData?.diagnosis}
          problemSummary={diagnosisData?.diagnosis?.problem_summary}
          pathSummary={diagnosisData?.pathSummary}
          microLesson={diagnosisData?.microLesson}
          onComplete={() => {
            // Path complete — stay on the guided player, don't auto-redirect
          }}
          onExit={() => handleBackToVideos()}
        />
      )}
    </div>
  );
}

// ──────────── Sub-components (inline, keeps JSX organized) ────────────

const ROLE_SECTIONS = [
  {
    key: "prerequisite",
    icon: "🔗",
    label: "Prerequisite",
    desc: "Build the foundation first — these cover concepts you'll need before tackling the main topic.",
  },
  {
    key: "core",
    icon: "⭐",
    label: "Core",
    desc: "These directly address your question and are the most important videos to watch.",
  },
  {
    key: "troubleshooting",
    icon: "🔧",
    label: "Troubleshooting",
    desc: "Debugging helpers — watch these if you're hitting errors or unexpected behavior.",
  },
  {
    key: "supplemental",
    icon: "📚",
    label: "Supplemental",
    desc: "Go deeper — extra context and advanced techniques for when you're ready.",
  },
];

function VideosByRole({ videoResults, isInCart, handleVideoToggle, userQuery }) {
  const grouped = {};
  for (const section of ROLE_SECTIONS) grouped[section.key] = [];
  grouped._other = [];

  for (const video of videoResults) {
    const role = video.role || "_other";
    (grouped[role] || grouped._other).push(video);
  }

  return (
    <>
      {ROLE_SECTIONS.filter((s) => grouped[s.key].length > 0).map((section) => (
        <div key={section.key} className="role-section">
          <div className="role-section-header">
            <h3 className="role-section-title">
              {section.icon} {section.label}
              <span className="role-section-count">{grouped[section.key].length}</span>
            </h3>
            <p className="role-section-desc">{section.desc}</p>
          </div>
          <div className="video-results-grid">
            {grouped[section.key].map((video) => (
              <div
                key={video.driveId}
                className="video-result-wrapper"
                id={`video-${video.driveId}`}
              >
                <VideoResultCard
                  video={video}
                  isAdded={isInCart(video.driveId)}
                  onToggle={handleVideoToggle}
                  userQuery={userQuery}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      {grouped._other.length > 0 && (
        <div className="role-section">
          <div className="role-section-header">
            <h3 className="role-section-title">
              📎 Related <span className="role-section-count">{grouped._other.length}</span>
            </h3>
            <p className="role-section-desc">
              Additional videos that may be relevant to your query.
            </p>
          </div>
          <div className="video-results-grid">
            {grouped._other.map((video) => (
              <div
                key={video.driveId}
                className="video-result-wrapper"
                id={`video-${video.driveId}`}
              >
                <VideoResultCard
                  video={video}
                  isAdded={isInCart(video.driveId)}
                  onToggle={handleVideoToggle}
                  userQuery={userQuery}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function DocsSection({ docs, isInCart, addToCart, removeFromCart }) {
  return (
    <div className="blended-section">
      <div className="blended-section-header">
        <h2 className="blended-section-title">📚 Recommended Reading</h2>
        <p className="blended-section-desc">
          Official Unreal Engine documentation to deepen your understanding.
          {docs.reduce((sum, d) => sum + (d.readTimeMinutes || 10), 0) > 0 &&
            ` (~${docs.reduce((sum, d) => sum + (d.readTimeMinutes || 10), 0)} min total read time)`}
        </p>
      </div>
      <div className="doc-cards-grid">
        {docs.map((d, i) => {
          const docId = `doc_${d.key || i}`;
          const inCart = isInCart(docId);
          return (
            <div key={d.key || i} className={`doc-card ${inCart ? "doc-card-added" : ""}`}>
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="doc-card-link"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="doc-card-header">
                  {d.matchScore != null && <DocMatchBadge matchScore={d.matchScore} />}
                  <span className={`tier-badge tier-${d.tier || "intermediate"}`}>
                    {d.tier || "intermediate"}
                  </span>
                  {d.subsystem && <span className="subsystem-tag">{d.subsystem}</span>}
                </div>
                <h4 className="doc-card-title">{d.label}</h4>
                {d.description && <p className="doc-card-desc">{d.description}</p>}
                <div className="doc-card-footer">
                  <span className="doc-source-badge">📄 Epic Docs</span>
                  <span className="doc-read-time">{d.readTimeMinutes || 10} min read</span>
                </div>
              </a>
              <button
                className={`doc-add-btn ${inCart ? "doc-added" : ""}`}
                onClick={() => {
                  if (inCart) {
                    removeFromCart(docId);
                  } else {
                    addToCart({
                      type: "doc",
                      itemId: docId,
                      title: d.label,
                      description: d.description || "",
                      keySteps: d.keySteps || [],
                      seeAlso: d.seeAlso || [],
                      sections: d.sections || [],
                      url: d.url,
                      tier: d.tier || "intermediate",
                      subsystem: d.subsystem,
                      readTimeMinutes: d.readTimeMinutes || 10,
                    });
                  }
                }}
                title={inCart ? "Remove from path" : "Add to learning path"}
              >
                {inCart ? "✓ Added" : "➕ Add"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DocMatchBadge({ matchScore }) {
  const tier =
    matchScore >= 90 ? "best" : matchScore >= 60 ? "strong" : matchScore >= 30 ? "good" : "related";
  const label =
    matchScore >= 90
      ? "Best Match"
      : matchScore >= 60
        ? "Strong"
        : matchScore >= 30
          ? "Good"
          : "Related";
  return (
    <span className={`doc-match-badge doc-match-${tier}`} title={`${matchScore}% relevancy`}>
      <span className="doc-match-dot" />
      {label}
    </span>
  );
}

function YouTubeSection({ youtube, isInCart, addToCart, removeFromCart }) {
  return (
    <div className="blended-section">
      <div className="blended-section-header">
        <h2 className="blended-section-title">📺 Official Epic YouTube</h2>
        <p className="blended-section-desc">Official Unreal Engine tutorials from Epic Games.</p>
      </div>
      <div className="doc-cards-grid">
        {youtube.map((yt) => {
          const ytId = yt.id || `yt_${yt.url}`;
          const inCart = isInCart(ytId);
          const vidMatch = yt.url?.match(/[?&]v=([^&]+)/);
          const vidId = vidMatch ? vidMatch[1] : null;
          return (
            <div
              key={yt.id}
              className={`doc-card yt-card-with-thumb ${inCart ? "doc-card-added" : ""}`}
            >
              <a
                href={yt.url}
                target="_blank"
                rel="noopener noreferrer"
                className="doc-card-link"
                onClick={(e) => e.stopPropagation()}
              >
                {vidId && (
                  <div className="yt-thumb-wrapper">
                    <img
                      className="yt-thumb-img"
                      src={`https://img.youtube.com/vi/${vidId}/mqdefault.jpg`}
                      alt={yt.title}
                      loading="lazy"
                    />
                    <span className="yt-thumb-duration">{yt.durationMinutes} min</span>
                    <span className="yt-thumb-play">▶</span>
                  </div>
                )}
                <div className="doc-card-header">
                  <span className={`tier-badge tier-${yt.tier || "intermediate"}`}>
                    {yt.tier || "intermediate"}
                  </span>
                  <span className="external-badge">Official • YouTube</span>
                </div>
                <h4 className="doc-card-title">{yt.title}</h4>
                <div className="doc-card-footer">
                  <span className="doc-source-badge">📺 {yt.channelName}</span>
                  <span className="doc-read-time">{yt.durationMinutes} min</span>
                </div>
              </a>
              <button
                className={`doc-add-btn ${inCart ? "doc-added" : ""}`}
                onClick={() => {
                  if (inCart) {
                    removeFromCart(ytId);
                  } else {
                    addToCart({
                      type: "youtube",
                      itemId: ytId,
                      title: yt.title,
                      description: yt.description || "",
                      keyTakeaways: yt.keyTakeaways || [],
                      chapters: yt.chapters || [],
                      topics: yt.topics || [],
                      url: yt.url,
                      channelName: yt.channelName,
                      channelTrust: yt.channelTrust,
                      tier: yt.tier || "intermediate",
                      durationMinutes: yt.durationMinutes || 15,
                    });
                  }
                }}
                title={inCart ? "Remove from path" : "Add to learning path"}
              >
                {inCart ? "✓ Added" : "➕ Add"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
