/**
 * LevelPicker — Simple 3-button experience level selector.
 *
 * Replaces the full diagnostic quiz with a quick self-assessment.
 * Extracted from AdaptivePath.jsx to reduce its size.
 */

const LEVELS = [
  { key: "beginner", icon: "🌱", label: "I'm new to UE5" },
  { key: "intermediate", icon: "⚡", label: "I know the basics" },
  { key: "advanced", icon: "🚀", label: "I'm experienced" },
];

export default function LevelPicker({ onSelect }) {
  return (
    <div className="adaptive-path">
      <div className="diagnostic-quiz">
        <div className="diagnostic-header">
          <h2>🎯 How familiar are you with Unreal Engine?</h2>
          <p>This helps us tailor the depth of your learning path</p>
        </div>

        <div className="diagnostic-options" style={{ maxWidth: "420px", margin: "24px auto 0" }}>
          {LEVELS.map((lvl) => (
            <button
              key={lvl.key}
              className="diagnostic-option"
              onClick={() => onSelect(lvl.key)}
              style={{ padding: "16px 20px", marginBottom: "12px" }}
            >
              <span className="diagnostic-option-letter">{lvl.icon}</span>
              {lvl.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
