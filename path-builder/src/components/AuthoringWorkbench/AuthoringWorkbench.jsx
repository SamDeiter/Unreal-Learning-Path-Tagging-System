/**
 * AuthoringWorkbench.jsx — Instructor Review UI
 *
 * Five-stage workflow for creating production-ready course content:
 *   1. Plan — Enter topic, AI generates outline
 *   2. Review — Edit chapters and steps
 *   3. Brief — Generate recording briefs
 *   4. Link — Attach video URLs
 *   5. Export — Download SCORM or V3 viewer
 */

import { useState, useEffect } from "react";
import useAuthoringWorkbench, { AUTHORING_STAGES } from "../../hooks/useAuthoringWorkbench";
import "./AuthoringWorkbench.css";

// ── Stage Labels ───────────────────────────────────────────

const STAGE_META = {
  [AUTHORING_STAGES.PLAN]: { label: "Plan", icon: "📋", description: "Enter a topic and generate an AI course outline" },
  [AUTHORING_STAGES.REVIEW]: { label: "Review", icon: "✏️", description: "Edit chapters, steps, and teaching fields" },
  [AUTHORING_STAGES.BRIEF]: { label: "Brief", icon: "🎬", description: "Generate recording briefs for instructors" },
  [AUTHORING_STAGES.LINK]: { label: "Link", icon: "🔗", description: "Attach video URLs to each step" },
  [AUTHORING_STAGES.EXPORT]: { label: "Export", icon: "📦", description: "Download as SCORM 1.2 or V3 viewer" },
};

export default function AuthoringWorkbench() {
  const wb = useAuthoringWorkbench();
  const [topicInput, setTopicInput] = useState("");
  const [demandContext, setDemandContext] = useState(null);

  // Listen for "Start Brief" navigation from Demand Dashboard
  useEffect(() => {
    const handler = (e) => {
      const { query, suggestion } = e.detail || {};
      if (query) setTopicInput(query);
      if (suggestion) setDemandContext(suggestion);
    };
    window.addEventListener("demand-start-authoring", handler);
    return () => window.removeEventListener("demand-start-authoring", handler);
  }, []);

  // ── Stepper Header ───────────────────────────────────────

  const renderStepper = () => (
    <div className="aw-stepper" role="navigation" aria-label="Authoring stages">
      {wb.stageOrder.map((stageKey, idx) => {
        const meta = STAGE_META[stageKey];
        const isCurrent = stageKey === wb.stage;
        const isCompleted = idx < wb.currentStageIndex;
        const isClickable = idx <= wb.currentStageIndex;

        return (
          <button
            key={stageKey}
            className={`aw-stepper-step ${isCurrent ? "active" : ""} ${isCompleted ? "completed" : ""}`}
            onClick={() => isClickable && wb.goToStage(stageKey)}
            disabled={!isClickable}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span className="aw-step-icon">{isCompleted ? "✅" : meta.icon}</span>
            <span className="aw-step-label">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );

  // ── Progress Bar ─────────────────────────────────────────

  const renderProgress = () => {
    if (!wb.loading || !wb.progress.total) return null;
    const pct = Math.round((wb.progress.current / wb.progress.total) * 100);
    return (
      <div className="aw-progress">
        <div className="aw-progress-bar" style={{ width: `${pct}%` }} />
        <span className="aw-progress-label">{wb.progress.label} ({pct}%)</span>
      </div>
    );
  };

  // ── Stage 1: Plan ────────────────────────────────────────

  const renderPlanStage = () => (
    <div className="aw-plan-stage">
      <h2>What should we teach?</h2>
      <p className="aw-subtitle">Enter a topic and we'll generate a structured course outline using AI.</p>

      {demandContext && (
        <div className="aw-demand-banner">
          <span className="aw-demand-badge">🔥 High Demand</span>
          <span className="aw-demand-detail">
            Score: {demandContext.demandScore}/100 · Gap: −{demandContext.gap}% · {demandContext.category}
          </span>
          <button className="aw-demand-dismiss" onClick={() => setDemandContext(null)} title="Dismiss">✕</button>
        </div>
      )}

      <div className="aw-topic-input-row">
        <input
          id="authoring-topic-input"
          type="text"
          className="aw-topic-input"
          placeholder="e.g., How to set up AI patrol with State Trees in UE5"
          value={topicInput}
          onChange={(e) => setTopicInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && wb.generatePlan(topicInput)}
          disabled={wb.loading}
        />
        <button
          id="authoring-generate-btn"
          className="aw-btn aw-btn-primary"
          onClick={() => wb.generatePlan(topicInput)}
          disabled={wb.loading || !topicInput.trim()}
        >
          {wb.loading ? "Generating..." : "🚀 Generate Outline"}
        </button>
      </div>
    </div>
  );

  // ── Stage 2: Review ──────────────────────────────────────

  const renderReviewStage = () => (
    <div className="aw-review-stage">
      <div className="aw-review-header">
        <h2>{wb.v2Path?.title || "Course Outline"}</h2>
        <p className="aw-subtitle">Edit steps, reorder, or remove content before generating briefs.</p>
      </div>

      {(wb.v2Path?.sections || []).map((section, sIdx) => (
        <div key={section.id || sIdx} className="aw-section-card">
          <h3 className="aw-section-title">
            {section.title || section.phase || `Chapter ${sIdx + 1}`}
          </h3>
          {section.purpose && <p className="aw-section-purpose">{section.purpose}</p>}

          {(section.steps || []).map((step, stIdx) => (
            <div key={step.id || stIdx} className="aw-step-card">
              <div className="aw-step-header">
                <span className="aw-step-number">{stIdx + 1}</span>
                <input
                  className="aw-step-title-input"
                  value={step.title || ""}
                  onChange={(e) => wb.updateStepField(sIdx, stIdx, "title", e.target.value)}
                />
                <div className="aw-step-actions">
                  <button
                    className="aw-btn-icon"
                    onClick={() => wb.reorderStep(sIdx, stIdx, -1)}
                    disabled={stIdx === 0}
                    title="Move up"
                  >▲</button>
                  <button
                    className="aw-btn-icon"
                    onClick={() => wb.reorderStep(sIdx, stIdx, 1)}
                    disabled={stIdx === section.steps.length - 1}
                    title="Move down"
                  >▼</button>
                  <button
                    className="aw-btn-icon aw-btn-danger"
                    onClick={() => wb.removeStep(sIdx, stIdx)}
                    title="Remove step"
                  >✕</button>
                </div>
              </div>

              <div className="aw-step-fields">
                <label>
                  <strong>💡 Why This Matters</strong>
                  <textarea
                    value={step.whyThisMatters || ""}
                    onChange={(e) => wb.updateStepField(sIdx, stIdx, "whyThisMatters", e.target.value)}
                    rows={2}
                  />
                </label>
                <label>
                  <strong>⚠️ Common Mistake</strong>
                  <textarea
                    value={step.commonMistake || ""}
                    onChange={(e) => wb.updateStepField(sIdx, stIdx, "commonMistake", e.target.value)}
                    rows={2}
                  />
                </label>
                {step.video && (
                  <div className="aw-step-video-tag">
                    🎬 Video: {step.video.title || "Linked"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="aw-review-footer">
        <button className="aw-btn aw-btn-primary" onClick={wb.generateBriefs} disabled={wb.loading}>
          {wb.loading ? "Generating Briefs..." : "🎬 Generate Recording Briefs →"}
        </button>
      </div>
    </div>
  );

  // ── Stage 3: Brief ───────────────────────────────────────

  const renderBriefStage = () => (
    <div className="aw-brief-stage">
      <div className="aw-brief-header">
        <h2>Recording Briefs</h2>
        <button
          className="aw-btn aw-btn-secondary"
          onClick={wb.downloadBriefMarkdown}
          disabled={!wb.briefMarkdown}
        >
          📥 Download as Markdown
        </button>
      </div>

      {wb.briefs.map((brief, idx) => brief && (
        <div key={idx} className="aw-brief-card">
          <h3>{brief.stepTitle}</h3>
          <div className="aw-brief-meta">
            <span className="aw-brief-tag">{brief.skillLevel}</span>
            <span className="aw-brief-tag">{brief.targetLength}</span>
            <span className="aw-brief-tag">{brief.position}</span>
          </div>

          {brief.requiredDemonstrations?.length > 0 && (
            <div className="aw-brief-section">
              <h4>📹 Required Demonstrations</h4>
              <ol>
                {brief.requiredDemonstrations.map((d, i) => <li key={i}>{d}</li>)}
              </ol>
            </div>
          )}

          {brief.talkingPoints?.length > 0 && (
            <div className="aw-brief-section">
              <h4>🗣️ Talking Points</h4>
              <ul>
                {brief.talkingPoints.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}

          {brief.editorSetup?.length > 0 && (
            <div className="aw-brief-section">
              <h4>🖥️ Editor Setup</h4>
              <ul>
                {brief.editorSetup.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {brief.scriptNotes && (
            <div className="aw-brief-section aw-script-notes">
              <h4>📝 Script Notes</h4>
              <p>{brief.scriptNotes}</p>
            </div>
          )}
        </div>
      ))}

      <div className="aw-brief-footer">
        <button className="aw-btn aw-btn-primary" onClick={wb.goNext}>
          🔗 Link Videos →
        </button>
      </div>
    </div>
  );

  // ── Stage 4: Link ────────────────────────────────────────

  const renderLinkStage = () => (
    <div className="aw-link-stage">
      <h2>Link Videos to Steps</h2>
      <p className="aw-subtitle">Paste video URLs for each step. Steps without videos will export as documentation steps.</p>

      {(wb.v2Path?.sections || []).map((section, sIdx) => (
        <div key={section.id || sIdx} className="aw-link-section">
          <h3>{section.title || `Chapter ${sIdx + 1}`}</h3>
          {(section.steps || []).map((step, stIdx) => (
            <div key={step.id || stIdx} className="aw-link-row">
              <span className="aw-link-title">{step.title || "Untitled"}</span>
              <input
                className="aw-link-url-input"
                type="url"
                placeholder="https://youtube.com/embed/..."
                value={step.video?.url || ""}
                onChange={(e) => wb.linkVideo(sIdx, stIdx, e.target.value, step.title)}
              />
              {step.video?.url && <span className="aw-link-check">✅</span>}
            </div>
          ))}
        </div>
      ))}

      <div className="aw-link-footer">
        <button className="aw-btn aw-btn-primary" onClick={wb.goNext}>
          📦 Export →
        </button>
      </div>
    </div>
  );

  // ── Stage 5: Export ──────────────────────────────────────

  const renderExportStage = () => {
    const totalSteps = (wb.v2Path?.sections || []).reduce(
      (sum, s) => sum + (s.steps?.length || 0), 0
    );
    const linkedSteps = (wb.v2Path?.sections || []).reduce(
      (sum, s) => sum + (s.steps || []).filter((st) => st.video?.url).length, 0
    );

    return (
      <div className="aw-export-stage">
        <h2>Export Your Course</h2>

        <div className="aw-export-summary">
          <div className="aw-export-stat">
            <span className="aw-stat-value">{(wb.v2Path?.sections || []).length}</span>
            <span className="aw-stat-label">Chapters</span>
          </div>
          <div className="aw-export-stat">
            <span className="aw-stat-value">{totalSteps}</span>
            <span className="aw-stat-label">Steps</span>
          </div>
          <div className="aw-export-stat">
            <span className="aw-stat-value">{linkedSteps}</span>
            <span className="aw-stat-label">Videos Linked</span>
          </div>
          <div className="aw-export-stat">
            <span className="aw-stat-value">{wb.briefs.filter(Boolean).length}</span>
            <span className="aw-stat-label">Briefs Ready</span>
          </div>
        </div>

        <div className="aw-export-options">
          <button
            id="authoring-export-scorm"
            className="aw-export-card"
            onClick={wb.exportScorm}
            disabled={wb.loading}
          >
            <span className="aw-export-icon">📦</span>
            <span className="aw-export-title">SCORM 1.2 Package</span>
            <span className="aw-export-desc">For LMS deployment (Moodle, Canvas, etc.)</span>
          </button>

          <button
            id="authoring-export-v3"
            className="aw-export-card"
            onClick={wb.exportV3}
            disabled={wb.loading}
          >
            <span className="aw-export-icon">🌐</span>
            <span className="aw-export-title">Preview in Viewer</span>
            <span className="aw-export-desc">Opens your course in the V3 viewer in a new tab</span>
          </button>

          {wb.briefMarkdown && (
            <button
              id="authoring-export-brief"
              className="aw-export-card"
              onClick={wb.downloadBriefMarkdown}
            >
              <span className="aw-export-icon">📝</span>
              <span className="aw-export-title">Recording Briefs (Markdown)</span>
              <span className="aw-export-desc">Instructor recording guide document</span>
            </button>
          )}
        </div>

        <div className="aw-export-footer">
          <button className="aw-btn aw-btn-secondary" onClick={wb.reset}>
            🔄 Start New Course
          </button>
        </div>
      </div>
    );
  };

  // ── Main Render ──────────────────────────────────────────

  return (
    <div className="authoring-workbench" id="authoring-workbench">
      {renderStepper()}
      {renderProgress()}

      {wb.error && (
        <div className="aw-error" role="alert">
          ⚠️ {wb.error}
        </div>
      )}

      <div className="aw-stage-content">
        {wb.stage === AUTHORING_STAGES.PLAN && renderPlanStage()}
        {wb.stage === AUTHORING_STAGES.REVIEW && renderReviewStage()}
        {wb.stage === AUTHORING_STAGES.BRIEF && renderBriefStage()}
        {wb.stage === AUTHORING_STAGES.LINK && renderLinkStage()}
        {wb.stage === AUTHORING_STAGES.EXPORT && renderExportStage()}
      </div>
    </div>
  );
}
