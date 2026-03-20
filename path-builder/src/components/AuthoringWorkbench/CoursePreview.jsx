import React from 'react';

/**
 * CoursePreview.jsx
 *
 * A learner-centric preview of the course structure.
 * Redesigned with a premium "Glassmorphism" syllabus layout.
 */
const CoursePreview = ({ path, stats }) => {
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
                {(module.steps || []).map((lesson, lIdx) => (
                  <div key={lesson.id || lIdx} className="aw-lesson-card">
                    <div className="aw-lesson-icon-wrapper">
                      {getLessonIcon(lesson.lessonType)}
                    </div>
                    <div className="aw-lesson-details">
                      <h4 className="aw-lesson-title">{lesson.title || "Untitled Lesson"}</h4>
                      <span className="aw-lesson-type-badge">{lesson.lessonType || "Video"}</span>
                    </div>
                    <div className="aw-lesson-action">
                      <button className="aw-play-btn">▶</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

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
