/**
 * CaseReportForm - Always-visible sidebar panel for structured context.
 * Populates the caseReport object sent to the backend for better diagnosis.
 * Shows a confidence boost indicator for each filled field.
 */
import { useState, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import "./FixProblem.css";

/** Scoring: how many confidence points each field contributes */
const FIELD_SCORES = {
  engineVersion: { points: 15, label: "Engine Version" },
  platform: { points: 5, label: "Platform" },
  renderer: { points: 10, label: "Renderer" },
  whatChangedRecently: { points: 10, label: "Recent Changes" },
  goal: { points: 5, label: "Goal" },
  features: { points: 5, label: "Features" },
};
const MAX_BOOST = Object.values(FIELD_SCORES).reduce((s, f) => s + f.points, 0);

export default function CaseReportForm({ onUpdate, disabled }) {
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

      const hasData = Object.values(caseReport).some(
        (v) => v !== undefined && (!Array.isArray(v) || v.length > 0)
      );
      onUpdate(hasData ? caseReport : null);
    },
    [fields, onUpdate]
  );

  // Compute confidence boost from filled fields
  const boost = useMemo(() => {
    let pts = 0;
    if (fields.engineVersion.trim()) pts += FIELD_SCORES.engineVersion.points;
    if (fields.platform) pts += FIELD_SCORES.platform.points;
    if (fields.renderer) pts += FIELD_SCORES.renderer.points;
    if (fields.whatChangedRecently.trim()) pts += FIELD_SCORES.whatChangedRecently.points;
    if (fields.goal.trim()) pts += FIELD_SCORES.goal.points;
    if (fields.features.trim()) pts += FIELD_SCORES.features.points;
    return pts;
  }, [fields]);

  const boostPct = Math.round((boost / MAX_BOOST) * 100);
  const boostLevel = boost === 0 ? "none" : boost <= 15 ? "low" : boost <= 30 ? "med" : "high";

  return (
    <div className="case-report-card">
      <div className="case-report-card-header">
        <h3>📋 Case Details</h3>
        <p className="case-report-card-hint">
          Fill in what you can — each field improves diagnosis accuracy.
        </p>
      </div>

      {/* Confidence Boost Meter */}
      <div className="case-boost-meter">
        <div className="case-boost-row">
          <span className="case-boost-label">Confidence Boost</span>
          <span className={`case-boost-value case-boost-${boostLevel}`}>
            {boost > 0 ? `+${boost} pts` : "—"}
          </span>
        </div>
        <div className="case-boost-bar">
          <div
            className={`case-boost-fill case-boost-fill-${boostLevel}`}
            style={{ width: `${boostPct}%` }}
          />
        </div>
      </div>

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

        <div className="case-report-field">
          <label>What changed recently?</label>
          <input
            type="text"
            placeholder="e.g. Migrated to 5.4, changed lighting"
            value={fields.whatChangedRecently}
            onChange={(e) => handleChange("whatChangedRecently", e.target.value)}
            disabled={disabled}
            maxLength={300}
          />
        </div>

        <div className="case-report-field">
          <label>What are you trying to achieve?</label>
          <input
            type="text"
            placeholder="e.g. Realistic interior lighting"
            value={fields.goal}
            onChange={(e) => handleChange("goal", e.target.value)}
            disabled={disabled}
            maxLength={200}
          />
        </div>

        <div className="case-report-field">
          <label>Active Features (comma separated)</label>
          <input
            type="text"
            placeholder="e.g. Lumen, Nanite, VSM"
            value={fields.features}
            onChange={(e) => handleChange("features", e.target.value)}
            disabled={disabled}
            maxLength={200}
          />
        </div>
      </div>
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
