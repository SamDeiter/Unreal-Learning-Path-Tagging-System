import { useState, useMemo } from "react";
import { usePath } from "../../context/PathContext";
import { generateStructure, generateObjectives, generateGoals } from "../../utils/generationEngine";
import "./OutputPanel.css";

function OutputPanel() {
  const { learningIntent, courses } = usePath();
  const [activeTab, setActiveTab] = useState("outline");

  // Generate content on fly (memoized)
  const outputs = useMemo(() => {
    return {
      outline: generateStructure(learningIntent, courses),
      objectives: generateObjectives(learningIntent, courses),
      goals: generateGoals(learningIntent, courses),
    };
  }, [learningIntent, courses]);

  const hasContent = courses.length > 0 && learningIntent.primaryGoal;

  return (
    <div className="output-panel">
      <div className="output-header">
        <h3 className="output-title">Learning Blueprint</h3>
        <div className="output-tabs">
          <button
            className={`output-tab ${activeTab === "outline" ? "active" : ""}`}
            onClick={() => setActiveTab("outline")}
          >
            Outline
          </button>
          <button
            className={`output-tab ${activeTab === "objectives" ? "active" : ""}`}
            onClick={() => setActiveTab("objectives")}
          >
            Objectives
          </button>
          <button
            className={`output-tab ${activeTab === "goals" ? "active" : ""}`}
            onClick={() => setActiveTab("goals")}
          >
            Goals
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
                {outputs.outline.map((section) => (
                  <div key={section.id} className="gen-section">
                    <h4 className="gen-section-title">{section.title}</h4>
                    <ul className="gen-list">
                      {section.items.map((item) => (
                        <li key={item.id} className="gen-item outline">
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
                  {outputs.objectives.map((obj) => (
                    <li key={obj.id} className="gen-item objective">
                      {obj.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === "goals" && (
              <div className="gen-view">
                <ul className="gen-list">
                  {outputs.goals.map((goal) => (
                    <li key={goal.id} className="gen-item goal">
                      {goal.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default OutputPanel;
