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
import CoursePreview from "./CoursePreview";
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
  const [viewMode, setViewMode] = useState("edit"); // "edit" or "preview"

  // Read any pending payload from Demand Dashboard (written to localStorage before navigation)
  const [pendingPayload] = useState(() => {
    try {
      const stored = localStorage.getItem("demand-start-authoring-payload");
      if (stored) {
        localStorage.removeItem("demand-start-authoring-payload");
        return JSON.parse(stored);
      }
    } catch { /* ignore */ }
    return null;
  });
  const [topicInput, setTopicInput] = useState(pendingPayload?.query || "");
  const [demandContext, setDemandContext] = useState(pendingPayload?.suggestion || null);

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

      {/* Saved Drafts */}
      {wb.savedDrafts.length > 0 && (
        <div className="aw-drafts-section">
          <h3>📂 Saved Drafts</h3>
          <div className="aw-drafts-list">
            {wb.savedDrafts.map((draft) => (
              <div key={draft.id} className="aw-draft-card">
                <div className="aw-draft-info">
                  <strong>{draft.title || draft.topic}</strong>
                  <span className="aw-draft-meta">
                    {draft.sectionCount} chapters · {draft.stepCount} steps · Stage: {draft.stage}
                  </span>
                  <span className="aw-draft-date">
                    Saved {new Date(draft.savedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="aw-draft-actions">
                  <button className="aw-btn aw-btn-primary aw-btn-sm" onClick={() => wb.loadDraft(draft.id)}>
                    ▶ Resume
                  </button>
                  <button className="aw-btn-icon aw-btn-danger" onClick={() => wb.deleteDraft(draft.id)} title="Delete draft">
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── Stage 2: Review ──────────────────────────────────────

  const renderReviewStage = () => (
    <div className="aw-review-stage">
      {/* Course-level metadata */}
      <div className="aw-review-header">
        <div className="aw-review-header-top">
          <input
            className="aw-course-title-input"
            value={wb.v2Path?.title || ""}
            onChange={(e) => wb.updateCourseField("title", e.target.value)}
            placeholder="Course Title"
          />
          <div className="aw-view-mode-toggle">
            <button
              className={`aw-toggle-btn ${viewMode === 'edit' ? 'active' : ''}`}
              onClick={() => setViewMode('edit')}
            >
              ✏️ Edit
            </button>
            <button
              className={`aw-toggle-btn ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => setViewMode('preview')}
            >
              👁 Preview
            </button>
          </div>
        </div>
        <p className="aw-subtitle">Edit modules and lessons. Reorder, add, or remove content.</p>

        {/* Auto-calculated stats bar */}
        <div className="aw-course-stats-bar">
          <span className="aw-stat-chip">{wb.courseStats.moduleCount} Modules</span>
          <span className="aw-stat-chip">{wb.courseStats.totalLessons} Lessons</span>
          <span className="aw-stat-chip">~{wb.courseStats.totalMinutes} min</span>
          {wb.courseStats.quizCount > 0 && <span className="aw-stat-chip">📝 {wb.courseStats.quizCount} Quizzes</span>}
        </div>

        {/* Difficulty dropdown */}
        <div className="aw-course-meta-row">
          <label className="aw-meta-label">
            Difficulty
            <select
              className="aw-select"
              value={wb.v2Path?.difficulty || "Beginner"}
              onChange={(e) => wb.updateCourseField("difficulty", e.target.value)}
            >
              {wb.DIFFICULTY_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>{lvl}</option>
              ))}
            </select>
          </label>
          <label className="aw-meta-label">
            Description
            <textarea
              className="aw-course-desc-input"
              value={wb.v2Path?.learnerGoal || ""}
              onChange={(e) => wb.updateCourseField("learnerGoal", e.target.value)}
              rows={2}
              placeholder="What will the student achieve?"
            />
          </label>
        </div>
      </div>

      {viewMode === "preview" ? (
        <CoursePreview
          path={wb.v2Path}
          stats={wb.courseStats}
          onUpdateField={wb.updateCourseField}
        />
      ) : (
        <>
          {/* Modules (sections) */}
          {(wb.v2Path?.sections || []).map((section, sIdx) => (
            <div key={section.id || sIdx} className="aw-glass-card aw-section-card">
              <div className="aw-module-header">
                <span className="aw-module-label">
                  Module {sIdx + 1} — {section.steps?.[0]?.title || "Untitled"}
                </span>
              </div>

              {/* Lessons (steps) */}
              {(section.steps || []).map((step, stIdx) => (
                <div key={step.id || stIdx} className="aw-glass-card aw-step-card">
                  <div className="aw-step-header">
                    <div className="aw-step-label-group">
                      <span className="aw-step-label">Lesson</span>
                      <span className="aw-step-number">{stIdx + 1}</span>
                    </div>
                    <input
                      className="aw-step-title-input"
                      value={step.title || ""}
                      onChange={(e) => wb.updateStepField(sIdx, stIdx, "title", e.target.value)}
                    />
                    {/* Lesson type dropdown */}
                    <select
                      className="aw-select aw-select-sm"
                      value={step.lessonType || "Video"}
                      onChange={(e) => wb.updateStepField(sIdx, stIdx, "lessonType", e.target.value)}
                    >
                      {wb.LESSON_TYPES.map((lt) => (
                        <option key={lt} value={lt}>{lt}</option>
                      ))}
                    </select>
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
                        title="Remove lesson"
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

                    {/* Quiz Builder — only shown when lessonType is Quiz */}
                    {step.lessonType === "Quiz" && (
                      <div className="aw-quiz-builder">
                        <h4>📝 Quiz Questions</h4>
                        {(step.quiz?.questions || []).map((q, qIdx) => (
                          <div key={qIdx} className="aw-glass-card aw-quiz-question-card">
                            <div className="aw-quiz-q-header">
                              <span className="aw-quiz-q-num">Q{qIdx + 1}</span>
                              <button
                                className="aw-btn-icon aw-btn-danger"
                                onClick={() => wb.removeQuizQuestion(sIdx, stIdx, qIdx)}
                                title="Remove question"
                              >✕</button>
                            </div>
                            <input
                              className="aw-quiz-q-input"
                              value={q.text || ""}
                              onChange={(e) => wb.updateQuizQuestion(sIdx, stIdx, qIdx, "text", e.target.value)}
                              placeholder="Question text..."
                            />
                            <div className="aw-quiz-options">
                              {(q.options || []).map((opt, oIdx) => (
                                <div key={oIdx} className="aw-quiz-option-row">
                                  <input
                                    type="radio"
                                    name={`q-${sIdx}-${stIdx}-${qIdx}`}
                                    checked={q.correctIndex === oIdx}
                                    onChange={() => wb.updateQuizQuestion(sIdx, stIdx, qIdx, "correctIndex", oIdx)}
                                    title="Mark as correct"
                                  />
                                  <input
                                    className="aw-quiz-option-input"
                                    value={opt}
                                    onChange={(e) => {
                                      const newOpts = [...(q.options || [])];
                                      newOpts[oIdx] = e.target.value;
                                      wb.updateQuizQuestion(sIdx, stIdx, qIdx, "options", newOpts);
                                    }}
                                    placeholder={`Option ${oIdx + 1}`}
                                  />
                                </div>
                              ))}
                            </div>
                            <input
                              className="aw-quiz-explanation-input"
                              value={q.explanation || ""}
                              onChange={(e) => wb.updateQuizQuestion(sIdx, stIdx, qIdx, "explanation", e.target.value)}
                              placeholder="Explanation (shown after answering)"
                            />
                          </div>
                        ))}
                        <div className="aw-quiz-actions" style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                          <button
                            className="aw-btn aw-btn-secondary aw-btn-sm"
                            onClick={() => wb.addQuizQuestion(sIdx, stIdx)}
                          >
                            + Add Question
                          </button>
                          <button
                            className="aw-glow-btn aw-glow-btn-purple aw-btn-sm"
                            onClick={() => wb.generateQuizForStep(sIdx, stIdx)}
                            disabled={wb.generatingQuizFor === `${sIdx}-${stIdx}`}
                          >
                            {wb.generatingQuizFor === `${sIdx}-${stIdx}` ? "✨ Generating..." : "✨ Auto-Generate Quiz"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Add Lesson button */}
              <div className="aw-add-lesson-row">
                <select className="aw-select aw-select-sm" id={`add-lesson-type-${sIdx}`} defaultValue="Video">
                  {wb.LESSON_TYPES.map((lt) => (
                    <option key={lt} value={lt}>{lt}</option>
                  ))}
                </select>
                <button
                  className="aw-btn aw-btn-secondary aw-btn-sm"
                  onClick={() => {
                    const sel = document.getElementById(`add-lesson-type-${sIdx}`);
                    wb.addLesson(sIdx, sel?.value || "Video");
                  }}
                >
                  + Add Lesson
                </button>
              </div>
            </div>
          ))}

          <div className="aw-review-footer">
            <button className="aw-btn aw-btn-secondary" onClick={wb.saveDraft}>
              💾 Save Draft
            </button>
            <button className="aw-btn aw-btn-primary" onClick={wb.generateBriefs} disabled={wb.loading}>
              {wb.loading ? "Generating Briefs..." : "🎬 Generate Recording Briefs →"}
            </button>
          </div>
        </>
      )}
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
          <input
            className="aw-brief-title-input"
            value={brief.stepTitle || ""}
            onChange={(e) => wb.updateBriefField(idx, "stepTitle", e.target.value)}
          />
          <div className="aw-brief-meta">
            <select
              className="aw-brief-tag-input"
              value={brief.skillLevel || "Beginner"}
              onChange={(e) => wb.updateBriefField(idx, "skillLevel", e.target.value)}
              title="Skill level"
            >
              {wb.DIFFICULTY_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>{lvl}</option>
              ))}
            </select>
            <input
              className="aw-brief-tag-input"
              value={brief.targetLength || ""}
              onChange={(e) => wb.updateBriefField(idx, "targetLength", e.target.value)}
              title="Target length"
            />
            <input
              className="aw-brief-tag-input"
              value={brief.position || ""}
              onChange={(e) => wb.updateBriefField(idx, "position", e.target.value)}
              title="Position"
            />
          </div>

          {brief.requiredDemonstrations?.length > 0 && (
            <div className="aw-brief-section">
              <h4>📹 Required Demonstrations</h4>
              <ol>
                {brief.requiredDemonstrations.map((d, i) => (
                  <li key={i}>
                    <input
                      className="aw-brief-list-input"
                      value={d}
                      onChange={(e) => wb.updateBriefListItem(idx, "requiredDemonstrations", i, e.target.value)}
                    />
                  </li>
                ))}
              </ol>
            </div>
          )}

          {brief.talkingPoints?.length > 0 && (
            <div className="aw-brief-section">
              <h4>🗣️ Talking Points</h4>
              <ul>
                {brief.talkingPoints.map((p, i) => (
                  <li key={i}>
                    <input
                      className="aw-brief-list-input"
                      value={p}
                      onChange={(e) => wb.updateBriefListItem(idx, "talkingPoints", i, e.target.value)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {brief.editorSetup?.length > 0 && (
            <div className="aw-brief-section">
              <h4>🖥️ Editor Setup</h4>
              <ul>
                {brief.editorSetup.map((s, i) => (
                  <li key={i}>
                    <input
                      className="aw-brief-list-input"
                      value={s}
                      onChange={(e) => wb.updateBriefListItem(idx, "editorSetup", i, e.target.value)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="aw-brief-section aw-script-notes">
            <h4>📝 Script Notes</h4>
            <textarea
              className="aw-brief-notes-input"
              value={brief.scriptNotes || ""}
              onChange={(e) => wb.updateBriefField(idx, "scriptNotes", e.target.value)}
              rows={3}
            />
          </div>
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
            <span className="aw-stat-label">Modules</span>
          </div>
          <div className="aw-export-stat">
            <span className="aw-stat-value">{totalSteps}</span>
            <span className="aw-stat-label">Lessons</span>
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
