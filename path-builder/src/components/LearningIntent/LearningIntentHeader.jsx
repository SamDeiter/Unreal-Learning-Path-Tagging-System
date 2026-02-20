import { useMemo } from "react";
import { Check, AlertCircle } from "lucide-react";
import { usePath } from "../../context/PathContext";
import { detectPersona } from "../../services/PersonaService";
import "./LearningIntentHeader.css";

function LearningIntentHeader() {
  const { learningIntent, setLearningIntent } = usePath();

  const handleChange = (field, value) => {
    setLearningIntent({ [field]: value });
  };

  const isComplete = learningIntent.primaryGoal && learningIntent.skillLevel;

  // Detect persona from goal text
  const detectedPersona = useMemo(() => {
    if (!learningIntent.primaryGoal) return null;
    return detectPersona(learningIntent.primaryGoal);
  }, [learningIntent.primaryGoal]);

  const personaEmojis = {
    indie_isaac: "🎮",
    logic_liam: "⚙️",
    animator_alex: "🎬",
    rigger_regina: "🦴",
    designer_cpg: "🎨",
    architect_amy: "🏛️",
    simulation_sam: "🏭",
    vfx_victor: "💥",
    automotive_andy: "🚗",
  };

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
          title="What do you want to achieve? E.g., 'Learn Niagara VFX', 'Master landscape tools'"
        />
        {detectedPersona && (
          <span
            className="persona-detected-badge"
            title={`Detected persona: ${detectedPersona.name} (confidence: ${Math.round(detectedPersona.confidence * 100)}%)`}
          >
            {personaEmojis[detectedPersona.id] || "👤"} {detectedPersona.name}
          </span>
        )}
      </div>

      <div className="intent-group">
        <label className="intent-label">Current Skill Level *</label>
        <select
          className="intent-select"
          value={learningIntent.skillLevel || ""}
          onChange={(e) => handleChange("skillLevel", e.target.value)}
          title="Your current experience level with this topic"
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
          title="How much time can you dedicate to learning?"
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
        {isComplete ? <Check size={18} /> : <AlertCircle size={18} />}
      </div>
    </div>
  );
}

export default LearningIntentHeader;
