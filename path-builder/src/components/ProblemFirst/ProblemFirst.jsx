/**
 * ProblemFirst — thin shell for the scrolling chat-thread experience.
 *
 * The heavy lifting (pipeline calls, clarification loop, caching) lives in
 * useProblemFirst. This component:
 *   - Renders the initial rich ProblemInput (first turn only)
 *   - Renders <ChatThread /> once conversation has begun
 *   - Renders the pinned <ChatInput /> for subsequent turns
 *   - Punches out to <GuidedPlayer /> when the user commits a path
 *
 * Rich diagnosis / answer bubbles are rendered inline via the renderRich
 * prop so the results stay inside the thread instead of replacing it.
 */
import React, { useState, useCallback, Component } from "react";
import ProblemInput from "./ProblemInput";
import CaseReportForm from "../FixProblem/CaseReportForm";
import AnswerView from "../FixProblem/AnswerView";
import GuidedPlayer from "../GuidedPlayer/GuidedPlayer";
import CartPanel from "../CartPanel/CartPanel";
import VideoResultCard from "../VideoResultCard/VideoResultCard";
import OfficialDocsSummary from "../OfficialDocsSummary/OfficialDocsSummary";
import ChatThread from "../chat/ChatThread";
import ChatInput from "../chat/ChatInput";
import ResumeSessionList from "../sessions/ResumeSessionList";
import useProblemFirst, { STAGES } from "../../hooks/useProblemFirst";
import { ExternalLink, FileText, Presentation, BookOpen } from "lucide-react";
import { buildGuidedCourses } from "../../domain/buildGuidedCourses";
import "./ProblemFirst.css";

class DiagnosisErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("[DiagnosisErrorBoundary]", error, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="problem-first-error" style={{ padding: "40px 20px", textAlign: "center" }}>
          <h3>⚠️ Something went wrong loading the results</h3>
          <p style={{ color: "var(--text-muted, #94a3b8)", marginTop: 8 }}>
            {this.state.error?.message || "Unknown error"}
          </p>
          <button
            className="back-btn"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              this.props.onReset?.();
            }}
            style={{ marginTop: 16 }}
          >
            ← Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ProblemFirst() {
  const {
    stage,
    diagnosisData,
    blendedPath,
    videoResults,
    answerData,
    isRerunning,
    courses,
    vertexAIDocs,
    vertexAILoading,
    vertexAIError,
    epicResults,
    messages,
    sessionId,
    setMessages,
    setSessionId,
    setConversationHistory,
    isAssistantTyping,
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    isInCart,
    handleSubmit,
    handleReset,
    handleClarifyAnswer,
    handleClarifySkip,
    handleFeedback,
    handleBackToVideos,
    handleVideoToggle,
    handleWatchPath,
    setCaseReport,
    getDetectedPersona,
  } = useProblemFirst();

  const [lastSubmittedInput, setLastSubmittedInput] = useState(null);
  const [resumedSessionId, setResumedSessionId] = useState(null);

  const wrappedSubmit = useCallback(
    (inputData) => {
      // A fresh submit from the rich input means a brand new thread —
      // drop any prior-session memory so we don't leak stale context.
      setResumedSessionId(null);
      const enriched = { ...inputData, socratic: true };
      setLastSubmittedInput(enriched);
      return handleSubmit(enriched);
    },
    [handleSubmit]
  );

  const handleChatSend = useCallback(
    (text) => {
      const base = lastSubmittedInput || { engine: "UE5", detectedTagIds: [] };
      const payload = {
        ...base,
        query: text,
        pastedImage: null,
        errorLog: null,
        cachedCartId: null,
        _conversationHistory: undefined,
        priorSessionId: resumedSessionId || undefined,
        socratic: true,
      };
      setLastSubmittedInput(payload);
      handleSubmit(payload);
    },
    [handleSubmit, lastSubmittedInput, resumedSessionId]
  );

  const wrappedReset = useCallback(() => {
    setResumedSessionId(null);
    setLastSubmittedInput(null);
    handleReset();
  }, [handleReset]);

  // ── Resume hydration ──
  // Rebuild a chat thread from a persisted session's conversationHistory + result.
  // Bubbles are slightly less rich than live (no cart/video state round-trip) — a
  // follow-up turn will re-derive full context from the backend.
  const handleResumeSession = useCallback(
    (session) => {
      if (!session?.id) return;
      let counter = 0;
      const mkId = () => `r_${session.id}_${++counter}`;
      const now = Date.now();
      const hydrated = [];

      const history = Array.isArray(session.conversationHistory) ? session.conversationHistory : [];
      for (const turn of history) {
        if (!turn || !turn.content) continue;
        const role = turn.role === "assistant" ? "assistant" : "user";
        hydrated.push({
          id: mkId(),
          role,
          kind: "text",
          content: String(turn.content),
          createdAt: now,
        });
      }

      const result = session.result || null;
      if (result) {
        const hasAnswerData = !!(result.mostLikelyCause || result.fixSteps?.length);
        if (hasAnswerData) {
          hydrated.push({
            id: mkId(),
            role: "assistant",
            kind: "path",
            createdAt: now,
            content: {
              answerData: {
                mostLikelyCause: result.mostLikelyCause,
                confidence: result.confidence,
                fastChecks: result.fastChecks || [],
                fixSteps: result.fixSteps || [],
                ifStillBrokenBranches: result.ifStillBrokenBranches || [],
                whyThisResult: result.whyThisResult || [],
                evidence: result.evidence || [],
                learnPath: result.learnPath,
              },
              cartData: result.cart || null,
              videoResults: result.videoResults || [],
              blendedPath: result.blendedPath || null,
              epicResults: result.epicResults || [],
              vertexAIDocs: result.vertexAIDocs || null,
            },
          });
        } else if (result.cart || result.videoResults) {
          hydrated.push({
            id: mkId(),
            role: "assistant",
            kind: "diagnosis",
            createdAt: now,
            content: {
              cartData: result.cart || null,
              videoResults: result.videoResults || [],
              blendedPath: result.blendedPath || null,
              epicResults: result.epicResults || [],
              vertexAIDocs: result.vertexAIDocs || null,
            },
          });
        } else {
          hydrated.push({
            id: mkId(),
            role: "assistant",
            kind: "text",
            createdAt: now,
            content: "(Previous response restored — send a follow-up to refresh full details.)",
          });
        }
      }

      setSessionId(session.id);
      setConversationHistory(history);
      setMessages(hydrated);
      setResumedSessionId(session.id);
      setLastSubmittedInput({
        query: session.query || "",
        detectedTagIds: [],
        engine: "UE5",
        priorSessionId: session.id,
      });
    },
    [setSessionId, setMessages, setConversationHistory]
  );

  // ── GUIDED stage: full-screen learning player — unchanged ──
  if (stage === STAGES.GUIDED) {
    return (
      <div className="problem-first-page">
        <GuidedPlayer
          courses={buildGuidedCourses(cart, courses, diagnosisData?.microLesson?.quick_fix?.steps)}
          diagnosis={diagnosisData?.diagnosis}
          problemSummary={diagnosisData?.diagnosis?.problem_summary}
          pathSummary={diagnosisData?.pathSummary}
          microLesson={diagnosisData?.microLesson}
          fixRecipe={
            answerData
              ? {
                  mostLikelyCause: answerData.mostLikelyCause,
                  fixSteps: answerData.fixSteps || [],
                  fastChecks: answerData.fastChecks || [],
                }
              : null
          }
          onComplete={() => {}}
          onExit={() => handleBackToVideos()}
        />
      </div>
    );
  }

  // Rich renderer for 'diagnosis' / 'path' bubbles — embeds the existing
  // shopping-layout cards + answer view inside the thread.
  const renderRich = (message) => {
    const { kind, content } = message;
    if (kind === "path" && content.answerData) {
      return (
        <AnswerView
          answer={content.answerData}
          onFeedback={handleFeedback}
          onBackToVideos={handleBackToVideos}
          onStartOver={wrappedReset}
          isRerunning={isRerunning}
          vertexAIDocs={content.vertexAIDocs || vertexAIDocs}
          vertexAILoading={vertexAILoading}
          vertexAIError={vertexAIError}
        />
      );
    }

    // kind === 'diagnosis' (also fall-through for 'path' without answerData)
    const cart$ = content.cartData || diagnosisData;
    const videos = content.videoResults || videoResults;
    const bp = content.blendedPath || blendedPath;
    const epic = content.epicResults || epicResults;
    const vaDocs = content.vertexAIDocs || vertexAIDocs;

    const isFallback = !!cart$?._localFallback;
    const summary = cart$?.diagnosis?.problem_summary;
    const likelyCause = cart$?.diagnosis?.likely_cause || cart$?.diagnosis?.most_likely_cause;
    const fastChecks = cart$?.diagnosis?.fast_checks || [];
    const resourceCount =
      (videos?.length || 0) +
      (bp?.docs?.length || 0) +
      (bp?.youtube?.length || 0) +
      (epic?.length || 0);

    return (
      <DiagnosisErrorBoundary onReset={wrappedReset}>
        <div className="tutor-response">
          {isFallback && !summary && (
            <p style={{ margin: "0 0 10px", color: "#e5e7eb" }}>
              I couldn&apos;t run the AI diagnosis right now, so I pulled the closest matches from
              the tag taxonomy. Take a look below and tell me which one feels closest to your
              issue — I&apos;ll narrow it down from there.
            </p>
          )}

          {summary && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ margin: 0, color: "#e5e7eb", lineHeight: 1.55 }}>{summary}</p>
            </div>
          )}

          {likelyCause && (
            <div
              style={{
                marginBottom: 12,
                padding: "10px 14px",
                background: "rgba(139,92,246,0.08)",
                border: "1px solid rgba(139,92,246,0.25)",
                borderRadius: 8,
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "#a78bfa", marginBottom: 4, fontWeight: 600 }}>
                Most likely cause
              </div>
              <div style={{ color: "#e5e7eb", lineHeight: 1.5 }}>{likelyCause}</div>
            </div>
          )}

          {fastChecks.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "0.85rem", color: "#cbd5e1", marginBottom: 6, fontWeight: 600 }}>
                Try these first:
              </div>
              <ol style={{ margin: 0, paddingLeft: 20, color: "#e5e7eb", lineHeight: 1.6 }}>
                {fastChecks.slice(0, 5).map((c, i) => (
                  <li key={i}>{typeof c === "string" ? c : c.check || c.step || ""}</li>
                ))}
              </ol>
            </div>
          )}

          {(summary || likelyCause) && (
            <button
              type="button"
              onClick={() => {
                const topic =
                  cart$?.userQuery ||
                  lastSubmittedInput?.query ||
                  summary ||
                  likelyCause ||
                  "";
                if (!topic) return;
                window.location.hash = `#lesson/new?query=${encodeURIComponent(topic)}`;
              }}
              style={{
                marginTop: 4,
                marginBottom: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                background: "linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(139,92,246,0.3)",
              }}
              title="Go deeper — open an interactive walkthrough of the concepts behind this"
            >
              🎓 Walk me through the why
            </button>
          )}

          {!isFallback && !summary && !likelyCause && (
            <p style={{ margin: "0 0 10px", color: "#e5e7eb" }}>
              Here&apos;s what I pulled for your question. Pick the closest match or tell me more
              about what you&apos;re seeing.
            </p>
          )}

          {resourceCount > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary
                style={{
                  cursor: "pointer",
                  color: "#a78bfa",
                  fontSize: "0.85rem",
                  padding: "8px 12px",
                  userSelect: "none",
                  background: "rgba(139,92,246,0.06)",
                  border: "1px solid rgba(139,92,246,0.2)",
                  borderRadius: 8,
                  fontWeight: 500,
                }}
              >
                Want to learn more? Show {resourceCount} related video
                {resourceCount === 1 ? "" : "s"} &amp; docs
              </summary>
              <div style={{ marginTop: 12 }}>
                <div className="shopping-layout">
                  <div className="results-column">
                    <OfficialDocsSummary
                      data={vaDocs}
                      isLoading={vertexAILoading}
                      error={vertexAIError}
                    />
                    {videos.length > 0 && (
                      <>
                        <h2 className="results-title">Videos ({videos.length})</h2>
                        <VideosByRole
                          videoResults={videos}
                          isInCart={isInCart}
                          handleVideoToggle={handleVideoToggle}
                          userQuery={cart$?.userQuery || ""}
                        />
                      </>
                    )}
                    {bp?.docs?.length > 0 && (
                      <DocsSection
                        docs={bp.docs}
                        isInCart={isInCart}
                        addToCart={addToCart}
                        removeFromCart={removeFromCart}
                      />
                    )}
                    {bp?.youtube?.length > 0 && (
                      <YouTubeSection
                        youtube={bp.youtube}
                        isInCart={isInCart}
                        addToCart={addToCart}
                        removeFromCart={removeFromCart}
                      />
                    )}
                    {epic?.length > 0 && <EpicLearningSection epicResults={epic} />}
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
              </div>
            </details>
          )}

          <p
            style={{
              marginTop: 12,
              marginBottom: 0,
              fontSize: "0.85rem",
              color: "#94a3b8",
              fontStyle: "italic",
            }}
          >
            Ask me to explain any part of this, tell me what you tried, or say &ldquo;teach me the
            concept behind this&rdquo; — I&apos;m here to help you understand it, not just patch it.
          </p>
        </div>
      </DiagnosisErrorBoundary>
    );
  };

  const hasConversation = messages.length > 0;

  return (
    <div className="problem-first-page">
      <header className="page-header">
        <h1>🎓 Learn Unreal, From Your Problem Up</h1>
        <p>
          Ask anything — a bug, a concept, a stuck moment. I&apos;ll walk you through what&apos;s
          going on and <em>why</em>, so the next time you hit something similar you&apos;ll
          already know where to look.
        </p>
        <p className="tutor-aside">
          Just need a quick fix with no teaching? The{" "}
          <a
            href="https://dev.epicgames.com/community/assistant/unreal-engine"
            target="_blank"
            rel="noopener noreferrer"
          >
            <strong>Unreal Editor Assistant</strong>
          </a>{" "}
          is built for that — come here when you want to actually understand it.
        </p>
      </header>

      {!hasConversation && (
        <div className="pf-input-layout">
          <div className="pf-input-main">
            <ChatThread
              messages={[]}
              emptyState={
                <div style={{ padding: "32px 16px", color: "#94a3b8", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: "0.95rem" }}>
                    Tell me what you&apos;re working on or what&apos;s confusing you — I&apos;ll
                    meet you where you are and teach through it.
                  </p>
                </div>
              }
            />
            <ChatInput
              onSend={handleChatSend}
              disabled={isAssistantTyping}
              placeholder="What are you trying to build, or where are you getting lost?"
            />
            <details style={{ marginTop: 12 }}>
              <summary
                style={{
                  cursor: "pointer",
                  color: "#94a3b8",
                  fontSize: "0.85rem",
                  padding: "4px 0",
                }}
              >
                Attach a screenshot or error log
              </summary>
              <div style={{ marginTop: 8 }}>
                <ProblemInput
                  onSubmit={wrappedSubmit}
                  detectedPersona={getDetectedPersona()}
                  isLoading={isAssistantTyping}
                />
              </div>
            </details>
          </div>
          <aside className="pf-input-sidebar">
            <CaseReportForm onUpdate={setCaseReport} disabled={false} />
            <ResumeSessionList
              onResume={handleResumeSession}
              currentSessionId={sessionId || undefined}
            />
          </aside>
        </div>
      )}

      {hasConversation && (
        <>
          <ChatThread
            messages={messages}
            onClarifyAnswer={handleClarifyAnswer}
            onClarifySkip={handleClarifySkip}
            renderRich={renderRich}
            sessionId={sessionId || undefined}
          />
          <ChatInput
            onSend={handleChatSend}
            disabled={isAssistantTyping}
            placeholder="Ask a follow-up…"
          />
          <div style={{ textAlign: "center", margin: "8px 0 20px" }}>
            <button
              className="back-btn"
              onClick={wrappedReset}
              style={{
                background: "transparent",
                border: "1px solid rgba(139,92,246,0.3)",
                color: "#94a3b8",
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              ← Start Over
            </button>
          </div>
        </>
      )}
    </div>
  );
}

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
              key={ytId}
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

const CONTENT_TYPE_ICONS = {
  talks_and_demos: Presentation,
  tutorial: BookOpen,
  knowledge_base: FileText,
  course: BookOpen,
};

const CONTENT_TYPE_LABELS = {
  talks_and_demos: "Talk / Demo",
  tutorial: "Tutorial",
  knowledge_base: "Knowledge Base",
  course: "Course",
};

function EpicLearningSection({ epicResults }) {
  return (
    <div className="blended-section">
      <div className="blended-section-header">
        <h2 className="blended-section-title">📝 Epic Learning Articles ({epicResults.length})</h2>
        <p className="blended-section-desc">
          Related articles, tutorials, and talks from the Epic Developer Community.
        </p>
      </div>
      <div className="doc-cards-grid">
        {epicResults.map((item) => {
          const ContentIcon = CONTENT_TYPE_ICONS[item.epicContentType] || FileText;
          const typeLabel = CONTENT_TYPE_LABELS[item.epicContentType] || item.epicContentType;
          const matchPct = Math.round((item.similarity || 0) * 100);
          const matchTier =
            matchPct >= 70
              ? "best"
              : matchPct >= 50
                ? "strong"
                : matchPct >= 35
                  ? "good"
                  : "related";

          return (
            <div key={item.id} className="doc-card epic-card">
              <a
                href={item.epicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="doc-card-link"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="doc-card-header">
                  <span
                    className={`doc-match-badge doc-match-${matchTier}`}
                    title={`${matchPct}% semantic match`}
                  >
                    <span className="doc-match-dot" />
                    {matchPct}%
                  </span>
                  <span className="epic-type-badge">
                    <ContentIcon size={12} />
                    {typeLabel}
                  </span>
                </div>
                <h4 className="doc-card-title">{item.videoTitle}</h4>
                {item.previewText && (
                  <p className="doc-card-desc">{item.previewText.slice(0, 180)}...</p>
                )}
                <div className="doc-card-footer">
                  <span className="doc-source-badge epic-source-badge">
                    <ExternalLink size={11} /> Epic Learning
                  </span>
                  {item.epicAuthor && <span className="epic-author">by {item.epicAuthor}</span>}
                </div>
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
