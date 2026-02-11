/**
 * GuidedPlayer - AI-narrated learning experience (thin view)
 *
 * State, effects, and handlers live in useGuidedPlayer hook.
 * Stage-specific cards are extracted to sub-components.
 */
import { useState } from "react";
import PropTypes from "prop-types";
import useGuidedPlayer, { STAGES } from "../../hooks/useGuidedPlayer";
import docLinks from "../../data/doc_links.json";
import { getThumbnailUrl } from "../../utils/videoUtils";
import ChallengeCard from "./ChallengeCard";
import BridgeCard from "./BridgeCard";
import CompletionCard from "./CompletionCard";
import CourseSidebar from "./CourseSidebar";
import QuizCard from "./QuizCard";
import TranscriptCards from "./TranscriptCards";
import learningObjectives from "../../data/learning_objectives.json";
import "./GuidedPlayer.css";

/**
 * Convert inline markdown (**bold**, *italic*, `code`, [text](url)) to React elements.
 */
function renderInlineMarkdown(text) {
  if (!text || typeof text !== "string") return text;

  // Strip bare citation markers from Gemini output (e.g. [4], [1,2], [1][2])
  text = text.replace(/\s*\[\d+(?:[,\s]*\d+)*\]/g, "").trim();

  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Find the earliest markdown pattern
    const patterns = [
      { re: /\*\*(.+?)\*\*/, wrap: (m) => <strong key={key++}>{m}</strong> },
      { re: /\*(.+?)\*/, wrap: (m) => <em key={key++}>{m}</em> },
      { re: /`([^`]+)`/, wrap: (m) => <code key={key++} className="inline-code">{m}</code> },
      { re: /\[([^\]]+)\]\(([^)]+)\)/, wrap: (m, url) => <a key={key++} href={url} target="_blank" rel="noopener noreferrer">{m}</a> },
    ];

    let earliest = null;
    let earliestIdx = remaining.length;
    let matchedPattern = null;

    for (const p of patterns) {
      const match = remaining.match(p.re);
      if (match && match.index < earliestIdx) {
        earliest = match;
        earliestIdx = match.index;
        matchedPattern = p;
      }
    }

    if (!earliest) {
      parts.push(remaining);
      break;
    }

    // Add text before the match
    if (earliestIdx > 0) {
      parts.push(remaining.slice(0, earliestIdx));
    }

    // Add the rendered element
    parts.push(matchedPattern.wrap(earliest[1], earliest[2]));
    remaining = remaining.slice(earliestIdx + earliest[0].length);
  }

  return parts;
}

export default function GuidedPlayer(props) {
  const gp = useGuidedPlayer(props);

  return (
    <div className="guided-player">
      {/* Progress Bar */}
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${gp.progress.percent}%` }} />
        <span className="progress-text">{gp.progress.text}</span>
      </div>

      {/* Stage: Intro Card */}
      {gp.stage === STAGES.INTRO && (
        <IntroCard
          introContent={gp.introContent}
          streak={gp.streak}
          courses={gp.courses}
          pathSummary={gp.pathSummary}
          user={gp.user}
          authLoading={gp.authLoading}
          onSignIn={gp.handleSignIn}
          onStart={gp.handleStartLearning}
        />
      )}

      {/* Stage: Video Playing */}
      {gp.stage === STAGES.PLAYING && gp.currentCourse && !gp.currentCourse._readingStep && (
        <VideoStage
          course={gp.currentCourse}
          currentVideos={gp.currentVideos}
          currentVideo={gp.currentVideo}
          videoIndex={gp.videoIndex}
          hasMoreVideos={gp.hasMoreVideos}
          microLesson={props.microLesson}
          courses={gp.courses}
          onVideoComplete={gp.handleVideoComplete}
          onExit={gp.onExit}
        />
      )}

      {/* Stage: Reading Step (doc/YouTube) */}
      {gp.stage === STAGES.PLAYING && gp.currentCourse && gp.currentCourse._readingStep && (
        <ReadingStep
          course={gp.currentCourse}
          stepNumber={gp.currentIndex + 1}
          totalSteps={gp.courses.length}
          onComplete={gp.handleVideoComplete}
          onExit={gp.onExit}
        />
      )}

      {/* Stage: Quiz */}
      {gp.stage === STAGES.QUIZ && (
        <QuizCard
          courseCode={gp.currentCourse?.code}
          videoKey={gp.currentVideo?.title || gp.currentVideo?.name || ""}
          onComplete={gp.handleQuizComplete}
          onSkip={gp.handleQuizComplete}
        />
      )}

      {/* Stage: Challenge */}
      {gp.stage === STAGES.CHALLENGE && gp.challengeContent && (
        <ChallengeCard
          challengeContent={gp.challengeContent}
          onComplete={gp.handleChallengeComplete}
        />
      )}


      {/* Stage: Complete */}
      {gp.stage === STAGES.COMPLETE && (
        <CompletionCard
          courses={gp.courses}
          totalDuration={gp.introContent.totalDuration}
          reflectionText={gp.reflectionText}
          onReflectionChange={gp.setReflectionText}
          wordCount={gp.wordCount}
          onFinish={gp.handleFinish}
          onBackToPath={gp.handleBackToPath}
        />
      )}

      {/* Side panel (hidden during intro and complete) */}
      {gp.stage !== STAGES.INTRO && gp.stage !== STAGES.COMPLETE && (
        <div className="sidebar-column">
          <CourseSidebar
            courses={gp.courses}
            currentIndex={gp.currentIndex}
            onSkipTo={gp.handleSkipTo}
          />
          {gp.stage === STAGES.PLAYING && gp.currentCourse && (
            <TranscriptCards
              courseCode={gp.currentCourse.code}
              videoTitle={gp.currentVideo?.title || gp.currentVideo?.name || ""}
              problemSummary={props.problemSummary}
              matchedKeywords={gp.currentCourse._matchedKeywords}
            />
          )}
        </div>
      )}
    </div>
  );
}

GuidedPlayer.propTypes = {
  courses: PropTypes.array.isRequired,
  diagnosis: PropTypes.object,
  problemSummary: PropTypes.string,
  microLesson: PropTypes.object,
  pathSummary: PropTypes.shape({
    path_summary: PropTypes.string,
    topics_covered: PropTypes.arrayOf(PropTypes.string),
  }),
  onComplete: PropTypes.func,
  onExit: PropTypes.func,
};

GuidedPlayer.defaultProps = {
  diagnosis: null,
  problemSummary: "",
  microLesson: null,
  pathSummary: null,
  onComplete: () => {},
  onExit: () => {},
};

// ─── Inline sub-components (tightly coupled to this view) ───

/** IntroCard — welcome screen with instructor list and course preview */
function IntroCard({ introContent, streak, courses, pathSummary, user, authLoading, onSignIn, onStart }) {
  return (
    <div className="intro-card">
      <h2>{introContent.title}</h2>
      <p className="intro-text">{introContent.intro}</p>
      {introContent.rootCauses?.length > 0 && (
        <ol className="root-cause-list">
          {introContent.rootCauses.map((cause, i) => (
            <li key={i}>{cause.replace(/\s*\[\d+\]/g, "")}</li>
          ))}
        </ol>
      )}

      {streak.isActive && streak.count > 1 && (
        <div className="streak-badge">🔥 {streak.count}-day learning streak!</div>
      )}

      {introContent.instructors.length > 0 && (
        <div className="instructor-list">
          <h3>🎓 Your Instructors</h3>
          {introContent.instructors.map((instructor, i) => (
            <div key={i} className="instructor-item">
              <span className="name">{instructor.name}</span>
              <span className="courses">
                {instructor.courses.length} lesson{instructor.courses.length > 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="course-preview">
        <h3>📚 What You&#39;ll Learn</h3>
        {pathSummary?.path_summary && (
          <div className="path-summary-section">
            <p className="path-summary-text">{pathSummary.path_summary}</p>

          </div>
        )}
        <div className="course-list">
          {courses.slice(0, 5).map((course, i) => {
            const objectives = learningObjectives[course.code] || [];
            const videoTitle = course.videos?.[0]?.title || course.title || course.name;
            return (
              <div key={course.code || i} className="course-preview-item">
                <span className="number">{i + 1}</span>
                <div className="course-preview-details">
                  <span className="title">{videoTitle?.replace(/\s+Part\s+[A-Z]$/i, "").trim()}</span>
                  {objectives.length > 0 && (
                    <ul className="objective-list">
                      {objectives.slice(0, 2).map((obj, j) => (
                        <li key={j}>{obj}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
          {courses.length > 5 && <div className="more-courses">+{courses.length - 5} more</div>}
        </div>
      </div>

      <div className="auth-section">
        {authLoading ? (
          <p className="auth-loading">Checking sign-in status...</p>
        ) : user ? (
          <div className="auth-signed-in">
            <span className="user-email">✓ Signed in as {user.email}</span>
            <button className="start-btn" onClick={onStart}>▶ Start Learning</button>
          </div>
        ) : (
          <div className="auth-prompt">
            <p className="signin-note">Sign in with Google to watch videos from Google Drive</p>
            <button className="signin-btn" onClick={onSignIn}>🔐 Sign in with Google</button>
            <button className="start-btn secondary" onClick={onStart}>
              Skip sign-in (videos may not load)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** VideoStage — video player with transcript cards and controls */
function VideoStage({ course, currentVideos, currentVideo, videoIndex, hasMoreVideos, microLesson, courses, onVideoComplete, onExit }) {
  return (
    <div className="video-stage">
      <div className="video-header">
        <h3>{course.title || course.name}</h3>
        {currentVideos.length > 1 && (
          <span className="video-counter">
            Video {videoIndex + 1} of {currentVideos.length}
          </span>
        )}
        {course.gemini_outcomes?.[0] && (
          <p className="objective">{course.gemini_outcomes[0]}</p>
        )}
      </div>
      <div className="video-container">
        {currentVideo?.drive_id ? (
          <iframe
            key={currentVideo.drive_id}
            src={`https://drive.google.com/file/d/${currentVideo.drive_id}/preview`}
            title={currentVideo.title || course.title}
            allow="autoplay"
            allowFullScreen
          />
        ) : (
          <div className="video-placeholder">
            <img src={getThumbnailUrl(currentVideo)} alt={course.title} />
            <div className="play-overlay">▶</div>
          </div>
        )}
      </div>
      {microLesson && <AiGuidePanel microLesson={microLesson} courses={courses} />}
      <div className="video-controls">
        <button className="complete-btn" onClick={onVideoComplete}>
          {hasMoreVideos ? "Mark Complete & Continue →" : "Complete & Try Exercise →"}
        </button>
        <button className="exit-btn" onClick={onExit}>Exit Path</button>
      </div>
    </div>
  );
}

/** AiGuidePanel — sidebar panel showing AI-generated lesson context */
function AiGuidePanel({ microLesson, courses }) {
  const [lessonOpen, setLessonOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState("quick_fix");

  const quickFix = microLesson?.quick_fix;
  const whyItWorks = microLesson?.why_it_works;
  const relatedSituations = microLesson?.related_situations;

  const toggleSection = (section) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  // Parse [N] citation markers in text and render them as styled tooltips
  const renderTextWithCitations = (text) => {
    if (!text) return null;
    const parts = text.split(/(\[\d+\])/g);
    return parts.map((part, i) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const num = parseInt(match[1], 10);
        const courseRef = courses?.[num - 1];
        const videoName = (courseRef?.videos?.[0]?.title || courseRef?.title || "")
          ?.replace(/\s+Part\s+[A-Z]$/i, "").trim();
        if (!videoName) return null; // No matching course — hide citation
        return (
          <span key={i} className="gp-ai-cite" data-tooltip={`📹 ${videoName}`}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className={`gp-ai-lesson ${lessonOpen ? "open" : "collapsed"}`}>
      <button className="gp-ai-lesson-toggle" onClick={() => setLessonOpen((v) => !v)}>
        <span className="gp-ai-badge">✨ AI Guide</span>
        <span className="gp-ai-subtitle">What to look for</span>
        <span className="gp-ai-chevron">{lessonOpen ? "▾" : "▸"}</span>
      </button>

      {lessonOpen && (
        <div className="gp-ai-body">
          {/* Quick Fix Steps */}
          {quickFix && (
            <div className={`gp-ai-section ${expandedSection === "quick_fix" ? "expanded" : ""}`}>
              <button className="gp-ai-section-toggle" onClick={() => toggleSection("quick_fix")}>
                <span>⚡ {quickFix.title || "Quick Fix"}</span>
                <span className="gp-ai-section-chevron">{expandedSection === "quick_fix" ? "▾" : "▸"}</span>
              </button>
              {expandedSection === "quick_fix" && quickFix.steps && (
                <ol className="gp-ai-steps">
                  {quickFix.steps.map((step, i) => (
                    <li key={i}>{renderTextWithCitations(step)}</li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* Why This Works */}
          {whyItWorks && (
            <div className={`gp-ai-section ${expandedSection === "why" ? "expanded" : ""}`}>
              <button className="gp-ai-section-toggle" onClick={() => toggleSection("why")}>
                <span>🧠 Why This Works</span>
                {whyItWorks.key_concept && (
                  <span className="gp-ai-concept-tag">{whyItWorks.key_concept}</span>
                )}
                <span className="gp-ai-section-chevron">{expandedSection === "why" ? "▾" : "▸"}</span>
              </button>
              {expandedSection === "why" && (
                <p className="gp-ai-explanation">{renderTextWithCitations(whyItWorks.explanation)}</p>
              )}
            </div>
          )}

          {/* Related Situations */}
          {relatedSituations && relatedSituations.length > 0 && (
            <div className={`gp-ai-section ${expandedSection === "related" ? "expanded" : ""}`}>
              <button className="gp-ai-section-toggle" onClick={() => toggleSection("related")}>
                <span>🔗 Related Situations</span>
                <span className="gp-ai-count-tag">{relatedSituations.length}</span>
                <span className="gp-ai-section-chevron">{expandedSection === "related" ? "▾" : "▸"}</span>
              </button>
              {expandedSection === "related" && (
                <div className="gp-ai-scenarios">
                  {relatedSituations.map((sit, i) => (
                    <div key={i} className="gp-ai-scenario">
                      <strong>💡 {sit.scenario}</strong>
                      <p>{renderTextWithCitations(sit.connection)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── ReadingStep — card for doc/YouTube reading steps ─── */
function ReadingStep({ course, stepNumber, totalSteps, onComplete, onExit }) {
  const [isRead, setIsRead] = useState(false);
  const typeIcon = course._resourceType === "doc" ? "📖" : "▶️";
  const typeLabel = course._resourceType === "doc" ? "Documentation" : "YouTube Video";
  const sourceLabel = course._resourceType === "doc" ? "Epic Docs" : (course._channel || "YouTube");

  return (
    <div className="reading-step">
      <div className="reading-step-header">
        <span className="reading-step-badge">{typeIcon} {typeLabel}</span>
        <span className="reading-step-progress">Step {stepNumber} of {totalSteps}</span>
      </div>

      <h2 className="reading-step-title">{course.title}</h2>

      <div className="reading-step-meta">
        {course._tier && (
          <span className={`tier-badge tier-${course._tier}`}>{course._tier}</span>
        )}
        {course._subsystem && (
          <span className="subsystem-tag">{course._subsystem}</span>
        )}
        <span className="reading-step-time">
          ⏱ {course._readTimeMinutes} min {course._resourceType === "doc" ? "read" : "watch"}
        </span>
      </div>

      {course._description && (
        <p className="reading-step-description">{course._description}</p>
      )}

      {course._keySteps && course._keySteps.length > 0 ? (
        <div className="key-steps-section">
          <h3 className="key-steps-heading">📋 Key Steps</h3>
          <ol className="key-steps-list">
            {course._keySteps.map((step, i) => (
              <li key={i} className="key-step-item">{renderInlineMarkdown(step)}</li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="key-steps-section key-steps-fallback">
          <h3 className="key-steps-heading">🎯 What to Focus On</h3>
          <ul className="key-steps-list">
            <li className="key-step-item">Read through the overview to understand the core concepts</li>
            {course._subsystem && (
              <li className="key-step-item">Pay attention to how <strong>{course._subsystem}</strong> integrates with the editor workflow</li>
            )}
            <li className="key-step-item">Note any prerequisites or required project settings</li>
            <li className="key-step-item">Try recreating the examples in your own UE5 project</li>
          </ul>
        </div>
      )}

      {course._seeAlso && course._seeAlso.length > 0 && (
        <div className="see-also-section">
          <h3 className="see-also-heading">🔗 See Also</h3>
          <div className="see-also-links">
            {course._seeAlso.map((ref, i) => {
              const refDoc = docLinks[ref.docKey];
              const refUrl = refDoc ? refDoc.url : "#";
              return (
                <a
                  key={i}
                  href={refUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="see-also-link"
                  title={refDoc ? refDoc.description : ref.label}
                >
                  → {ref.label}
                </a>
              );
            })}
          </div>
        </div>
      )}

      <div className="reading-step-source">
        <span className="reading-step-source-label">Source: {sourceLabel}</span>
      </div>

      <a
        href={course._url}
        target="_blank"
        rel="noopener noreferrer"
        className="reading-step-link"
        onClick={() => setIsRead(true)}
      >
        {course._resourceType === "doc" ? "📄 Open Documentation" : "▶️ Watch on YouTube"}
        <span className="reading-step-link-arrow">↗</span>
      </a>

      <div className="reading-step-actions">
        <button
          className={`reading-step-complete ${isRead ? "ready" : ""}`}
          onClick={onComplete}
          title={isRead ? "Continue to next step" : "Mark as read and continue"}
        >
          {isRead ? "✓ Read — Continue →" : "Mark as Read → Continue"}
        </button>
        <button className="reading-step-exit" onClick={onExit}>
          ✕ Exit Path
        </button>
      </div>
    </div>
  );
}

ReadingStep.propTypes = {
  course: PropTypes.object.isRequired,
  stepNumber: PropTypes.number.isRequired,
  totalSteps: PropTypes.number.isRequired,
  onComplete: PropTypes.func.isRequired,
  onExit: PropTypes.func.isRequired,
};
