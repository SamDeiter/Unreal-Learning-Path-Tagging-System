/**
 * WebPlayerPreview — In-app preview of a web-playable learning path.
 *
 * Renders a full-screen overlay with sidebar navigation and step content.
 * Mirrors the SCORM viewer experience but runs as a React component.
 * Tracks progress via localStorage for resume capability.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import {
  prepareStepData,
  getProgress,
  markStepComplete,
  generatePathId,
  formatTime,
  getCategoryClass,
} from "../../services/webPlayerService";
import "./WebPlayerPreview.css";

export default function WebPlayerPreview({
  pathResult,
  courses,
  onClose,
}) {
  const pathTitle = pathResult?.query
    ? `UE5 Learning Path: ${pathResult.query.substring(0, 60)}`
    : "Learning Path";

  // Stable path ID for progress tracking
  const pathId = useMemo(
    () => generatePathId(pathTitle),
    [pathTitle]
  );

  // Enrich steps with video data from course library (same as SCORM preview)
  const enrichedSteps = useMemo(() => {
    if (!pathResult?.path) return [];
    const steps = pathResult.path.map((step) => {
      const seg = step.segment || {};
      if (seg.videoUrl || seg.drive_id) return step;

      const matchedCourse = (courses || []).find(
        (c) =>
          (c.code && step.code && c.code === step.code) ||
          (c.title && step.title && c.title === step.title) ||
          (c.title && step.title && step.title.includes(c.title))
      );
      if (!matchedCourse) return step;

      const firstVideo = matchedCourse.videos?.[0];
      const driveId = firstVideo?.drive_id || "";
      const videoUrl =
        matchedCourse._url ||
        (driveId
          ? `https://drive.google.com/file/d/${driveId}/view`
          : "");

      return {
        ...step,
        videos: step.videos || matchedCourse.videos,
        segment: {
          ...seg,
          videoUrl,
          drive_id: driveId,
          videoTitle:
            seg.videoTitle ||
            firstVideo?.title ||
            firstVideo?.name ||
            matchedCourse.title ||
            "",
        },
      };
    });
    return steps;
  }, [pathResult, courses]);

  // Process steps into display-ready data
  const stepData = useMemo(
    () => prepareStepData(enrichedSteps, pathResult?.bridges || []),
    [enrichedSteps, pathResult?.bridges]
  );

  // State
  const [activeStep, setActiveStep] = useState(0);
  const [completed, setCompleted] = useState(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load saved progress on mount
  useEffect(() => {
    const progress = getProgress(pathId);
    setCompleted(progress.completedSteps);
    if (progress.lastStep > 0 && progress.lastStep < stepData.length) {
      setActiveStep(progress.lastStep);
    }
  }, [pathId, stepData.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && activeStep < stepData.length - 1) {
        handleNext();
      }
      if (e.key === "ArrowLeft" && activeStep > 0) {
        setActiveStep((prev) => prev - 1);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, stepData.length]);

  const handleNext = useCallback(() => {
    const progress = markStepComplete(pathId, activeStep);
    setCompleted(new Set(progress.completedSteps));
    if (activeStep < stepData.length - 1) {
      setActiveStep((prev) => prev + 1);
    }
  }, [pathId, activeStep, stepData.length]);

  const handlePrev = useCallback(() => {
    if (activeStep > 0) setActiveStep((prev) => prev - 1);
  }, [activeStep]);

  const handleStepClick = useCallback((idx) => {
    setActiveStep(idx);
  }, []);

  // Current step data
  const current = stepData[activeStep];
  if (!current) return null;

  const completedCount = completed.size;
  const progressPct = stepData.length
    ? Math.round((completedCount / stepData.length) * 100)
    : 0;

  return (
    <div className="wp-overlay">
      {/* ── Sidebar ── */}
      <div className={`wp-sidebar ${sidebarCollapsed ? "wp-sidebar-collapsed" : ""}`}>
        <div className="wp-sidebar-header">
          <h2 className="wp-sidebar-title">{pathTitle}</h2>
          <button
            className="wp-sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? "→" : "←"}
          </button>
        </div>

        {!sidebarCollapsed && (
          <>
            {/* Progress bar */}
            <div className="wp-progress">
              <div className="wp-progress-bar">
                <div
                  className="wp-progress-fill"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="wp-progress-text">
                {completedCount}/{stepData.length} completed
              </span>
            </div>

            {/* Step list */}
            <nav className="wp-nav">
              {stepData.map((step, idx) => (
                <button
                  key={idx}
                  className={`wp-nav-item ${idx === activeStep ? "wp-nav-active" : ""} ${completed.has(idx) ? "wp-nav-done" : ""}`}
                  onClick={() => handleStepClick(idx)}
                >
                  <span className="wp-nav-num">
                    {completed.has(idx) ? "✓" : idx + 1}
                  </span>
                  <span className="wp-nav-label">{step.title}</span>
                </button>
              ))}
            </nav>
          </>
        )}
      </div>

      {/* ── Main Content ── */}
      <div className="wp-main">
        {/* Toolbar */}
        <div className="wp-toolbar">
          <div className="wp-toolbar-left">
            <button className="wp-back-btn" onClick={onClose} title="Back to Path Builder">
              ← Back to Builder
            </button>
            <span className="wp-badge">🌐 Web Player</span>
            <span className="wp-breadcrumb">
              Step {activeStep + 1} of {stepData.length}
            </span>
          </div>
          <button className="wp-close-btn" onClick={onClose} title="Close preview">
            ✕
          </button>
        </div>

        {/* Step content */}
        <div className="wp-content">
          <h1 className="wp-step-title">{current.title}</h1>

          {/* Bridge narration */}
          {current.bridgeText && (
            <div className="wp-bridge">
              <strong>Connection:</strong> {current.bridgeText}
            </div>
          )}

          {/* Video embed */}
          {current.video && (
            <div className="wp-video-section">
              <h2>🎬 Video Reference</h2>
              <div className="wp-video-embed">
                {current.video.driveId ? (
                  <iframe
                    src={`https://drive.google.com/file/d/${current.video.driveId}/preview`}
                    allow="autoplay"
                    allowFullScreen
                    title={current.video.videoTitle || current.title}
                  />
                ) : current.video.youtubeId ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${current.video.youtubeId}?rel=0&modestbranding=1${current.video.startSec ? `&start=${current.video.startSec}` : ""}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={current.video.videoTitle || current.title}
                  />
                ) : null}
              </div>
              <div className="wp-video-meta">
                {current.video.videoTitle && (
                  <span>{current.video.videoTitle}</span>
                )}
                {(current.video.startSec > 0 || current.video.endSec > 0) && (
                  <span className="wp-timestamp">
                    ⏱ {formatTime(current.video.startSec)} –{" "}
                    {formatTime(current.video.endSec)}
                  </span>
                )}
                {current.video.driveId && (
                  <a
                    href={`https://drive.google.com/file/d/${current.video.driveId}/view`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open in Drive ↗
                  </a>
                )}
                {current.video.youtubeId && (
                  <a
                    href={`https://www.youtube.com/watch?v=${current.video.youtubeId}${current.video.startSec ? `&t=${current.video.startSec}` : ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Watch on YouTube ↗
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Step card */}
          <div className="wp-step-card">
            <div className="wp-step-meta">
              <span className={`wp-category-badge ${getCategoryClass(current.category)}`}>
                {current.category}
              </span>
              {current.source && <span>Source: {current.source}</span>}
            </div>
            {current.summary ? (
              <p className="wp-step-summary">{current.summary}</p>
            ) : (
              <p className="wp-no-content">
                <em>No content summary available for this step.</em>
              </p>
            )}
          </div>

          {/* Navigation buttons */}
          <div className="wp-nav-buttons">
            <button
              className="wp-nav-btn wp-nav-secondary"
              onClick={handlePrev}
              disabled={activeStep === 0}
            >
              ← Previous
            </button>
            <button
              className="wp-nav-btn wp-nav-primary"
              onClick={handleNext}
            >
              {activeStep === stepData.length - 1
                ? "✅ Complete Path"
                : "Complete & Continue →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

WebPlayerPreview.propTypes = {
  pathResult: PropTypes.object.isRequired,
  courses: PropTypes.array,
  onClose: PropTypes.func.isRequired,
};
