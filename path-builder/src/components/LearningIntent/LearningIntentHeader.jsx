import { usePath } from "../../context/PathContext";
import "./LearningIntentHeader.css";

function LearningIntentHeader() {
  const { learningIntent, setLearningIntent } = usePath();

  const handleChange = (field, value) => {
    setLearningIntent({ [field]: value });
  };

  const isComplete = learningIntent.primaryGoal && learningIntent.skillLevel;

  return (
    <div className="learning-intent-header">
      <div className="intent-group">
        <label className="intent-label">Primary Goal *</label>
        <input
          type="text"
          className="intent-input"
          placeholder="e.g. Master Lumen Lighting"
          value={learningIntent.primaryGoal || ""}
          onChange={(e) => handleChange("primaryGoal", e.target.value)}
        />
      </div>

      <div className="intent-group">
        <label className="intent-label">Current Skill Level *</label>
        <select
          className="intent-select"
          value={learningIntent.skillLevel || ""}
          onChange={(e) => handleChange("skillLevel", e.target.value)}
        >
          <option value="">Select Level...</option>
          <option value="Beginner">Beginner (New to topic)</option>
          <option value="Intermediate">Intermediate (Some exp)</option>
          <option value="Advanced">Advanced (Expert)</option>
        </select>
      </div>

      <div className="intent-group">
        <label className="intent-label">Time Budget</label>
        <select
          className="intent-select"
          value={learningIntent.timeBudget || ""}
          onChange={(e) => handleChange("timeBudget", e.target.value)}
        >
          <option value="">No Limit</option>
          <option value="5">~5 Hours</option>
          <option value="10">~10 Hours</option>
          <option value="20">~20 Hours</option>
          <option value="40">~40 Hours</option>
        </select>
      </div>

      <div
        className={`intent-status ${isComplete ? "valid" : ""}`}
        title={isComplete ? "Intent Set" : "Please fill required fields"}
      >
        {isComplete ? "✓" : "!"}
      </div>
    </div>
  );
}

export default LearningIntentHeader;
