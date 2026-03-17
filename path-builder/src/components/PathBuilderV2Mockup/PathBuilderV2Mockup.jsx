import React, { useState, useEffect, useCallback } from "react";
import { fetchJSON } from "../../services/dataLoader";
import { sanitizeTitle } from "../../utils/titleSanitizer";
import { usePath } from "../../context/PathContext";
import { generateBespokePath } from "../../services/bespokePathService";
import { convertBespokeToAssembly } from "../../utils/bespokeToAssembly";
import AssemblyLineV2 from "../AssemblyLine/AssemblyLineV2";
import "./PathBuilderV2Mockup.css";

// Pipeline stage labels for progress indicator
const WIZARD_STAGES = [
  { key: "search", label: "Searching corpus…", icon: "🔍" },
  { key: "sequence", label: "Sequencing path…",  icon: "🧩" },
  { key: "narrate", label: "Generating narration…", icon: "📝" },
  { key: "adapt", label: "Building modules…", icon: "📦" },
];

export default function PathBuilderV2Mockup() {
  const { addCourse, loadPath, setLearningIntent, clearPath } = usePath();
  const [realCourses, setRealCourses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showWizard, setShowWizard] = useState(false);

  // Wizard form state
  const [wizardGoal, setWizardGoal] = useState("");
  const [wizardLevel, setWizardLevel] = useState("Intermediate");
  const [wizardTimeBudget, setWizardTimeBudget] = useState("10");
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardStage, setWizardStage] = useState(0);
  const [wizardError, setWizardError] = useState(null);

  useEffect(() => {
    fetchJSON("video_library_enriched").then((data) => {
      if (data && data.courses) {
        const seen = new Set();
        const cleaned = data.courses
          .filter(c => {
            if (seen.has(c.code)) return false;
            seen.add(c.code);
            return true;
          })
          .map(c => ({
            ...c,
            originalTitle: c.title,
            cleanTitle: sanitizeTitle(c.title),
            type: c.title.toLowerCase().includes("video") || c.title.toLowerCase().includes(".mp4") ? "video" : "doc",
            source: "Epic Developer Community"
          }));
        setRealCourses(cleaned);
      }
    });
  }, []);

  const filteredCourses = realCourses.filter(c => 
    c.cleanTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.originalTitle.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 50);

  const getTypeIcon = (type) => {
    switch(type) {
      case "video": return <span className="type-icon video" title="Video Course">🎬</span>;
      case "doc":   return <span className="type-icon doc" title="Documentation">📄</span>;
      case "ai":    return <span className="type-icon ai" title="AI Generated">🤖</span>;
      default:      return null;
    }
  };

  // ── AI Wizard: Generate Path ─────────────────────────────────────────
  const handleWizardGenerate = useCallback(async () => {
    if (!wizardGoal.trim()) return;

    setWizardLoading(true);
    setWizardError(null);
    setWizardStage(0);

    // Build knowledge profile from wizard inputs
    const knowledgeProfile = {
      level: wizardLevel.toLowerCase(),
      gaps: [],
      knows: [],
    };

    try {
      // Stage 1: Search
      setWizardStage(0);
      
      // Stage progress simulation — the actual pipeline is asynchronous,
      // so we advance the stage indicator on a timer for UX feedback
      const stageTimer = setInterval(() => {
        setWizardStage(prev => Math.min(prev + 1, WIZARD_STAGES.length - 1));
      }, 3000);

      const result = await generateBespokePath(wizardGoal.trim(), knowledgeProfile);

      clearInterval(stageTimer);
      setWizardStage(WIZARD_STAGES.length - 1);

      if (result.error) {
        setWizardError(result.error);
        setWizardLoading(false);
        return;
      }

      // Convert bespoke result → PathContext format
      const { courses, modules, learningIntent } = convertBespokeToAssembly(result);

      if (courses.length === 0) {
        setWizardError("No courses were generated. Try a more specific UE5 topic.");
        setWizardLoading(false);
        return;
      }

      // Clear existing path and load the new one
      clearPath();
      
      // Small delay to let clearPath dispatch settle
      await new Promise(r => setTimeout(r, 50));

      loadPath({ courses, modules });
      setLearningIntent({
        primaryGoal: wizardGoal.trim(),
        skillLevel: wizardLevel,
        timeBudget: wizardTimeBudget,
        ...learningIntent,
      });

      // Close wizard
      setShowWizard(false);
      setWizardGoal("");
      setWizardLoading(false);
      setWizardStage(0);

    } catch (err) {
      setWizardError(`Generation failed: ${err.message}`);
      setWizardLoading(false);
    }
  }, [wizardGoal, wizardLevel, wizardTimeBudget, clearPath, loadPath, setLearningIntent]);

  const handleWizardClose = useCallback(() => {
    if (wizardLoading) return; // Don't close while generating
    setShowWizard(false);
    setWizardError(null);
    setWizardStage(0);
  }, [wizardLoading]);

  return (
    <div className="pb-v2-container">
      <header className="pb-v2-header">
        <div className="header-left">
          <h1>Path Builder <span>V2 Prototype</span></h1>
          <p>Dense, Professional, Desktop-Native Assembly Line</p>
        </div>
        <div className="header-actions" style={{display: 'flex', gap: '8px'}}>
          <button className="btn-epic-secondary wizard-btn" onClick={() => setShowWizard(true)}>✨ AI Path Wizard</button>
          <button className="btn-epic-secondary preview-btn">▶️ Preview in Player</button>
          <button className="btn-epic-primary">Export SCORM</button>
        </div>
      </header>

      <div className="pb-v2-layout">
        {/* Left Column: Library Panel */}
        <aside className="pb-v2-library">
          <div className="panel-header">
            <h2>Course Library</h2>
            <input 
              type="text" 
              placeholder="Search by title, tag, or skill..." 
              className="epic-search" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="library-content">
            {filteredCourses.length === 0 ? (
              <div className="unselected-state">
                <span className="icon">📚</span>
                <p>Loading or no courses found.</p>
              </div>
            ) : (
              <div className="real-course-list">
                {filteredCourses.map(course => (
                  <div 
                    key={course.code} 
                    className="real-course-card" 
                    title={`Original: ${course.originalTitle}`}
                    onClick={() => addCourse(course)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="step-icon-wrapper">
                       {getTypeIcon(course.type)}
                    </div>
                    <div className="real-course-info">
                       <div className="clean-title">{course.cleanTitle}</div>
                       <div className="course-code">
                         {course.code} <span className="course-meta-divider">•</span> {course.source}
                       </div>
                    </div>
                    <div className="add-hint">+</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Center Canvas + Right Sidebar (AssemblyLineV2) */}
        <AssemblyLineV2 />
      </div>

      {/* ── AI Path Wizard Modal ─────────────────────────────────────── */}
      {showWizard && (
        <div className="wizard-modal-overlay">
          <div className="wizard-modal">
            <div className="wizard-modal-header">
               <h2>✨ AI Path Generation Wizard</h2>
               <button
                 className="btn-icon"
                 onClick={handleWizardClose}
                 disabled={wizardLoading}
               >✕</button>
            </div>

            {/* Loading state */}
            {wizardLoading ? (
              <div className="wizard-modal-body" style={{ textAlign: 'center', padding: '2rem' }}>
                <div className="wizard-loading-spinner" />
                <div className="wizard-stage-indicator">
                  {WIZARD_STAGES.map((stage, i) => (
                    <div
                      key={stage.key}
                      className={`wizard-stage-step ${i < wizardStage ? 'done' : i === wizardStage ? 'active' : ''}`}
                    >
                      <span className="wizard-stage-icon">{i <= wizardStage ? '✓' : stage.icon}</span>
                      <span className="wizard-stage-label">{stage.label}</span>
                    </div>
                  ))}
                </div>
                <p style={{ color: 'var(--fg-muted, #8b949e)', marginTop: '1rem', fontSize: '0.85rem' }}>
                  Building your personalized learning path…
                </p>
              </div>
            ) : (
              <>
                <div className="wizard-modal-body">
                  <p>Tell us what you want to learn, and we'll assemble an AI-powered curriculum from our course library and UE5 knowledge base.</p>

                  {wizardError && (
                    <div className="wizard-error" style={{
                      background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)',
                      borderRadius: '6px', padding: '0.75rem 1rem', color: '#f85149',
                      fontSize: '0.85rem', marginBottom: '1rem',
                    }}>
                      ⚠️ {wizardError}
                    </div>
                  )}

                  <div className="wizard-form-group">
                    <label>What's the primary goal for this path?</label>
                    <input
                      type="text"
                      className="epic-search"
                      placeholder="e.g. Master Environmental Lighting in UE5"
                      value={wizardGoal}
                      onChange={(e) => setWizardGoal(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div className="wizard-form-group">
                    <label>Who is the target audience?</label>
                    <select
                      className="epic-search"
                      value={wizardLevel}
                      onChange={(e) => setWizardLevel(e.target.value)}
                    >
                      <option value="Beginner">Beginners (0-3 months)</option>
                      <option value="Intermediate">Intermediate (3-12 months)</option>
                      <option value="Advanced">Advanced (1+ years)</option>
                    </select>
                  </div>

                  <div className="wizard-form-group">
                    <label>What is your time budget?</label>
                    <select
                      className="epic-search"
                      value={wizardTimeBudget}
                      onChange={(e) => setWizardTimeBudget(e.target.value)}
                    >
                      <option value="5">≤5 Hours (Crash Course)</option>
                      <option value="10">5–10 Hours (Standard)</option>
                      <option value="20">10–20 Hours (Deep Dive)</option>
                      <option value="none">No Limit</option>
                    </select>
                  </div>
                </div>

                <div className="wizard-modal-footer">
                  <button className="btn-epic-secondary" onClick={handleWizardClose}>Cancel</button>
                  <button
                    className="btn-epic-primary"
                    onClick={handleWizardGenerate}
                    disabled={!wizardGoal.trim()}
                  >
                    🚀 Generate Path
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
