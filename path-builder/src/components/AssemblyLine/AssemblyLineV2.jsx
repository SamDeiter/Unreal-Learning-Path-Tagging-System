import React, { useState, useMemo } from "react";
import { usePath } from "../../context/PathContext";
import { optimizePathOrder } from "../../utils/generationEngine";

import { classifySegment, getBloomBadge } from "../../services/bloomClassifier";
import { getDisplayName } from "../../services/topicNameService";
import { getLoadSummary, interleaveCourses } from "../../services/cognitiveLoadEngine";
import SmartEmptyState from "./SmartEmptyState";
import StepInspector from "./StepInspector";
import AssemblyTrace from "./AssemblyTrace";

import "../PathBuilderV2Mockup/PathBuilderV2Mockup.css"; // Reuse V2 layout styles directly

function getContentType(course) {
  const code = course.code || "";
  const source = course.source || course.segment?.source || "";
  const type = course.type || course.segment?.type || "";

  if (source === "ai_generated" || code.startsWith("ai-")) return { emoji: "🤖", typeStr: "ai" };
  if (code.startsWith("bespoke-")) return { emoji: "🎯", typeStr: "ai" };
  if ((course.videos?.length || 0) > 0 || course.video_count > 0 || type === "video" || source === "video" || course.has_scorm)
    return { emoji: "🎬", typeStr: "video" };
  if (code.startsWith("doc_") || code.startsWith("doc-") || source === "epic_docs")
    return { emoji: "📄", typeStr: "doc" };
  return { emoji: "📄", typeStr: "doc" };
}

export default function AssemblyLineV2() {
  const {
    courses,
    modules,
    ungroupedCourses,
    addCourse,
    removeCourse,
    reorderCourses,
    clearPath,
    learningIntent,
    pathStats,
    workflowStage,
    addModule,
    moveCourseToModule,
    toggleModuleFlag,
    addAssessment,
    addTransition,
    updateCourseMeta,
    setModuleVerification,
  } = usePath();

  const [activeModule, setActiveModule] = useState(modules[0]?.id || "ungrouped");
  const [selectedStepCode, setSelectedStepCode] = useState(null);
  const [activePanel, setActivePanel] = useState("inspector"); // "inspector" or "trace"

  // Basic drag functionality (to move between modules or reorder)
  const handleDragStart = (e, courseCode, sourceModuleId) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ courseCode, sourceModuleId }));
    e.currentTarget.classList.add("dragging");
  };

  const handleDragEnd = (e) => e.currentTarget.classList.remove("dragging");
  const handleDragOver = (e) => { e.preventDefault(); e.currentTarget.classList.add("drag-over"); };
  const handleDragLeave = (e) => e.currentTarget.classList.remove("drag-over");

  const handleDropOnModule = (e, targetModuleId) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
    // Check if this is a new course from the library
    const courseData = e.dataTransfer.getData("application/x-course-data");
    if (courseData) {
      try {
        const course = JSON.parse(courseData);
        addCourse(course);
        if (targetModuleId) {
          // Small delay since addCourse + moveCourseToModule are separate dispatches
          setTimeout(() => moveCourseToModule(course.code, targetModuleId), 0);
        }
      } catch { /* ignore malformed data */ }
      return;
    }
    // Otherwise it's an internal reorder between modules
    const internalData = e.dataTransfer.getData("text/plain");
    if (internalData) {
      const data = JSON.parse(internalData);
      if (data.sourceModuleId !== targetModuleId) {
        moveCourseToModule(data.courseCode, targetModuleId);
      }
    }
  };

  // Handle drop on the dropzone elements ("+ Drop Course Here")
  const handleDropzoneOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add("drag-over");
  };
  const handleDropzoneLeave = (e) => {
    e.currentTarget.classList.remove("drag-over");
  };
  const handleDropOnZone = (e, targetModuleId) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("drag-over");
    const courseData = e.dataTransfer.getData("application/x-course-data");
    if (courseData) {
      try {
        const course = JSON.parse(courseData);
        addCourse(course);
        if (targetModuleId) {
          setTimeout(() => moveCourseToModule(course.code, targetModuleId), 0);
        }
      } catch { /* ignore malformed data */ }
      return;
    }
    // Internal reorder
    const internalData = e.dataTransfer.getData("text/plain");
    if (internalData) {
      const data = JSON.parse(internalData);
      if (data.sourceModuleId !== targetModuleId) {
        moveCourseToModule(data.courseCode, targetModuleId);
      }
    }
  };

  const handleOptimize = () => {
    const baseSorted = optimizePathOrder(courses);
    let finalOrder;
    try {
      const interleaved = interleaveCourses(baseSorted);
      finalOrder = interleaved.map(({ cognitiveLoad: _cl, ...rest }) => rest);
    } catch {
      finalOrder = baseSorted;
    }
    const introPattern = /\bintroduction\s+to\s+unreal\s*(engine|editor)?\b/i;
    const introIdx = finalOrder.findIndex((c) => introPattern.test(c.title || ""));
    if (introIdx > 0) {
      const [intro] = finalOrder.splice(introIdx, 1);
      finalOrder.unshift(intro);
    }
    reorderCourses(finalOrder);
  };

  const selectedCourse = useMemo(() => 
    courses.find(c => c.code === selectedStepCode), 
    [courses, selectedStepCode]
  );

  const loadSummary = useMemo(() => courses.length > 0 ? getLoadSummary(courses) : null, [courses]);

  if (courses.length === 0) {
    return (
      <div className="pb-v2-canvas">
        <SmartEmptyState
          goal={learningIntent?.primaryGoal}
          skillLevel={learningIntent?.skillLevel}
          onBrowseLibrary={() => {
            window.dispatchEvent(new CustomEvent("focus-left-panel", { detail: { mode: "browse" } }));
          }}
          onBuildBySkill={(skill) => {
            window.dispatchEvent(new CustomEvent("focus-left-panel", { detail: { mode: "skill", skill } }));
          }}
        />
      </div>
    );
  }

  const renderStep = (course, index, modId) => {
    const ct = getContentType(course);
    const displayName = getDisplayName(course);
    const duration = (course.duration_minutes || course.segment?.duration_minutes || 0) + " mins";
    const source = course.source || "Library";
    const tags = course.tags?.topics || [];
    
    // Outcome from Bloom
    const bloom = classifySegment(course.title || "", course.gemini_enriched?.one_sentence_summary || "");
    const bloomBadge = getBloomBadge(bloom.level);

    return (
      <div 
        key={course.code} 
        className={`step-card type-${ct.typeStr} ${selectedStepCode === course.code ? 'selected' : ''}`}
        draggable
        onDragStart={(e) => handleDragStart(e, course.code, modId)}
        onDragEnd={handleDragEnd}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedStepCode(course.code);
        }}
      >
        <div className="step-drag-handle">⋮⋮</div>
        <div className="step-number">{index + 1}</div>
        <div className="step-icon-wrapper" title={ct.typeStr}>
          <span className={`type-icon ${ct.typeStr}`}>{ct.emoji}</span>
        </div>
        <div className="step-details">
          <h4 className="step-title">{displayName}</h4>
          <div className="step-meta">
            <span className="step-outcome"><strong>Outcome:</strong> {bloomBadge.label} ({Math.round(bloom.confidence*100)}%)</span>
            {duration !== "0 mins" && <span className="step-duration">⏱ {duration}</span>}
            <span className="course-meta-divider">•</span>
            {source === 'ai' ? (
              <span className="course-source-badge" style={{ background: 'rgba(163,113,247,0.15)', color: '#a371f7', border: '1px solid rgba(163,113,247,0.3)' }}>🤖 AI Generated</span>
            ) : source === 'rag' ? (
              <span className="course-source-badge" style={{ background: 'rgba(88,166,255,0.15)', color: '#58a6ff', border: '1px solid rgba(88,166,255,0.3)' }}>📚 RAG Knowledge</span>
            ) : source === 'author' ? (
              <span className="course-source-badge" style={{ background: 'rgba(63,185,80,0.15)', color: '#3fb950', border: '1px solid rgba(63,185,80,0.3)' }}>👤 Author</span>
            ) : (
              <span className="course-source-badge">{source}</span>
            )}
          </div>
          {tags.length > 0 && (
            <div className="step-tags">
              {tags.slice(0, 3).map(tag => <span key={tag} className="tag">{tag}</span>)}
            </div>
          )}
          {course.type === 'assessment' && (
            <div className="step-assessment-binding" style={{marginTop: '12px'}}>
              <label style={{display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: '#ccc'}}>
                Unreal Engine Automation Test Path
                <input 
                  type="text" 
                  value={course.ueTestPath || ''}
                  onChange={(e) => updateCourseMeta(course.code, { ueTestPath: e.target.value })}
                  placeholder="e.g. Project.FunctionalTests.MyFeatureTest"
                  style={{
                    background: '#1a1a1a', 
                    border: '1px solid #444', 
                    color: '#fff', 
                    padding: '6px 10px', 
                    borderRadius: '4px',
                    width: '100%'
                  }}
                />
              </label>
            </div>
          )}
          {(course.role || course.why || course.description) && (
            <div className="step-rationale" style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', borderLeft: '3px solid var(--accent-fg)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span className="rationale-icon" style={{ marginTop: '2px' }}>💡</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {course.role && <div><strong>Role:</strong> {course.role} {course.weight ? `• Priority: ${course.weight}` : ''}</div>}
                  {course.why && <div style={{ color: 'var(--fg-muted)', fontStyle: 'italic' }}><strong>Why:</strong> {course.why}</div>}
                  {course.type === 'ai_generation' && course.description && <div style={{ color: 'var(--fg-muted)' }}>{course.description}</div>}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="step-actions">
           {workflowStage !== "export" && (
             <button className="btn-icon" onClick={() => removeCourse(course.code)}>✕</button>
           )}
        </div>
      </div>
    );
  };


  return (
    <div className="pb-v2-canvas-wrapper" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div className="pb-v2-canvas">
      <div className="canvas-toolbar">
        <button className="btn-epic-secondary" onClick={addModule}>+ Add Module</button>
        {courses.length > 1 && <button className="btn-epic-secondary" onClick={handleOptimize}>⚡ Smart Order</button>}
        <button className="btn-epic-secondary" onClick={clearPath} style={{color: '#f85149', borderColor: '#484f58'}}>🗑️ Clear All</button>
        
        <div className="canvas-stats">
          <span>{modules.length} Modules</span>
          <span>•</span>
          <span>{courses.length} Items</span>
          <span>•</span>
          <span>Approx. {pathStats.estimatedHours}h</span>
          {loadSummary && <span>• 🧠 Load: {loadSummary.avg}/10</span>}
        </div>
      </div>

      <div className="modules-list">
        {modules.map((mod) => {
          const modCourses = mod.courseIds.map(id => courses.find(c => c.code === id)).filter(Boolean);
          return (
            <div 
              key={mod.id} 
              className={`module-block ${activeModule === mod.id ? 'active' : ''}`} 
              onClick={() => setActiveModule(mod.id)}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDropOnModule(e, mod.id)}
            >
              <div className="module-header">
                <div className="module-drag-handle">⋮⋮</div>
                <div className="module-info">
                  <h3>{mod.title || `Module ${mod.id}`}</h3>
                  <p>{mod.description || "Organize related learning steps."}</p>
                  
                  <div className="module-flags">
                    <label className="toggle-label">
                      <input 
                        type="checkbox" 
                        checked={!!mod.kstEnabled} 
                        onChange={() => toggleModuleFlag(mod.id, "kstEnabled")} 
                      />
                      <span className="toggle-text">KST (Prerequisites)</span>
                    </label>
                    <label className="toggle-label">
                      <input 
                        type="checkbox" 
                        checked={!!mod.bktEnabled} 
                        onChange={() => toggleModuleFlag(mod.id, "bktEnabled")} 
                      />
                      <span className="toggle-text">BKT (Estimated Mastery)</span>
                    </label>
                  </div>

                  {/* Verification Configuration */}
                  <div className="module-verification-config">
                    <div className="verification-field">
                      <label className="field-label">📋 Verification Prompt</label>
                      <input
                        type="text"
                        className="field-input"
                        placeholder="e.g., Can you explain blueprint communication?"
                        value={mod.verificationPrompt || ""}
                        onChange={(e) => setModuleVerification(mod.id, { verificationPrompt: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="verification-field">
                      <label className="field-label">🎯 Exit Condition</label>
                      <select
                        className="field-select"
                        value={mod.exitCondition || "quiz"}
                        onChange={(e) => setModuleVerification(mod.id, { exitCondition: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="quiz">Quiz (AI-generated)</option>
                        <option value="self-report">Self-Report</option>
                        <option value="ue-test">UE Automation Test</option>
                        <option value="none">None (skip checkpoint)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="module-steps">
                {modCourses.map((c, i) => renderStep(c, i, mod.id))}
                <div className="module-footer-actions">
                  <div className="add-step-dropzone"
                    onDragOver={handleDropzoneOver}
                    onDragLeave={handleDropzoneLeave}
                    onDrop={(e) => handleDropOnZone(e, mod.id)}
                  >+ Drop Course Here</div>
                  <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                    <button className="btn-epic-secondary" style={{fontSize: '0.8rem', padding: '6px 12px'}} onClick={() => addTransition(mod.id)}>+ Add Transition</button>
                    <button className="btn-epic-secondary" style={{fontSize: '0.8rem', padding: '6px 12px'}} onClick={() => addAssessment(mod.id)}>+ Add Assessment</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Ungrouped Courses (Implicit Module) */}
        {ungroupedCourses.length > 0 && (
          <div 
            className={`module-block ${activeModule === 'ungrouped' ? 'active' : ''}`}
            onClick={() => setActiveModule('ungrouped')}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDropOnModule(e, null)}
          >
            <div className="module-header">
              <div className="module-info">
                <h3>Ungrouped Courses</h3>
                <p>Drag these into a module to organize them.</p>
              </div>
            </div>
            <div className="module-steps">
              {ungroupedCourses.map((c, i) => renderStep(c, i, null))}
              <div className="module-footer-actions">
                <div className="add-step-dropzone"
                  onDragOver={handleDropzoneOver}
                  onDragLeave={handleDropzoneLeave}
                  onDrop={(e) => handleDropOnZone(e, null)}
                >+ Drop Course Here</div>
                <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                  <button className="btn-epic-secondary" style={{fontSize: '0.8rem', padding: '6px 12px'}} onClick={() => addTransition(null)}>+ Add Transition</button>
                  <button className="btn-epic-secondary" style={{fontSize: '0.8rem', padding: '6px 12px'}} onClick={() => addAssessment(null)}>+ Add Assessment</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Right Sidebar - Phase 5 Panels */}
      <div className="pb-v2-right-sidebar">
        <div className="panel-tabs">
          <button 
            className={`tab-btn ${activePanel === 'inspector' ? 'active' : ''}`}
            onClick={() => setActivePanel('inspector')}
          >
            INSPECTOR
          </button>
          <button 
            className={`tab-btn ${activePanel === 'trace' ? 'active' : ''}`}
            onClick={() => setActivePanel('trace')}
          >
            TRACE
          </button>
        </div>
        
        <div className="panel-container">
          {activePanel === 'inspector' ? (
            <StepInspector 
              course={selectedCourse} 
              onClose={() => setSelectedStepCode(null)}
              onPin={(code) => updateCourseMeta(code, { isPinned: !selectedCourse?.isPinned })}
              onReplace={(code) => {
                // Placeholder for Phase 6 replacement logic
                window.dispatchEvent(new CustomEvent("focus-left-panel", { detail: { mode: "search", replaceCode: code } }));
              }}
            />
          ) : (
            <AssemblyTrace 
              course={selectedCourse} 
              onClose={() => setSelectedStepCode(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
