/**
 * GuidedPlayer - AI-narrated learning experience
 * Shows intro cards, plays videos in sequence, displays context bridges
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import {
  generatePathIntro,
  generateBridgeText,
  generateProgressText,
} from "../../services/narratorService";
import { signInWithGoogle, onAuthChange } from "../../services/googleAuthService";
import { getThumbnailUrl } from "../../utils/videoUtils";
import "./GuidedPlayer.css";

// Player stages
const STAGES = {
  INTRO: "intro",
  PLAYING: "playing",
  BRIDGE: "bridge",
  COMPLETE: "complete",
};

export default function GuidedPlayer({ courses, diagnosis, problemSummary, onComplete, onExit }) {
  const [stage, setStage] = useState(STAGES.INTRO);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Handle Google sign in
  const handleSignIn = useCallback(async () => {
    setAuthLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      console.error("[GuidedPlayer] Sign in failed:", error);
    }
    setAuthLoading(false);
  }, []);

  // Generate intro card content
  const introContent = useMemo(() => {
    return generatePathIntro({
      problemSummary,
      courses,
      diagnosis,
    });
  }, [problemSummary, courses, diagnosis]);

  // Current course
  const currentCourse = courses[currentIndex] || null;
  const nextCourse = courses[currentIndex + 1] || null;

  // Progress tracking
  const progress = useMemo(() => {
    return generateProgressText(currentIndex, courses.length);
  }, [currentIndex, courses.length]);

  // Handle starting video playback
  const handleStartLearning = useCallback(() => {
    setStage(STAGES.PLAYING);
  }, []);

  // Handle video completion
  const handleVideoComplete = useCallback(() => {
    if (nextCourse) {
      setStage(STAGES.BRIDGE);
    } else {
      setStage(STAGES.COMPLETE);
      onComplete?.();
    }
  }, [nextCourse, onComplete]);

  // Handle moving to next video
  const handleContinue = useCallback(() => {
    setCurrentIndex((prev) => prev + 1);
    setStage(STAGES.PLAYING);
  }, []);

  // Skip to specific course
  const handleSkipTo = useCallback((index) => {
    setCurrentIndex(index);
    setStage(STAGES.PLAYING);
  }, []);

  // Generate bridge content
  const bridgeContent = useMemo(() => {
    if (stage !== STAGES.BRIDGE) return null;
    const objective = currentCourse?.gemini_outcomes?.[0] || null;
    return generateBridgeText(currentCourse, nextCourse, objective);
  }, [stage, currentCourse, nextCourse]);

  return (
    <div className="guided-player">
      {/* Progress Bar */}
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
        <span className="progress-text">{progress.text}</span>
      </div>

      {/* Stage: Intro Card */}
      {stage === STAGES.INTRO && (
        <div className="intro-card">
          <h2>{introContent.title}</h2>
          <p className="intro-text">{introContent.intro}</p>

          {/* Instructor List */}
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

          {/* Course Preview */}
          <div className="course-preview">
            <h3>📚 What You'll Learn</h3>
            <div className="course-list">
              {courses.slice(0, 5).map((course, i) => (
                <div key={course.code || i} className="course-preview-item">
                  <span className="number">{i + 1}</span>
                  <span className="title">{course.title || course.name}</span>
                </div>
              ))}
              {courses.length > 5 && <div className="more-courses">+{courses.length - 5} more</div>}
            </div>
          </div>

          {/* Auth Status & Start */}
          <div className="auth-section">
            {authLoading ? (
              <p className="auth-loading">Checking sign-in status...</p>
            ) : user ? (
              <div className="auth-signed-in">
                <span className="user-email">✓ Signed in as {user.email}</span>
                <button className="start-btn" onClick={handleStartLearning}>
                  ▶ Start Learning
                </button>
              </div>
            ) : (
              <div className="auth-prompt">
                <p className="signin-note">Sign in with Google to watch videos from Google Drive</p>
                <button className="signin-btn" onClick={handleSignIn}>
                  🔐 Sign in with Google
                </button>
                <button className="start-btn secondary" onClick={handleStartLearning}>
                  Skip sign-in (videos may not load)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stage: Video Playing */}
      {stage === STAGES.PLAYING && currentCourse && (
        <div className="video-stage">
          <div className="video-header">
            <h3>{currentCourse.title || currentCourse.name}</h3>
            {currentCourse.gemini_outcomes?.[0] && (
              <p className="objective">{currentCourse.gemini_outcomes[0]}</p>
            )}
          </div>

          {/* Video Embed */}
          <div className="video-container">
            {currentCourse.videos?.[0]?.drive_id ? (
              <iframe
                src={`https://drive.google.com/file/d/${currentCourse.videos[0].drive_id}/preview`}
                title={currentCourse.title}
                allow="autoplay"
                allowFullScreen
              />
            ) : (
              <div className="video-placeholder">
                <img src={getThumbnailUrl(currentCourse.videos?.[0])} alt={currentCourse.title} />
                <div className="play-overlay">▶</div>
              </div>
            )}
          </div>

          <div className="video-controls">
            <button className="complete-btn" onClick={handleVideoComplete}>
              ✓ Mark Complete & Continue
            </button>
            <button className="exit-btn" onClick={onExit}>
              Exit Path
            </button>
          </div>
        </div>
      )}

      {/* Stage: Bridge Card */}
      {stage === STAGES.BRIDGE && bridgeContent && (
        <div className={`bridge-card ${bridgeContent.type}`}>
          <div className="bridge-icon">{bridgeContent.type === "transition" ? "🔄" : "➡️"}</div>
          <h3>{bridgeContent.text}</h3>
          {bridgeContent.subtext && <p className="subtext">{bridgeContent.subtext}</p>}
          <button className="continue-btn" onClick={handleContinue}>
            Continue →
          </button>
        </div>
      )}

      {/* Stage: Complete */}
      {stage === STAGES.COMPLETE && (
        <div className="complete-card">
          <div className="complete-icon">🎉</div>
          <h2>Path Complete!</h2>
          <p>You've learned the skills to solve this problem and similar ones in the future.</p>
          <div className="stats">
            <div className="stat">
              <span className="value">{courses.length}</span>
              <span className="label">Lessons</span>
            </div>
            <div className="stat">
              <span className="value">{introContent.totalDuration || "—"}</span>
              <span className="label">Total Time</span>
            </div>
          </div>
          <button className="finish-btn" onClick={onExit}>
            Back to Problems
          </button>
        </div>
      )}

      {/* Side Panel: Course List */}
      <div className="course-sidebar">
        <h4>Your Path</h4>
        <div className="sidebar-courses">
          {courses.map((course, i) => (
            <button
              key={course.code || i}
              className={`sidebar-course ${i === currentIndex ? "active" : ""} ${i < currentIndex ? "completed" : ""}`}
              onClick={() => handleSkipTo(i)}
            >
              <span className="index">{i < currentIndex ? "✓" : i + 1}</span>
              <span className="title">{course.title || course.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

GuidedPlayer.propTypes = {
  courses: PropTypes.array.isRequired,
  diagnosis: PropTypes.object,
  problemSummary: PropTypes.string,
  onComplete: PropTypes.func,
  onExit: PropTypes.func,
};

GuidedPlayer.defaultProps = {
  diagnosis: null,
  problemSummary: "",
  onComplete: () => {},
  onExit: () => {},
};
