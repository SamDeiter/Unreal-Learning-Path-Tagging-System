import React, { useState, useEffect } from "react";
import { fetchJSON } from "../../services/dataLoader";
import { sanitizeTitle } from "../../utils/titleSanitizer";
import { usePath } from "../../context/PathContext";
import AssemblyLineV2 from "../AssemblyLine/AssemblyLineV2";
import "./PathBuilderV2Mockup.css";

// Temporary UI Component for iterating on the Path Builder Redesign
export default function PathBuilderV2Mockup() {
  const { addCourse } = usePath();
  const [realCourses, setRealCourses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    fetchJSON("video_library_enriched").then((data) => {
      if (data && data.courses) {
        // Dedup and sanitize
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
  ).slice(0, 50); // Limit to 50 for performance

  const getTypeIcon = (type) => {
    switch(type) {
      case "video": return <span className="type-icon video" title="Video Course">🎬</span>;
      case "doc":   return <span className="type-icon doc" title="Documentation">📄</span>;
      case "ai":    return <span className="type-icon ai" title="AI Generated">🤖</span>;
      default:      return null;
    }
  };

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

      {showWizard && (
        <div className="wizard-modal-overlay">
          <div className="wizard-modal">
            <div className="wizard-modal-header">
               <h2>✨ AI Path Generation Wizard</h2>
               <button className="btn-icon" onClick={() => setShowWizard(false)}>✕</button>
            </div>
            <div className="wizard-modal-body">
              <p>Welcome to the Path Generator. Tell us what you want to build, and we'll assemble an initial curriculum for you.</p>
              
              <div className="wizard-form-group">
                <label>What's the primary goal for this path?</label>
                <input type="text" className="epic-search" placeholder="e.g. Master Environmental Lighting in UE5" />
              </div>

              <div className="wizard-form-group">
                <label>Who is the target audience?</label>
                <select className="epic-search">
                  <option>Beginners (0-3 months)</option>
                  <option>Intermediate (3-12 months)</option>
                  <option>Advanced (1+ years)</option>
                </select>
              </div>

              <div className="wizard-form-group">
                <label>What is your time budget?</label>
                <select className="epic-search">
                  <option>Under 1 Hour (Crash Course)</option>
                  <option>1-3 Hours (Standard)</option>
                  <option>3+ Hours (Deep Dive)</option>
                </select>
              </div>
            </div>
            <div className="wizard-modal-footer">
              <button className="btn-epic-secondary" onClick={() => setShowWizard(false)}>Cancel</button>
              <button className="btn-epic-primary" onClick={() => setShowWizard(false)}>Generate Path</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
