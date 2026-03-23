import { useState, useCallback } from 'react';

/**
 * CoursePreview.jsx
 *
 * A learner-centric preview of the course structure.
 * Redesigned with a premium "Glassmorphism" syllabus layout.
 * Clicking ▶ on a lesson expands an inline video/quiz preview.
 */
const CoursePreview = ({ path, stats }) => {
  // Track which lesson is currently expanded (by "mIdx-lIdx" key)
  const [expandedLesson, setExpandedLesson] = useState(null);

  const toggleLesson = useCallback((key) => {
    setExpandedLesson((prev) => (prev === key ? null : key));
  }, []);

  if (!path) return <div className="aw-preview-placeholder">No course data to preview.</div>;

  return (
    <div className="aw-course-preview-container">
      {/* Sidebar / Syllabus Navigation */}
      <aside className="aw-preview-sidebar aw-glass-card">
        <h3 className="aw-sidebar-title">Course Syllabus</h3>
        <div className="aw-syllabus-list">
          {(path.sections || []).map((module, mIdx) => (
            <div key={module.id || mIdx} className="aw-syllabus-item">
              <span className="aw-syllabus-bullet"></span>
              <span className="aw-syllabus-text">{module.title || `Module ${mIdx + 1}`}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="aw-preview-main">
        {/* Hero Header */}
        <header className="aw-preview-hero aw-glass-card">
          <div className="aw-hero-meta">
            <span className={`aw-difficulty-badge ${path.difficulty?.toLowerCase()}`}>
              {path.difficulty || "Beginner"}
            </span>
            <span className="aw-duration-badge">⏱ {stats.totalMinutes} mins · 📚 {stats.totalLessons} lessons</span>
          </div>
          <h1 className="aw-hero-title">{path.title || "Untitled Course"}</h1>
          <p className="aw-hero-desc">{path.learnerGoal || "No description provided."}</p>
        </header>

        {/* Modules Grid */}
        <div className="aw-preview-modules">
          {(path.sections || []).map((module, mIdx) => (
            <div key={module.id || mIdx} className="aw-preview-module aw-glass-card">
              <div className="aw-module-header">
                <span className="aw-module-num">MODULE {mIdx + 1}</span>
                <h2 className="aw-module-title">{module.title || "Untitled Module"}</h2>
                {module.description && <p className="aw-module-desc">{module.description}</p>}
              </div>

              <div className="aw-lessons-grid">
                {(module.steps || []).map((lesson, lIdx) => {
                  const lessonKey = `${mIdx}-${lIdx}`;
                  const isExpanded = expandedLesson === lessonKey;
                  const hasVideo = !!lesson.video?.url;
                  const isQuiz = lesson.lessonType?.toLowerCase() === 'quiz';
                  const hasContent = hasVideo || isQuiz || lesson.whyThisMatters;

                  return (
                    <div key={lesson.id || lIdx} className={`aw-lesson-card${isExpanded ? ' aw-lesson-expanded' : ''}`}>
                      <div className="aw-lesson-row">
                        <div className="aw-lesson-icon-wrapper">
                          {getLessonIcon(lesson.lessonType)}
                        </div>
                        <div className="aw-lesson-details">
                          <h4 className="aw-lesson-title">{lesson.title || "Untitled Lesson"}</h4>
                          <span className="aw-lesson-type-badge">{lesson.lessonType || "Video"}</span>
                        </div>
                        <div className="aw-lesson-action">
                          <button
                            className={`aw-play-btn${isExpanded ? ' aw-play-active' : ''}${!hasContent ? ' aw-play-disabled' : ''}`}
                            onClick={() => hasContent && toggleLesson(lessonKey)}
                            disabled={!hasContent}
                            title={
                              !hasContent
                                ? "No content linked yet — attach a video URL in the Link stage"
                                : isExpanded
                                  ? "Collapse preview"
                                  : hasVideo
                                    ? "Preview video"
                                    : isQuiz
                                      ? "Preview quiz"
                                      : "Preview lesson details"
                            }
                          >
                            {isExpanded ? '▼' : '▶'}
                          </button>
                        </div>
                      </div>

                      {/* Expanded inline preview */}
                      {isExpanded && (
                        <div className="aw-lesson-preview-panel">
                          {hasVideo && (
                            <div className="aw-video-preview">
                              <iframe
                                src={normalizeVideoUrl(lesson.video.url)}
                                title={lesson.title || "Video preview"}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="aw-video-iframe"
                              />
                            </div>
                          )}

                          {isQuiz && lesson.quiz?.questions?.length > 0 && (
                            <div className="aw-quiz-preview">
                              <h5>📝 Quiz Preview ({lesson.quiz.questions.length} questions)</h5>
                              {lesson.quiz.questions.map((q, qIdx) => (
                                <div key={qIdx} className="aw-quiz-preview-q">
                                  <p className="aw-quiz-q-text">Q{qIdx + 1}. {q.text}</p>
                                  <ul className="aw-quiz-q-options">
                                    {(q.options || []).map((opt, oIdx) => (
                                      <li
                                        key={oIdx}
                                        className={oIdx === q.correctIndex ? 'aw-correct-option' : ''}
                                      >
                                        {opt} {oIdx === q.correctIndex && '✓'}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          )}

                          {lesson.whyThisMatters && (
                            <div className="aw-lesson-why">
                              <strong>💡 Why This Matters:</strong> {lesson.whyThisMatters}
                            </div>
                          )}

                          {lesson.commonMistake && (
                            <div className="aw-lesson-mistake">
                              <strong>⚠️ Common Mistake:</strong> {lesson.commonMistake}
                            </div>
                          )}

                          {!hasVideo && !isQuiz && !lesson.whyThisMatters && (
                            <p className="aw-no-preview">No preview content available for this lesson.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

/**
 * Normalize a video URL for embedding.
 * Converts standard YouTube watch URLs to embed URLs.
 */
function normalizeVideoUrl(url) {
  if (!url) return '';
  // Convert youtube.com/watch?v=ID to youtube.com/embed/ID
  const watchMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;
  // Already an embed URL or other source — return as-is
  return url;
}

// Helper to get icons for different lesson types
function getLessonIcon(type) {
  switch (type?.toLowerCase()) {
    case 'quiz': return '📝';
    case 'audio': return '🎧';
    case 'walkthrough': return '🚶';
    case 'video':
    default: return '🎬';
  }
}

export default CoursePreview;
