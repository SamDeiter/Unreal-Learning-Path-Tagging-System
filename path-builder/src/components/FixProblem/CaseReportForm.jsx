/**
 * CaseReportForm - Collapsible structured context fields
 * Populates the caseReport object sent to the backend for better diagnosis.
 */
import { useState, useCallback } from "react";
import PropTypes from "prop-types";
import "./FixProblem.css";

export default function CaseReportForm({ onUpdate, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [fields, setFields] = useState({
    engineVersion: "",
    platform: "",
    context: "",
    renderer: "",
    features: "",
    whatChangedRecently: "",
    goal: "",
  });

  const handleChange = useCallback(
    (field, value) => {
      const updated = { ...fields, [field]: value };
      setFields(updated);

      // Build caseReport object for parent
      const caseReport = {
        engineVersion: updated.engineVersion.trim() || undefined,
        platform: updated.platform.trim() || undefined,
        context: updated.context.trim() || undefined,
        renderer: updated.renderer.trim() || undefined,
        features: updated.features
          ? updated.features
              .split(",")
              .map((f) => f.trim())
              .filter(Boolean)
          : [],
        whatChangedRecently: updated.whatChangedRecently.trim() || undefined,
        goal: updated.goal.trim() || undefined,
      };

      // Only send if at least one field is filled
      const hasData = Object.values(caseReport).some(
        (v) => v !== undefined && (!Array.isArray(v) || v.length > 0)
      );
      onUpdate(hasData ? caseReport : null);
    },
    [fields, onUpdate]
  );

  return (
    <div className="case-report-form">
      <button
        type="button"
        className="case-report-toggle"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className="case-report-toggle-icon">{isOpen ? "▾" : "▸"}</span>
        <span className="case-report-toggle-label">
          🔧 Add Case Details
          <span className="case-report-hint">(improves diagnosis accuracy)</span>
        </span>
      </button>

      {isOpen && (
        <div className="case-report-fields">
          <div className="case-report-row">
            <div className="case-report-field">
              <label>Engine Version</label>
              <input
                type="text"
                placeholder="e.g. 5.4.1"
                value={fields.engineVersion}
                onChange={(e) => handleChange("engineVersion", e.target.value)}
                disabled={disabled}
                maxLength={20}
              />
            </div>
            <div className="case-report-field">
              <label>Platform</label>
              <select
                value={fields.platform}
                onChange={(e) => handleChange("platform", e.target.value)}
                disabled={disabled}
              >
                <option value="">Select...</option>
                <option value="Windows">Windows</option>
                <option value="macOS">macOS</option>
                <option value="Linux">Linux</option>
                <option value="Android">Android</option>
                <option value="iOS">iOS</option>
                <option value="Console">Console</option>
              </select>
            </div>
            <div className="case-report-field">
              <label>Renderer</label>
              <select
                value={fields.renderer}
                onChange={(e) => handleChange("renderer", e.target.value)}
                disabled={disabled}
              >
                <option value="">Select...</option>
                <option value="Lumen">Lumen</option>
                <option value="Nanite">Nanite</option>
                <option value="Forward">Forward Shading</option>
                <option value="Deferred">Deferred</option>
                <option value="Mobile">Mobile</option>
                <option value="PathTracing">Path Tracing</option>
              </select>
            </div>
          </div>

          <div className="case-report-field case-report-full">
            <label>What changed recently?</label>
            <input
              type="text"
              placeholder="e.g. Updated to 5.4, migrated project, changed lighting settings"
              value={fields.whatChangedRecently}
              onChange={(e) => handleChange("whatChangedRecently", e.target.value)}
              disabled={disabled}
              maxLength={300}
            />
          </div>

          <div className="case-report-field case-report-full">
            <label>What are you trying to achieve?</label>
            <input
              type="text"
              placeholder="e.g. Realistic interior lighting, smooth character animation"
              value={fields.goal}
              onChange={(e) => handleChange("goal", e.target.value)}
              disabled={disabled}
              maxLength={200}
            />
          </div>

          <div className="case-report-field case-report-full">
            <label>Active Features (comma separated)</label>
            <input
              type="text"
              placeholder="e.g. Lumen, Nanite, Virtual Shadow Maps, World Partition"
              value={fields.features}
              onChange={(e) => handleChange("features", e.target.value)}
              disabled={disabled}
              maxLength={200}
            />
          </div>
        </div>
      )}
    </div>
  );
}

CaseReportForm.propTypes = {
  onUpdate: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

CaseReportForm.defaultProps = {
  disabled: false,
};
