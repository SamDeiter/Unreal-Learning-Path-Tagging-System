/**
 * GuidedPlayer - AI-narrated learning experience (thin view)
 *
 * State, effects, and handlers live in useGuidedPlayer hook.
 * Stage-specific cards are extracted to sub-components.
 */
import { useState } from "react";
import PropTypes from "prop-types";
import useGuidedPlayer, { STAGES } from "../../hooks/useGuidedPlayer";
import { getThumbnailUrl } from "../../utils/videoUtils";
import ChallengeCard from "./ChallengeCard";
import BridgeCard from "./BridgeCard";
import CompletionCard from "./CompletionCard";
import CourseSidebar from "./CourseSidebar";
import QuizCard from "./QuizCard";
import TranscriptCards from "./TranscriptCards";
import learningObjectives from "../../data/learning_objectives.json";
import "./GuidedPlayer.css";

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
      {gp.stage === STAGES.PLAYING && gp.currentCourse && (
        <VideoStage
          course={gp.currentCourse}
          currentVideos={gp.currentVideos}
          currentVideo={gp.currentVideo}
          videoIndex={gp.videoIndex}
          hasMoreVideos={gp.hasMoreVideos}
          hasPreviousVideo={gp.hasPreviousVideo}
          microLesson={props.microLesson}
          courses={gp.courses}
          onVideoComplete={gp.handleVideoComplete}
          onPreviousVideo={gp.handlePreviousVideo}
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
          onExit={gp.onExit}
        />
      )}

      {/* Side panel (hidden during intro) */}
      {gp.stage !== STAGES.INTRO && (
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
function VideoStage({ course, currentVideos, currentVideo, videoIndex, hasMoreVideos, hasPreviousVideo, microLesson, courses, onVideoComplete, onPreviousVideo, onExit }) {
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
        <button
          className="prev-video-btn"
          onClick={onPreviousVideo}
          disabled={!hasPreviousVideo}
        >
          ← Previous
        </button>
        <button className="complete-btn" onClick={onVideoComplete}>
          ✓ Mark Complete
        </button>
        <button
          className="next-video-btn"
          onClick={onVideoComplete}
          disabled={!hasMoreVideos}
        >
          Next →
        </button>
        <button className="exit-btn" onClick={onExit}>Exit Path</button>
      </div>
    </div>
  );
}

/** AiGuidePanel — sidebar panel showing AI-generated lesson context */
function AiGuidePanel({ microLesson, courses }) {
  const [lessonOpen, setLessonOpen] = useState(true);
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
