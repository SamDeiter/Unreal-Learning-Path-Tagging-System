/**
 * SmartEmptyState — Replaces the blank "Start Building" screen
 *
 * Displays the author's goal prominently and offers 3 fast-start actions:
 * 1. 🤖 AI Suggest — Auto-populate using AI path generation
 * 2. 🎯 Build by Skill — Jump to SkillCurriculum in the left panel
 * 3. 📚 Browse Library — Jump to CourseLibrary in the left panel
 *
 * Also shows popular topic pills to reduce blank-canvas friction.
 */
import "./SmartEmptyState.css";

const POPULAR_TOPICS = [
  "Lumen Lighting",
  "Nanite Geometry",
  "Blueprint Scripting",
  "Material Editor",
  "World Partition",
  "Niagara VFX",
  "Animation Retargeting",
  "MetaSounds",
];

function SmartEmptyState({ goal, skillLevel, onBrowseLibrary, onBuildBySkill }) {
  // Safe-call wrapper
  const handleBuildBySkill = (skill) => {

    if (typeof onBuildBySkill === "function") {
      onBuildBySkill(skill);
    } else {
      console.error("SmartEmptyState: onBuildBySkill is not a function", onBuildBySkill);
    }
  };

  return (
    <div className="ses-container">
      {/* Goal Display */}
      {goal && (
        <div className="ses-goal-card">
          <span className="ses-goal-icon">🎯</span>
          <div className="ses-goal-text">
            <span className="ses-goal-label">Your Goal</span>
            <h3 className="ses-goal-value">{goal}</h3>
            {skillLevel && (
              <span className="ses-goal-level">{skillLevel} Level</span>
            )}
          </div>
        </div>
      )}

      {/* Main CTA */}
      <div className="ses-hero">
        <div className="ses-hero-icon">🏗️</div>
        <h3 className="ses-hero-title">
          {goal ? "Start Adding Courses" : "Build Your Learning Path"}
        </h3>
        <p className="ses-hero-subtitle">
          {goal
            ? "Choose a method below to populate your path with relevant content."
            : "Add courses from the library to create your learning sequence."}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="ses-actions">
        <button
          className="ses-action ses-action-skill"
          onClick={() => handleBuildBySkill(goal || "")}
          title="Search courses by skill or topic"
        >
          <span className="ses-action-icon">🎯</span>
          <span className="ses-action-label">Build by Skill</span>
          <span className="ses-action-hint">Search by topic area</span>
        </button>
        <button
          className="ses-action ses-action-browse"
          onClick={onBrowseLibrary}
          title="Browse the full course library"
        >
          <span className="ses-action-icon">📚</span>
          <span className="ses-action-label">Browse Library</span>
          <span className="ses-action-hint">Explore all courses</span>
        </button>
      </div>

      {/* Popular Topics */}
      <div className="ses-topics">
        <span className="ses-topics-label">Popular topics:</span>
        <div className="ses-topics-pills">
          {POPULAR_TOPICS.map((topic) => (
            <button
              key={topic}
              className="ses-topic-pill"
              onClick={() => handleBuildBySkill(topic)}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SmartEmptyState;
