/**
 * CaseReportForm - Always-visible sidebar panel for structured context.
 * Populates the caseReport object sent to the backend for better diagnosis.
 * Shows a confidence boost indicator for each filled field.
 */
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import "./FixProblem.css";

const MAX_LONG_EDGE_PX = 1024;
const JPEG_QUALITY = 0.8;
const ENCODED_MIME = "image/jpeg";

/**
 * Downscale to a 1024px long edge and JPEG-encode at 0.8.
 * Returns { base64, mimeType } where base64 is the raw payload (no data: prefix).
 * Resolves to null on any failure — screenshot then propagates as if absent.
 */
function downscaleAndEncode(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        const longEdge = Math.max(img.width, img.height);
        const scale = longEdge > MAX_LONG_EDGE_PX ? MAX_LONG_EDGE_PX / longEdge : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL(ENCODED_MIME, JPEG_QUALITY);
        const comma = dataUrl.indexOf(",");
        if (comma < 0) return resolve(null);
        resolve({ base64: dataUrl.slice(comma + 1), mimeType: ENCODED_MIME });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Scoring: how many confidence points each field contributes */
const FIELD_SCORES = {
  engineVersion: { points: 15, label: "Engine Version" },
  platform: { points: 5, label: "Platform" },
  renderer: { points: 10, label: "Renderer" },
  whatChangedRecently: { points: 10, label: "Recent Changes" },
  goal: { points: 5, label: "Goal" },
  features: { points: 5, label: "Features" },
  logText: { points: 15, label: "Output Log" },
  screenshot: { points: 10, label: "Screenshot" },
};
const MAX_BOOST = Object.values(FIELD_SCORES).reduce((s, f) => s + f.points, 0);

/** Truncate log to last N lines */
const MAX_LOG_LINES = 200;
const MAX_LOG_CHARS = 4000;
const MAX_IMAGE_MB = 2;
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export default function CaseReportForm({ onUpdate, disabled }) {
  const [fields, setFields] = useState({
    engineVersion: "",
    platform: "",
    context: "",
    renderer: "",
    features: "",
    whatChangedRecently: "",
    goal: "",
    logText: "",
  });
  const [screenshot, setScreenshot] = useState(null); // { file, previewUrl, base64, mimeType }
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const buildCaseReport = useCallback(
    (currentFields, currentScreenshot) => {
      let logText = currentFields.logText.trim() || undefined;
      if (logText) {
        const lines = logText.split("\n");
        if (lines.length > MAX_LOG_LINES) {
          logText = lines.slice(-MAX_LOG_LINES).join("\n");
        }
        if (logText.length > MAX_LOG_CHARS) {
          logText = logText.slice(-MAX_LOG_CHARS);
        }
      }

      return {
        engineVersion: currentFields.engineVersion.trim() || undefined,
        platform: currentFields.platform.trim() || undefined,
        context: currentFields.context.trim() || undefined,
        renderer: currentFields.renderer.trim() || undefined,
        features: currentFields.features
          ? currentFields.features
              .split(",")
              .map((f) => f.trim())
              .filter(Boolean)
          : [],
        whatChangedRecently: currentFields.whatChangedRecently.trim() || undefined,
        goal: currentFields.goal.trim() || undefined,
        logText,
        screenshotBase64: currentScreenshot?.base64 || undefined,
        screenshotMimeType: currentScreenshot?.mimeType || undefined,
      };
    },
    []
  );

  const handleChange = useCallback(
    (field, value) => {
      const updated = { ...fields, [field]: value };
      setFields(updated);
      const caseReport = buildCaseReport(updated, screenshot);
      const hasData = Object.values(caseReport).some(
        (v) => v !== undefined && (!Array.isArray(v) || v.length > 0)
      );
      onUpdate(hasData ? caseReport : null);
    },
    [fields, onUpdate, screenshot, buildCaseReport]
  );

  // Propagate screenshot add/remove on its own — without this, dropping in an
  // image and asking the question never updates parent state because handleChange
  // only fires on text-field edits.
  useEffect(() => {
    const caseReport = buildCaseReport(fields, screenshot);
    const hasData = Object.values(caseReport).some(
      (v) => v !== undefined && (!Array.isArray(v) || v.length > 0)
    );
    onUpdate(hasData ? caseReport : null);
    // Only fire when the encoded screenshot changes — not on every keystroke
    // (handleChange already covers that).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenshot?.base64]);

  // Compute confidence boost from filled fields
  const boost = useMemo(() => {
    let pts = 0;
    if (fields.engineVersion.trim()) pts += FIELD_SCORES.engineVersion.points;
    if (fields.platform) pts += FIELD_SCORES.platform.points;
    if (fields.renderer) pts += FIELD_SCORES.renderer.points;
    if (fields.whatChangedRecently.trim()) pts += FIELD_SCORES.whatChangedRecently.points;
    if (fields.goal.trim()) pts += FIELD_SCORES.goal.points;
    if (fields.features.trim()) pts += FIELD_SCORES.features.points;
    if (fields.logText.trim()) pts += FIELD_SCORES.logText.points;
    if (screenshot) pts += FIELD_SCORES.screenshot.points;
    return pts;
  }, [fields, screenshot]);

  // --- Image handling ---
  const handleImageFile = useCallback(async (file) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      alert("Please drop a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      alert(`Image must be under ${MAX_IMAGE_MB}MB.`);
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    // Show preview immediately so the user gets feedback while the encode runs.
    setScreenshot({ file, previewUrl });
    const encoded = await downscaleAndEncode(file);
    if (!encoded) {
      alert("Could not process this image. Try a different file.");
      URL.revokeObjectURL(previewUrl);
      setScreenshot(null);
      return;
    }
    setScreenshot({ file, previewUrl, base64: encoded.base64, mimeType: encoded.mimeType });
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer?.files?.[0];
      handleImageFile(file);
    },
    [handleImageFile]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const removeScreenshot = useCallback(() => {
    if (screenshot?.previewUrl) URL.revokeObjectURL(screenshot.previewUrl);
    setScreenshot(null);
  }, [screenshot]);

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
        <div
          className="case-boost-bar"
          role="progressbar"
          aria-valuenow={boost}
          aria-valuemin="0"
          aria-valuemax={MAX_BOOST}
          aria-valuetext={`${boostPct}% confidence boost`}
        >
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

      {/* Collapsible context drawer */}
      <details className="case-context-drawer">
        <summary className="case-context-summary">📎 Add logs & screenshots (optional)</summary>

        <div className="case-context-content">
          {/* Log paste area */}
          <div className="case-report-field">
            <label>UE5 Output Log</label>
            <textarea
              className="case-log-textarea"
              placeholder="Paste your UE5 output log here... (last 200 lines used)"
              value={fields.logText}
              onChange={(e) => handleChange("logText", e.target.value)}
              disabled={disabled}
              rows={6}
            />
            {fields.logText.trim() && (
              <span className="case-log-hint">
                {fields.logText.split("\n").length} lines
                {fields.logText.split("\n").length > MAX_LOG_LINES
                  ? ` (last ${MAX_LOG_LINES} will be used)`
                  : ""}
              </span>
            )}
          </div>

          {/* Image drop zone */}
          <div className="case-report-field">
            <label>Screenshot</label>
            {screenshot ? (
              <div className="case-screenshot-preview">
                <img
                  src={screenshot.previewUrl}
                  alt="Screenshot preview"
                  className="case-screenshot-img"
                />
                <button
                  type="button"
                  className="case-screenshot-remove"
                  onClick={removeScreenshot}
                  disabled={disabled}
                  title="Remove screenshot"
                  aria-label="Remove screenshot"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                className={`case-dropzone ${isDragging ? "case-dropzone-active" : ""}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <span className="case-dropzone-icon">📷</span>
                <span className="case-dropzone-text">Drop image here or click to browse</span>
                <span className="case-dropzone-hint">PNG, JPEG, WebP — max {MAX_IMAGE_MB}MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="case-dropzone-input"
                  onChange={(e) => handleImageFile(e.target.files?.[0])}
                  disabled={disabled}
                />
              </div>
            )}
          </div>
        </div>
      </details>
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
