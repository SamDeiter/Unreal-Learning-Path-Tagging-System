"""Pass 1 Refactor: Extract GuidedPlayer controller hook + sub-components.
Zero behavior change — just moves state/handlers to hook, rendering to sub-components.
"""
import os

BASE = r"c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\path-builder\src"
GP_DIR = os.path.join(BASE, "components", "GuidedPlayer")
HOOKS_DIR = os.path.join(BASE, "hooks")

os.makedirs(HOOKS_DIR, exist_ok=True)

# ─── File 1: useGuidedPlayer.js (the controller hook) ───
hook_content = r'''/**
 * useGuidedPlayer — Controller hook for the GuidedPlayer experience.
 * Extracts all state, effects, and handlers from the view component.
 *
 * @param {Object} params
 * @param {Array} params.courses - Ordered list of courses in the path
 * @param {Object} params.diagnosis - AI diagnosis of the user's problem
 * @param {string} params.problemSummary - User's problem text
 * @param {Object} params.pathSummary - AI-generated path summary
 * @param {Function} params.onComplete - Called when the full path is completed
 * @param {Function} params.onExit - Called when the user exits the path
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  generatePathIntro,
  generateBridgeText,
  generateProgressText,
  generateChallenge,
} from "../services/narratorService";
import { signInWithGoogle, onAuthChange } from "../services/googleAuthService";
import { recordPathCompletion, getStreakInfo } from "../services/learningProgressService";
import quizData from "../data/quiz_questions.json";

// Player stages — exported so components can reference them
export const STAGES = {
  INTRO: "intro",
  PLAYING: "playing",
  QUIZ: "quiz",
  CHALLENGE: "challenge",
  BRIDGE: "bridge",
  COMPLETE: "complete",
};

export default function useGuidedPlayer({
  courses,
  diagnosis,
  problemSummary,
  pathSummary,
  onComplete,
  onExit,
}) {
  // ── Core state ──
  const [stage, setStage] = useState(STAGES.INTRO);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videoIndex, setVideoIndex] = useState(0);
  const [reflectionText, setReflectionText] = useState("");

  // ── Auth state ──
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleSignIn = useCallback(async () => {
    setAuthLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      console.error("[GuidedPlayer] Sign in failed:", error);
    }
    setAuthLoading(false);
  }, []);

  // ── Derived data ──
  const currentCourse = courses[currentIndex] || null;
  const nextCourse = courses[currentIndex + 1] || null;
  const currentVideos = currentCourse?.videos || [];
  const currentVideo = currentVideos[videoIndex] || currentVideos[0] || null;
  const hasMoreVideos = videoIndex < currentVideos.length - 1;

  const introContent = useMemo(
    () => generatePathIntro({ problemSummary, courses, diagnosis }),
    [problemSummary, courses, diagnosis]
  );

  const streak = useMemo(() => getStreakInfo(), []);

  // ── Progress tracking ──
  const totalVideoCount = useMemo(
    () => courses.reduce((sum, c) => sum + (c.videos?.length || 1), 0),
    [courses]
  );
  const videosWatchedSoFar = useMemo(() => {
    let count = 0;
    for (let i = 0; i < currentIndex; i++) {
      count += courses[i]?.videos?.length || 1;
    }
    return count + videoIndex;
  }, [courses, currentIndex, videoIndex]);
  const progress = useMemo(
    () => generateProgressText(videosWatchedSoFar, totalVideoCount),
    [videosWatchedSoFar, totalVideoCount]
  );

  // ── Stage-dependent content (lazy — only computed when needed) ──
  const bridgeContent = useMemo(() => {
    if (stage !== STAGES.BRIDGE) return null;
    const objective = currentCourse?.gemini_outcomes?.[0] || null;
    return generateBridgeText(currentCourse, nextCourse, objective);
  }, [stage, currentCourse, nextCourse]);

  const challengeContent = useMemo(() => {
    if (stage !== STAGES.CHALLENGE) return null;
    return generateChallenge(currentCourse, problemSummary, currentVideo?.title);
  }, [stage, currentCourse, problemSummary, currentVideo]);

  // ── Handlers (stage transitions) ──
  const handleStartLearning = useCallback(() => {
    setStage(STAGES.PLAYING);
  }, []);

  const handleVideoComplete = useCallback(() => {
    if (hasMoreVideos) {
      setVideoIndex((prev) => prev + 1);
    } else {
      const courseQuiz = quizData[currentCourse?.code];
      if (courseQuiz && Object.keys(courseQuiz).length > 0) {
        setStage(STAGES.QUIZ);
      } else {
        setStage(STAGES.CHALLENGE);
      }
    }
  }, [hasMoreVideos, currentCourse]);

  const handleQuizComplete = useCallback(() => {
    setStage(STAGES.CHALLENGE);
  }, []);

  const handleChallengeComplete = useCallback(() => {
    if (nextCourse) {
      setStage(STAGES.BRIDGE);
    } else {
      setStage(STAGES.COMPLETE);
      onComplete?.();
    }
  }, [nextCourse, onComplete]);

  const handleContinue = useCallback(() => {
    setCurrentIndex((prev) => prev + 1);
    setVideoIndex(0);
    setStage(STAGES.PLAYING);
  }, []);

  const handleSkipTo = useCallback((index) => {
    setCurrentIndex(index);
    setVideoIndex(0);
    setStage(STAGES.PLAYING);
  }, []);

  const handleFinish = useCallback(() => {
    const pathId = problemSummary
      ? `path-${problemSummary.replace(/\s+/g, "-").toLowerCase().slice(0, 40)}-${Date.now()}`
      : `path-${Date.now()}`;
    recordPathCompletion(pathId, courses, reflectionText);
    onExit?.();
  }, [problemSummary, courses, reflectionText, onExit]);

  const wordCount = reflectionText.trim().split(/\s+/).filter(Boolean).length;

  return {
    // State
    stage,
    currentIndex,
    videoIndex,
    reflectionText,
    setReflectionText,
    user,
    authLoading,

    // Derived
    currentCourse,
    nextCourse,
    currentVideos,
    currentVideo,
    hasMoreVideos,
    introContent,
    streak,
    progress,
    bridgeContent,
    challengeContent,
    pathSummary,
    wordCount,
    courses,

    // Handlers
    handleSignIn,
    handleStartLearning,
    handleVideoComplete,
    handleQuizComplete,
    handleChallengeComplete,
    handleContinue,
    handleSkipTo,
    handleFinish,
    onExit,
  };
}
'''

with open(os.path.join(HOOKS_DIR, "useGuidedPlayer.js"), "w", encoding="utf-8") as f:
    f.write(hook_content)
print("✅ hooks/useGuidedPlayer.js created")

# ─── File 2: ChallengeCard.jsx ───
challenge_card = r'''/**
 * ChallengeCard — Hands-on challenge with task, expected result, and hint.
 */
import PropTypes from "prop-types";

export default function ChallengeCard({ challengeContent, onComplete }) {
  return (
    <div className="challenge-card">
      <div className="challenge-icon">🔨</div>
      <h3>Try It Yourself</h3>
      <div className="challenge-difficulty">
        <span className={`difficulty-badge ${challengeContent.difficulty.toLowerCase()}`}>
          {challengeContent.difficulty}
        </span>
      </div>
      <p className="challenge-task">{challengeContent.task}</p>
      {challengeContent.expectedResult && (
        <div className="challenge-expected">
          <span className="expected-label">👁️ What to look for:</span>{" "}
          {challengeContent.expectedResult}
        </div>
      )}
      <div className="challenge-hint">
        <span className="hint-label">💡 Hint:</span> {challengeContent.hint}
      </div>
      <button className="challenge-done-btn" onClick={onComplete}>
        I tried it →
      </button>
      <button className="challenge-skip-btn" onClick={onComplete}>
        Skip challenge
      </button>
    </div>
  );
}

ChallengeCard.propTypes = {
  challengeContent: PropTypes.shape({
    task: PropTypes.string.isRequired,
    hint: PropTypes.string.isRequired,
    expectedResult: PropTypes.string,
    difficulty: PropTypes.string.isRequired,
  }).isRequired,
  onComplete: PropTypes.func.isRequired,
};
'''

with open(os.path.join(GP_DIR, "ChallengeCard.jsx"), "w", encoding="utf-8") as f:
    f.write(challenge_card)
print("✅ GuidedPlayer/ChallengeCard.jsx created")

# ─── File 3: BridgeCard.jsx ───
bridge_card = r'''/**
 * BridgeCard — Transition card between courses in the learning path.
 */
import PropTypes from "prop-types";

export default function BridgeCard({ bridgeContent, onContinue }) {
  return (
    <div className={`bridge-card ${bridgeContent.type}`}>
      <div className="bridge-icon">
        {bridgeContent.type === "transition" ? "🔄" : "➡️"}
      </div>
      <h3>{bridgeContent.text}</h3>
      {bridgeContent.subtext && <p className="subtext">{bridgeContent.subtext}</p>}
      <button className="continue-btn" onClick={onContinue}>
        Continue →
      </button>
    </div>
  );
}

BridgeCard.propTypes = {
  bridgeContent: PropTypes.shape({
    type: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
    subtext: PropTypes.string,
  }).isRequired,
  onContinue: PropTypes.func.isRequired,
};
'''

with open(os.path.join(GP_DIR, "BridgeCard.jsx"), "w", encoding="utf-8") as f:
    f.write(bridge_card)
print("✅ GuidedPlayer/BridgeCard.jsx created")

# ─── File 4: CompletionCard.jsx ───
completion_card = r'''/**
 * CompletionCard — End-of-path summary with reflection prompt and stats.
 */
import PropTypes from "prop-types";

export default function CompletionCard({
  courses,
  totalDuration,
  reflectionText,
  onReflectionChange,
  wordCount,
  onFinish,
}) {
  return (
    <div className="complete-card">
      <div className="complete-icon">🎉</div>
      <h2>Path Complete!</h2>
      <p>You&apos;ve learned the skills to solve this problem and similar ones in the future.</p>
      <div className="stats">
        <div className="stat">
          <span className="value">{courses.length}</span>
          <span className="label">Lessons</span>
        </div>
        <div className="stat">
          <span className="value">{totalDuration || "—"}</span>
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
          onChange={(e) => onReflectionChange(e.target.value)}
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

      <button className="finish-btn" onClick={onFinish}>
        {reflectionText.trim() ? "Save & Finish" : "Back to Problems"}
      </button>
    </div>
  );
}

CompletionCard.propTypes = {
  courses: PropTypes.array.isRequired,
  totalDuration: PropTypes.string,
  reflectionText: PropTypes.string.isRequired,
  onReflectionChange: PropTypes.func.isRequired,
  wordCount: PropTypes.number.isRequired,
  onFinish: PropTypes.func.isRequired,
};
'''

with open(os.path.join(GP_DIR, "CompletionCard.jsx"), "w", encoding="utf-8") as f:
    f.write(completion_card)
print("✅ GuidedPlayer/CompletionCard.jsx created")

# ─── File 5: CourseSidebar.jsx ───
sidebar_card = r'''/**
 * CourseSidebar — Side panel listing all courses in the path with progress indicators.
 */
import PropTypes from "prop-types";
import { cleanVideoTitle } from "../../utils/cleanVideoTitle";
import coursePrerequisites from "../../data/course_prerequisites.json";

export default function CourseSidebar({ courses, currentIndex, onSkipTo }) {
  const pathCodes = courses.map((c) => c.code);

  return (
    <div className="course-sidebar">
      <h4>Your Path</h4>
      <div className="sidebar-courses">
        {courses.map((course, i) => {
          const prereqData = coursePrerequisites[course.code];
          const missingPrereqs =
            prereqData?.prerequisites?.filter((p) => !pathCodes.includes(p)) || [];
          return (
            <button
              key={course.code || i}
              className={`sidebar-course ${i === currentIndex ? "active" : ""} ${i < currentIndex ? "completed" : ""}`}
              onClick={() => onSkipTo(i)}
              title={cleanVideoTitle(course.videos?.[0]?.title || course.title || course.name)}
            >
              <span className="index">{i < currentIndex ? "✓" : i + 1}</span>
              <span className="title">
                {cleanVideoTitle(course.videos?.[0]?.title || course.title || course.name)}
              </span>
              {prereqData?.difficulty && (
                <span className={`difficulty-tag ${prereqData.difficulty}`}>
                  {prereqData.difficulty}
                </span>
              )}
              {missingPrereqs.length > 0 && (
                <span
                  className="prereq-warning"
                  title={`Recommended: ${missingPrereqs.join(", ")} first`}
                >
                  ⚠️
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

CourseSidebar.propTypes = {
  courses: PropTypes.array.isRequired,
  currentIndex: PropTypes.number.isRequired,
  onSkipTo: PropTypes.func.isRequired,
};
'''

with open(os.path.join(GP_DIR, "CourseSidebar.jsx"), "w", encoding="utf-8") as f:
    f.write(sidebar_card)
print("✅ GuidedPlayer/CourseSidebar.jsx created")

# ─── File 6: Rewrite GuidedPlayer.jsx as thin view ───
# TranscriptCards stays inline since it's a pure display component tightly coupled to the player
new_guided_player = r'''/**
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
'''

with open(os.path.join(GP_DIR, "GuidedPlayer.jsx"), "w", encoding="utf-8") as f:
    f.write(new_guided_player)
print("✅ GuidedPlayer/GuidedPlayer.jsx rewritten as thin view")

# ─── File 7: TranscriptCards.jsx (extracted from GuidedPlayer) ───
transcript_cards = r'''/**
 * TranscriptCards — Shows relevant transcript timestamps during video playback.
 * Matches segments by keyword relevance to the user's problem.
 */
import { useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import transcriptSegments from "../../data/transcript_segments.json";

const STOPWORDS = new Set([
  "with", "that", "this", "from", "have", "will", "been", "when", "what",
  "which", "their", "there", "about", "would", "could", "should", "these",
  "those", "into", "also", "just", "than", "then", "them", "they", "your",
  "some", "very", "more", "does", "here", "want", "make", "like", "know", "need",
]);

const TOPIC_SKIP = new Set([
  "gonna", "going", "really", "actually", "basically", "right", "thing",
  "things", "about", "would", "could", "should", "there", "their", "these",
  "those", "where", "which", "being", "doing", "using", "other", "first",
  "second", "third", "after", "before", "every", "still", "again", "already",
  "engine", "unreal", "because", "simply", "called", "allows", "looking", "provides",
]);

/** Normalize a video/transcript key for fuzzy matching */
function normalize(s) {
  return (s || "")
    .replace(/\.mp4$/i, "")
    .replace(/^[\d._]+/, "")
    .replace(/[\s_]+/g, "")
    .toLowerCase();
}

export default function TranscriptCards({ courseCode, videoTitle, problemSummary, matchedKeywords }) {
  const cards = useMemo(() => {
    if (!courseCode) return [];

    const courseTranscripts = transcriptSegments[courseCode];
    if (!courseTranscripts) return [];

    const normalizedTitle = normalize(videoTitle);

    // Find matching transcript key (exact, then partial)
    let segments = null;
    for (const [key, segs] of Object.entries(courseTranscripts)) {
      if (normalize(key) === normalizedTitle) {
        segments = segs;
        break;
      }
    }
    if (!segments) {
      for (const [key, segs] of Object.entries(courseTranscripts)) {
        const nk = normalize(key);
        if (nk.includes(normalizedTitle) || normalizedTitle.includes(nk)) {
          segments = segs;
          break;
        }
      }
    }
    if (!segments || segments.length === 0) return [];

    // Build keyword list from problem + matched keywords
    const keywords = [];
    if (problemSummary) {
      keywords.push(
        ...problemSummary
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3 && !STOPWORDS.has(w))
      );
    }
    if (matchedKeywords) {
      keywords.push(
        ...matchedKeywords.map((k) =>
          (typeof k === "string" ? k : k.display_name || k.id || "").toLowerCase()
        )
      );
    }

    if (keywords.length === 0) {
      const step = Math.max(1, Math.floor(segments.length / 3));
      return segments
        .filter((_, i) => i % step === 0)
        .slice(0, 3)
        .map((seg) => ({ ...seg, score: 0, isChapter: true }));
    }

    // Score segments by keyword matches
    const scored = segments.map((seg) => {
      const text = seg.text.toLowerCase();
      let score = 0;
      const hits = [];
      for (const kw of keywords) {
        if (text.includes(kw)) {
          score += 10;
          if (!hits.includes(kw)) hits.push(kw);
        }
      }
      return { ...seg, score, hits: [...new Set(hits)] };
    });

    const relevant = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
    if (relevant.length > 0) return relevant.slice(0, 3);

    // Fallback: evenly spaced
    const step = Math.max(1, Math.floor(segments.length / 3));
    return segments
      .filter((_, i) => i % step === 0)
      .slice(0, 3)
      .map((seg) => ({ ...seg, score: 0, isChapter: true }));
  }, [courseCode, videoTitle, problemSummary, matchedKeywords]);

  const getTopicLabel = useCallback((seg) => {
    if (seg.summary) return seg.summary;
    const text = seg.text || "";
    const words = text
      .replace(/[.,;:!?'"()]/g, "")
      .split(/\s+/)
      .filter((w) => w.length >= 5 && !TOPIC_SKIP.has(w.toLowerCase()))
      .map((w) => w.toLowerCase());
    const freq = {};
    for (const w of words) freq[w] = (freq[w] || 0) + 1;
    const topTerms = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));
    return topTerms.length > 0 ? topTerms.join(", ") : "Overview";
  }, []);

  if (cards.length === 0) return null;

  return (
    <div className="video-info-cards">
      <div className="info-card transcript-card">
        <h4>
          {cards[0]?.isChapter
            ? "📋 Video Chapters"
            : `🎯 Helps with: ${problemSummary || "your search"}`}
        </h4>
        <div className="timestamp-list">
          {cards.map((seg, i) => (
            <div key={i} className={`timestamp-item ${seg.score > 0 ? "relevant" : ""}`}>
              <span className="timestamp-badge">{seg.start}</span>
              <span className="timestamp-text">{getTopicLabel(seg)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

TranscriptCards.propTypes = {
  courseCode: PropTypes.string,
  videoTitle: PropTypes.string,
  problemSummary: PropTypes.string,
  matchedKeywords: PropTypes.array,
};
'''

with open(os.path.join(GP_DIR, "TranscriptCards.jsx"), "w", encoding="utf-8") as f:
    f.write(transcript_cards)
print("✅ GuidedPlayer/TranscriptCards.jsx created")

print("\n─── Pass 1 Complete ───")
print("Files created/modified:")
print("  NEW: hooks/useGuidedPlayer.js")
print("  NEW: GuidedPlayer/ChallengeCard.jsx")
print("  NEW: GuidedPlayer/BridgeCard.jsx")
print("  NEW: GuidedPlayer/CompletionCard.jsx")
print("  NEW: GuidedPlayer/CourseSidebar.jsx")
print("  NEW: GuidedPlayer/TranscriptCards.jsx")
print("  MOD: GuidedPlayer/GuidedPlayer.jsx (rewritten as thin view)")
