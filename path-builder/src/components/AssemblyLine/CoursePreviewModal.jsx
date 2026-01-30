/**
 * CoursePreviewModal Component
 *
 * Modal for previewing and downloading AI-generated courses
 */
import { useState } from "react";
import "./CoursePreviewModal.css";

function CoursePreviewModal({
  course,
  isGenerating,
  progress,
  error,
  onClose,
  onDownload,
  onRegenerate,
}) {
  const [activeTab, setActiveTab] = useState("overview");

  if (!course && !isGenerating) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="course-preview-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{isGenerating ? "✨ Generating Course..." : "📚 Course Preview"}</h2>
          <button className="btn-close" onClick={onClose}>
            ×
          </button>
        </header>

        {isGenerating && (
          <div className="generation-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="progress-text">{progress.step}</p>
          </div>
        )}

        {error && (
          <div className="error-message">
            <span>⚠️ {error}</span>
            <button onClick={onRegenerate}>Try Again</button>
          </div>
        )}

        {course && !isGenerating && (
          <>
            <nav className="modal-tabs">
              <button
                className={activeTab === "overview" ? "active" : ""}
                onClick={() => setActiveTab("overview")}
              >
                Overview
              </button>
              <button
                className={activeTab === "objectives" ? "active" : ""}
                onClick={() => setActiveTab("objectives")}
              >
                Objectives
              </button>
              <button
                className={activeTab === "content" ? "active" : ""}
                onClick={() => setActiveTab("content")}
              >
                Content ({course.totalVideos})
              </button>
            </nav>

            <div className="modal-content">
              {activeTab === "overview" && (
                <div className="tab-overview">
                  <div className="course-header">
                    <h3>{course.title}</h3>
                    <div className="course-meta">
                      <span className={`badge difficulty-${course.difficulty}`}>
                        {course.difficulty}
                      </span>
                      <span className="duration">⏱️ {course.totalDuration}</span>
                      <span className="videos">📹 {course.totalVideos} videos</span>
                      {course.aiGenerated && <span className="ai-badge">✨ AI Generated</span>}
                    </div>
                  </div>
                  <p className="course-description">{course.description}</p>

                  {course.prerequisites?.length > 0 && (
                    <div className="prerequisites">
                      <h4>Prerequisites</h4>
                      <ul>
                        {course.prerequisites.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "objectives" && (
                <div className="tab-objectives">
                  <h4>Learning Objectives</h4>
                  <p className="objectives-intro">
                    By the end of this course, learners will be able to:
                  </p>
                  <ol className="objectives-list">
                    {course.learningObjectives?.map((obj, i) => (
                      <li key={i}>{obj}</li>
                    ))}
                  </ol>
                </div>
              )}

              {activeTab === "content" && (
                <div className="tab-content">
                  <h4>Course Content</h4>
                  <ol className="video-list">
                    {course.videos?.map((video, i) => (
                      <li key={video.id || i} className="video-item">
                        <span className="video-number">{i + 1}</span>
                        <div className="video-info">
                          <span className="video-title">{video.title}</span>
                          <span className="video-duration">{video.duration}</span>
                        </div>
                        {video.quiz && <span className="quiz-badge">📝 Quiz</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            <footer className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-secondary" onClick={onRegenerate}>
                🔄 Regenerate
              </button>
              <button className="btn btn-primary" onClick={onDownload}>
                📦 Download SCORM Package
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

export default CoursePreviewModal;
