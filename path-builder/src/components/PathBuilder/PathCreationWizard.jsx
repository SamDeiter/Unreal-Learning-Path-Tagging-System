/**
 * PathCreationWizard — Step-by-step guided path creation
 *
 * Steps:
 * 1. Goal — "What should learners accomplish?"
 * 2. Audience — Skill level + research-backed time recommendation
 * 3. Review — Preview summary before opening editor
 */

import { useState, useCallback } from "react";
import { usePath } from "../../context/PathContext";
import "./PathCreationWizard.css";

const STEPS = [
  { id: "goal", label: "Goal", icon: "🎯" },
  { id: "audience", label: "Audience", icon: "👥" },
  { id: "review", label: "Review", icon: "✅" },
];

const TIME_RECOMMENDATIONS = {
  Beginner: {
    default: "5",
    max: 5,
    label: "≤5 hours",
    hint: "Short, focused paths for new learners",
  },
  Intermediate: {
    default: "10",
    max: 15,
    label: "5–15 hours",
    hint: "Deeper exploration with guided practice",
  },
  Advanced: {
    default: "20",
    max: 25,
    label: "10–25 hours",
    hint: "Self-directed deep dives and mastery",
  },
};

const INDUSTRIES = [
  "All",
  "General",
  "Games",
  "Film & Television",
  "Architecture",
  "Simulation",
  "Automotive",
  "Media & Entertainment",
];

function PathCreationWizard({ onComplete, onCancel }) {
  const { clearPath } = usePath();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [skillLevel, setSkillLevel] = useState("");
  const [timeBudget, setTimeBudget] = useState("");
  const [industries, setIndustries] = useState([]); // empty = All

  const toggleIndustry = useCallback((ind) => {
    setIndustries((prev) => {
      if (ind === "All") return []; // "All" clears the filter
      const next = prev.includes(ind) ? prev.filter((i) => i !== ind) : [...prev, ind];
      return next;
    });
  }, []);

  const currentStep = STEPS[step];

  const canProceed = () => {
    if (step === 0) return goal.trim().length > 5;
    if (step === 1) return !!skillLevel;
    return true;
  };

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  }, [step]);

  const handleBack = useCallback(() => {
    if (step > 0) setStep(step - 1);
  }, [step]);

  const handleCreate = useCallback(() => {
    // Prevent stale state leaking into the new path
    clearPath();
    
    onComplete({
      id: crypto.randomUUID(),
      title: title.trim() || goal.trim().slice(0, 50),
      goal: goal.trim(),
      skillLevel,
      timeBudget: timeBudget || TIME_RECOMMENDATIONS[skillLevel]?.default || "none",
      industries, // array of selected industries (empty = all)
      courseCount: 0,
      totalMinutes: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }, [onComplete, title, goal, skillLevel, timeBudget, industries, clearPath]);

  // Auto-set recommended time when skill level changes
  const handleSkillChange = (level) => {
    setSkillLevel(level);
    const rec = TIME_RECOMMENDATIONS[level];
    if (rec && !timeBudget) setTimeBudget(rec.default);
  };

  const rec = TIME_RECOMMENDATIONS[skillLevel];

  return (
    <div className="pcw-overlay">
      <div className="pcw-modal">
        {/* Header */}
        <div className="pcw-header">
          <h2 className="pcw-title">Create Learning Path</h2>
          <button className="pcw-close" onClick={onCancel} aria-label="Close modal">
            ×
          </button>
        </div>

        {/* Progress */}
        <div className="pcw-progress">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`pcw-step ${i === step ? "active" : i < step ? "done" : ""}`}
            >
              <span className="pcw-step-icon">{i < step ? "✓" : s.icon}</span>
              <span className="pcw-step-label">{s.label}</span>
            </div>
          ))}
          <div className="pcw-progress-line">
            <div
              className="pcw-progress-fill"
              style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="pcw-body">
          {/* Step 1: Goal */}
          {currentStep.id === "goal" && (
            <div className="pcw-step-content">
              <h3>🎯 What should learners accomplish?</h3>
              <p className="pcw-hint">Describe the learning outcome in one sentence.</p>
              <input
                className="pcw-input"
                type="text"
                placeholder="e.g., Master Lumen Lighting for interior scenes"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                autoFocus
              />
              <div className="pcw-optional">
                <label className="pcw-label">Path Title (optional)</label>
                <input
                  className="pcw-input pcw-input-sm"
                  type="text"
                  placeholder="Auto-generated from goal if blank"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 2: Audience */}
          {currentStep.id === "audience" && (
            <div className="pcw-step-content">
              <h3>👥 Who is this path for?</h3>
              <p className="pcw-hint">
                Select skill level — time budget auto-adjusts based on research.
              </p>

              <div className="pcw-level-cards">
                {Object.entries(TIME_RECOMMENDATIONS).map(([level, info]) => (
                  <button
                    key={level}
                    className={`pcw-level-card ${skillLevel === level ? "selected" : ""}`}
                    onClick={() => handleSkillChange(level)}
                    aria-pressed={skillLevel === level}
                  >
                    <span className="pcw-level-name">{level}</span>
                    <span className="pcw-level-time">{info.label}</span>
                    <span className="pcw-level-hint">{info.hint}</span>
                  </button>
                ))}
              </div>

              {rec && (
                <div className="pcw-time-section">
                  <label className="pcw-label">Time Budget</label>
                  <select
                    className="pcw-select"
                    value={timeBudget}
                    onChange={(e) => setTimeBudget(e.target.value)}
                  >
                    <option value="5">~5 Hours {skillLevel === "Beginner" ? "★" : ""}</option>
                    <option value="10">~10 Hours {skillLevel === "Intermediate" ? "★" : ""}</option>
                    <option value="15">
                      ~15 Hours {skillLevel === "Intermediate" ? "★ Max" : ""}
                    </option>
                    <option value="20">~20 Hours {skillLevel === "Advanced" ? "★" : ""}</option>
                    <option value="25">~25 Hours {skillLevel === "Advanced" ? "★ Max" : ""}</option>
                    <option value="none">No Limit</option>
                  </select>
                  <span className="pcw-research-note">
                    📖 Research: {rec.label} recommended for {skillLevel}
                  </span>
                </div>
              )}

              <div className="pcw-time-section">
                <label className="pcw-label">Industry Focus</label>
                <div className="pcw-industry-chips">
                  <button
                    type="button"
                    className={`pcw-industry-chip ${industries.length === 0 ? "selected" : ""}`}
                    onClick={() => toggleIndustry("All")}
                    aria-pressed={industries.length === 0}
                  >
                    All
                  </button>
                  {INDUSTRIES.filter((i) => i !== "All").map((ind) => (
                    <button
                      key={ind}
                      type="button"
                      className={`pcw-industry-chip ${industries.includes(ind) ? "selected" : ""}`}
                      onClick={() => toggleIndustry(ind)}
                      aria-pressed={industries.includes(ind)}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
                <span className="pcw-research-note">
                  🏭{" "}
                  {industries.length === 0
                    ? "Showing courses from all industries"
                    : `Focusing on: ${industries.join(", ")}`}
                </span>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {currentStep.id === "review" && (
            <div className="pcw-step-content">
              <h3>✅ Review Your Path</h3>
              <div className="pcw-review-card">
                <div className="pcw-review-row">
                  <span className="pcw-review-label">Title</span>
                  <span className="pcw-review-value">{title || goal.slice(0, 50)}</span>
                </div>
                <div className="pcw-review-row">
                  <span className="pcw-review-label">Goal</span>
                  <span className="pcw-review-value">{goal}</span>
                </div>
                <div className="pcw-review-row">
                  <span className="pcw-review-label">Skill Level</span>
                  <span className="pcw-review-value">{skillLevel}</span>
                </div>
                <div className="pcw-review-row">
                  <span className="pcw-review-label">Time Budget</span>
                  <span className="pcw-review-value">
                    {timeBudget === "none" ? "No Limit" : `~${timeBudget}h`}
                  </span>
                </div>
                <div className="pcw-review-row">
                  <span className="pcw-review-label">Industry</span>
                  <span className="pcw-review-value">
                    {industries.length === 0 ? "All Industries" : industries.join(", ")}
                  </span>
                </div>
              </div>
              <p className="pcw-review-next">
                After creating, you'll add courses and refine your path in the editor.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pcw-footer">
          {step > 0 ? (
            <button className="pcw-btn pcw-btn-secondary" onClick={handleBack}>
              ← Back
            </button>
          ) : (
            <button className="pcw-btn pcw-btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              className="pcw-btn pcw-btn-primary"
              onClick={handleNext}
              disabled={!canProceed()}
            >
              Next →
            </button>
          ) : (
            <button className="pcw-btn pcw-btn-primary" onClick={handleCreate}>
              🚀 Create Path
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PathCreationWizard;
