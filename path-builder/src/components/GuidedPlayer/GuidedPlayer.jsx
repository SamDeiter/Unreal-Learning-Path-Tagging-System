/**
 * GuidedPlayer - AI-narrated learning experience
 * Shows intro cards, plays videos in sequence, displays context bridges
 * Features: Challenge cards, reflection prompts, learning progress tracking
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import {
  generatePathIntro,
  generateBridgeText,
  generateProgressText,
  generateChallenge,
} from "../../services/narratorService";
import { signInWithGoogle, onAuthChange } from "../../services/googleAuthService";
import { getThumbnailUrl } from "../../utils/videoUtils";
import { cleanVideoTitle } from "../../utils/cleanVideoTitle";
import { recordPathCompletion, getStreakInfo } from "../../services/learningProgressService";
import "./GuidedPlayer.css";

// Player stages
const STAGES = {
  INTRO: "intro",
  PLAYING: "playing",
  CHALLENGE: "challenge",
  BRIDGE: "bridge",
  COMPLETE: "complete",
};

export default function GuidedPlayer({ courses, diagnosis, problemSummary, onComplete, onExit }) {
  const [stage, setStage] = useState(STAGES.INTRO);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [reflectionText, setReflectionText] = useState("");
  const [videoIndex, setVideoIndex] = useState(0);

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

  // Current course and video
  const currentCourse = courses[currentIndex] || null;
  const nextCourse = courses[currentIndex + 1] || null;
  const currentVideos = currentCourse?.videos || [];
  const currentVideo = currentVideos[videoIndex] || currentVideos[0] || null;
  const hasMoreVideos = videoIndex < currentVideos.length - 1;

  // Streak info
  const streak = useMemo(() => getStreakInfo(), []);

  // Progress tracking — count total videos across all courses
  const totalVideoCount = useMemo(() => {
    return courses.reduce((sum, c) => sum + (c.videos?.length || 1), 0);
  }, [courses]);
  const videosWatchedSoFar = useMemo(() => {
    let count = 0;
    for (let i = 0; i < currentIndex; i++) {
      count += courses[i]?.videos?.length || 1;
    }
    return count + videoIndex;
  }, [courses, currentIndex, videoIndex]);
  const progress = useMemo(() => {
    return generateProgressText(videosWatchedSoFar, totalVideoCount);
  }, [videosWatchedSoFar, totalVideoCount]);

  // Handle starting video playback
  const handleStartLearning = useCallback(() => {
    setStage(STAGES.PLAYING);
  }, []);

  // Handle video completion — advance within course or go to challenge
  const handleVideoComplete = useCallback(() => {
    if (hasMoreVideos) {
      setVideoIndex((prev) => prev + 1);
    } else {
      setStage(STAGES.CHALLENGE);
    }
  }, [hasMoreVideos]);

  // After challenge, proceed to BRIDGE or COMPLETE
  const handleChallengeComplete = useCallback(() => {
    if (nextCourse) {
      setStage(STAGES.BRIDGE);
    } else {
      setStage(STAGES.COMPLETE);
      onComplete?.();
    }
  }, [nextCourse, onComplete]);

  // Handle moving to next course
  const handleContinue = useCallback(() => {
    setCurrentIndex((prev) => prev + 1);
    setVideoIndex(0);
    setStage(STAGES.PLAYING);
  }, []);

  // Skip to specific course
  const handleSkipTo = useCallback((index) => {
    setCurrentIndex(index);
    setVideoIndex(0);
    setStage(STAGES.PLAYING);
  }, []);

  // Generate bridge content
  const bridgeContent = useMemo(() => {
    if (stage !== STAGES.BRIDGE) return null;
    const objective = currentCourse?.gemini_outcomes?.[0] || null;
    return generateBridgeText(currentCourse, nextCourse, objective);
  }, [stage, currentCourse, nextCourse]);

  // Generate challenge content
  const challengeContent = useMemo(() => {
    if (stage !== STAGES.CHALLENGE) return null;
    return generateChallenge(currentCourse, problemSummary);
  }, [stage, currentCourse, problemSummary]);

  // Handle path completion with progress tracking
  const handleFinish = useCallback(() => {
    // Generate a simple path ID from the problem summary
    const pathId = problemSummary
      ? `path-${problemSummary.replace(/\s+/g, "-").toLowerCase().slice(0, 40)}-${Date.now()}`
      : `path-${Date.now()}`;

    recordPathCompletion(pathId, courses, reflectionText);
    onExit?.();
  }, [problemSummary, courses, reflectionText, onExit]);

  // Reflection word count
  const wordCount = reflectionText.trim().split(/\s+/).filter(Boolean).length;

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

          {/* Streak Badge */}
          {streak.isActive && streak.count > 1 && (
            <div className="streak-badge">🔥 {streak.count}-day learning streak!</div>
          )}

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
            {currentVideos.length > 1 && (
              <span className="video-counter">
                Video {videoIndex + 1} of {currentVideos.length}
              </span>
            )}
            {currentCourse.gemini_outcomes?.[0] && (
              <p className="objective">{currentCourse.gemini_outcomes[0]}</p>
            )}
          </div>

          {/* Video Embed */}
          <div className="video-container">
            {currentVideo?.drive_id ? (
              <iframe
                key={currentVideo.drive_id}
                src={`https://drive.google.com/file/d/${currentVideo.drive_id}/preview`}
                title={currentVideo.title || currentCourse.title}
                allow="autoplay"
                allowFullScreen
              />
            ) : (
              <div className="video-placeholder">
                <img src={getThumbnailUrl(currentVideo)} alt={currentCourse.title} />
                <div className="play-overlay">▶</div>
              </div>
            )}
          </div>

          <div className="video-controls">
            <button className="complete-btn" onClick={handleVideoComplete}>
              {hasMoreVideos ? "Next Video →" : "✓ Mark Complete & Continue"}
            </button>
            <button className="exit-btn" onClick={onExit}>
              Exit Path
            </button>
          </div>
        </div>
      )}

      {/* Stage: Challenge Card */}
      {stage === STAGES.CHALLENGE && challengeContent && (
        <div className="challenge-card">
          <div className="challenge-icon">🔨</div>
          <h3>Try It Yourself</h3>
          <div className="challenge-difficulty">
            <span className={`difficulty-badge ${challengeContent.difficulty.toLowerCase()}`}>
              {challengeContent.difficulty}
            </span>
          </div>
          <p className="challenge-task">{challengeContent.task}</p>
          <div className="challenge-hint">
            <span className="hint-label">💡 Hint:</span> {challengeContent.hint}
          </div>
          <button className="challenge-done-btn" onClick={handleChallengeComplete}>
            I tried it →
          </button>
          <button className="challenge-skip-btn" onClick={handleChallengeComplete}>
            Skip challenge
          </button>
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

          {/* Reflection Prompt */}
          <div className="reflection-area">
            <h3>📝 What was your main takeaway?</h3>
            <p className="reflection-subtitle">
              Writing your reflection helps cement what you learned.
            </p>
            <textarea
              className="reflection-input"
              placeholder="I learned that..."
              value={reflectionText}
              onChange={(e) => setReflectionText(e.target.value)}
              rows={4}
            />
            <div className="reflection-meta">
              {wordCount === 0 && <span className="word-hint">Try writing a few sentences</span>}
              {wordCount > 0 && wordCount < 10 && (
                <span className="word-hint">{wordCount} words — keep going!</span>
              )}
              {wordCount >= 10 && <span className="word-hint done">Great reflection! ✓</span>}
            </div>
          </div>

          <button className="finish-btn" onClick={handleFinish}>
            {reflectionText.trim() ? "Save & Finish" : "Back to Problems"}
          </button>
        </div>
      )}

      {/* Side Panel: Course List (hidden during intro — shown inside intro card) */}
      {stage !== STAGES.INTRO && (
        <div className="course-sidebar">
          <h4>Your Path</h4>
          <div className="sidebar-courses">
            {courses.map((course, i) => (
              <button
                key={course.code || i}
                className={`sidebar-course ${i === currentIndex ? "active" : ""} ${i < currentIndex ? "completed" : ""}`}
                onClick={() => handleSkipTo(i)}
                title={cleanVideoTitle(course.videos?.[0]?.title || course.title || course.name)}
              >
                <span className="index">{i < currentIndex ? "✓" : i + 1}</span>
                <span className="title">
                  {cleanVideoTitle(course.videos?.[0]?.title || course.title || course.name)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
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
