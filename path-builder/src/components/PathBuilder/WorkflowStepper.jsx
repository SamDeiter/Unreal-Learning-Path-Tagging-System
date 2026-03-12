/**
 * WorkflowStepper — 4-stage progress bar for Path Builder
 *
 * Stages: Curate → Arrange → Review → Export
 * Soft gates: warnings if criteria not met, but user can still click.
 */
import { usePath } from "../../context/PathContext";
import "./WorkflowStepper.css";

const STAGES = [
  { key: "build", icon: "🏗️", label: "Build", desc: "Add, order, and refine courses" },
  { key: "review", icon: "✅", label: "Review", desc: "Verify and check quality" },
  { key: "export", icon: "📦", label: "Export", desc: "Download SCORM package" },
];

function WorkflowStepper() {
  const { workflowStage, setWorkflowStage, courses } = usePath();

  const currentIdx = STAGES.findIndex((s) => s.key === workflowStage);

  // Soft gate warnings
  const getGateWarning = (targetKey) => {
    const targetIdx = STAGES.findIndex((s) => s.key === targetKey);
    if (targetIdx <= currentIdx) return null; // going back is always fine

    // Must have 2+ courses to leave Curate
    if (targetIdx >= 1 && courses.length < 2) {
      return "Add at least 2 courses to your path first";
    }
    return null;
  };

  const handleStageClick = (stageKey) => {
    const warning = getGateWarning(stageKey);
    if (warning) {
      // Soft gate: show warning but still allow
      if (!window.confirm(`⚠️ ${warning}\n\nProceed anyway?`)) return;
    }
    setWorkflowStage(stageKey);
  };

  return (
    <div className="workflow-stepper">
      {STAGES.map((stage, idx) => {
        const isActive = stage.key === workflowStage;
        const isComplete = idx < currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <div key={stage.key} className="ws-step-wrapper">
            <button
              className={`ws-step ${isActive ? "ws-active" : ""} ${
                isComplete ? "ws-complete" : ""
              } ${isFuture ? "ws-future" : ""}`}
              onClick={() => handleStageClick(stage.key)}
              title={stage.desc}
            >
              <span className="ws-icon">
                {isComplete ? "✓" : stage.icon}
              </span>
              <span className="ws-label">{stage.label}</span>
            </button>
            {idx < STAGES.length - 1 && (
              <div
                className={`ws-connector ${isComplete ? "ws-connector-done" : ""}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default WorkflowStepper;
