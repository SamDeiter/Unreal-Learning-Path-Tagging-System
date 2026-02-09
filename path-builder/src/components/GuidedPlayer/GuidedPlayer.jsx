/**
 * GuidedPlayer - AI-narrated learning experience (thin view)
 *
 * State, effects, and handlers live in useGuidedPlayer hook.
 * Stage-specific cards are extracted to sub-components.
 */
import { useMemo, useCallback } from "react";
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
          problemSummary={props.problemSummary}
          onVideoComplete={gp.handleVideoComplete}
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

      {/* Stage: Bridge */}
      {gp.stage === STAGES.BRIDGE && gp.bridgeContent && (
        <BridgeCard bridgeContent={gp.bridgeContent} onContinue={gp.handleContinue} />
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
        />
      )}

      {/* Side panel (hidden during intro) */}
      {gp.stage !== STAGES.INTRO && (
        <CourseSidebar
          courses={gp.courses}
          currentIndex={gp.currentIndex}
          onSkipTo={gp.handleSkipTo}
        />
      )}
    </div>
  );
}

GuidedPlayer.propTypes = {
  courses: PropTypes.array.isRequired,
  diagnosis: PropTypes.object,
  problemSummary: PropTypes.string,
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
            {pathSummary.topics_covered?.length > 0 && (
              <div className="topic-chips">
                {pathSummary.topics_covered.map((topic, i) => (
                  <span key={i} className="topic-chip">{topic}</span>
                ))}
              </div>
            )}
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
                  <span className="title">{videoTitle}</span>
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
function VideoStage({ course, currentVideos, currentVideo, videoIndex, hasMoreVideos, problemSummary, onVideoComplete, onExit }) {
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
      <TranscriptCards
        courseCode={course.code}
        videoTitle={currentVideo?.title || currentVideo?.name || ""}
        problemSummary={problemSummary}
        matchedKeywords={course._matchedKeywords}
      />
      <div className="video-controls">
        <button className="complete-btn" onClick={onVideoComplete}>
          {hasMoreVideos ? "Next Video →" : "✓ Mark Complete & Continue"}
        </button>
        <button className="exit-btn" onClick={onExit}>Exit Path</button>
      </div>
    </div>
  );
}
