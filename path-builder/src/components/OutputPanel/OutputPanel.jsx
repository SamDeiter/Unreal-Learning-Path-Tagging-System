import { useState, useMemo, useEffect, useCallback } from "react";
import { usePath } from "../../context/PathContext";
import { generateStructure, generateObjectives, generateGoals } from "../../utils/generationEngine";
import { getOfficialDocs } from "../../utils/suggestionEngine";
import { generateLearningBlueprint, isUserAuthenticated } from "../../services/geminiService";
import "./OutputPanel.css";

function OutputPanel() {
  const { learningIntent, courses } = usePath();
  const [activeTab, setActiveTab] = useState("outline");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiBlueprint, setAiBlueprint] = useState(null);

  // Get official docs for selected courses
  const docLinks = useMemo(() => getOfficialDocs(courses), [courses]);

  // Generate fallback content (memoized)
  const fallbackOutputs = useMemo(() => {
    return {
      outline: generateStructure(learningIntent, courses),
      objectives: generateObjectives(learningIntent, courses),
      goals: generateGoals(learningIntent, courses),
    };
  }, [learningIntent, courses]);

  // Use AI blueprint if available, otherwise fallback
  const outputs = useMemo(() => {
    if (aiBlueprint) {
      return {
        outline: aiBlueprint.outline || fallbackOutputs.outline,
        objectives: aiBlueprint.objectives || fallbackOutputs.objectives,
        goals: aiBlueprint.goals || fallbackOutputs.goals,
      };
    }
    return fallbackOutputs;
  }, [aiBlueprint, fallbackOutputs]);

  // Generate AI blueprint when courses change
  const generateAIBlueprint = useCallback(async () => {
    if (courses.length === 0 || !learningIntent.primaryGoal) return;
    if (!isUserAuthenticated()) return;

    setIsGenerating(true);
    try {
      const blueprint = await generateLearningBlueprint(learningIntent, courses);
      setAiBlueprint(blueprint);
    } catch (err) {
      console.error("AI Blueprint generation failed:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [courses, learningIntent]);

  // Auto-generate when content changes (debounced)
  useEffect(() => {
    if (courses.length > 0 && learningIntent.primaryGoal) {
      const timer = setTimeout(generateAIBlueprint, 1500);
      return () => clearTimeout(timer);
    }
  }, [courses, learningIntent, generateAIBlueprint]);

  const hasContent = courses.length > 0 && learningIntent.primaryGoal;

  return (
    <div className="output-panel">
      <div className="output-header">
        <h3 className="output-title">
          Learning Blueprint
          {isGenerating && <span className="ai-badge generating">✨ AI</span>}
          {aiBlueprint && !isGenerating && <span className="ai-badge">✨</span>}
        </h3>
        <div className="output-tabs">
          <button
            className={`output-tab ${activeTab === "outline" ? "active" : ""}`}
            onClick={() => setActiveTab("outline")}
          >
            📄 Outline
          </button>
          <button
            className={`output-tab ${activeTab === "objectives" ? "active" : ""}`}
            onClick={() => setActiveTab("objectives")}
          >
            🎯 Objectives
          </button>
          <button
            className={`output-tab ${activeTab === "goals" ? "active" : ""}`}
            onClick={() => setActiveTab("goals")}
          >
            🚀 Goals
          </button>
          <button
            className={`output-tab ${activeTab === "docs" ? "active" : ""}`}
            onClick={() => setActiveTab("docs")}
          >
            📚 Docs {docLinks.length > 0 && <span className="tab-count">({docLinks.length})</span>}
          </button>
        </div>
      </div>

      <div className="output-content">
        {!hasContent ? (
          <div className="empty-output">
            {!learningIntent.primaryGoal
              ? "Set your learning intent to generate a blueprint."
              : "Add courses to generate a blueprint."}
          </div>
        ) : (
          <>
            {activeTab === "outline" && (
              <div className="gen-view">
                {outputs.outline.map((section, sIdx) => (
                  <div key={section.id || `section-${sIdx}`} className="gen-section">
                    <h4 className="gen-section-title">{section.title}</h4>
                    <ul className="gen-list">
                      {section.items.map((item, iIdx) => (
                        <li key={item.id || `item-${sIdx}-${iIdx}`} className="gen-item outline">
                          {item.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "objectives" && (
              <div className="gen-view">
                <ul className="gen-list">
                  {outputs.objectives.map((obj, idx) => (
                    <li key={obj.id || `obj-${idx}`} className="gen-item objective">
                      {obj.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === "goals" && (
              <div className="gen-view">
                <ul className="gen-list">
                  {outputs.goals.map((goal, idx) => (
                    <li key={goal.id || `goal-${idx}`} className="gen-item goal">
                      {goal.text}
                      {goal.metric && <span className="goal-metric">→ {goal.metric}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === "docs" && (
              <div className="gen-view docs-view">
                {docLinks.length === 0 ? (
                  <div className="empty-docs">
                    No official documentation links available for selected courses.
                  </div>
                ) : (
                  <ul className="docs-list">
                    {docLinks.map((doc, idx) => (
                      <li key={idx} className="doc-item">
                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                          {doc.title}
                          <span className="doc-topic">({doc.topic})</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default OutputPanel;
