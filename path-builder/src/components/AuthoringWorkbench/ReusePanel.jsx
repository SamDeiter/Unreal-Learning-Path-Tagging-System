/**
 * ReusePanel.jsx — Video Content Reuse Dashboard
 *
 * Shows per-step reuse/adapt/record classification with summary metrics,
 * matched video thumbnails, timestamps, and optional FFmpeg splice commands.
 */

import React, { useState } from "react";
import "./ReusePanel.css";

const STATUS_CONFIG = {
  reuse: { emoji: "🟢", label: "Reuse", className: "rp-status-reuse" },
  adapt: { emoji: "🟡", label: "Adapt", className: "rp-status-adapt" },
  record: { emoji: "🔴", label: "Record", className: "rp-status-record" },
};

export default function ReusePanel({
  report,
  analyzing,
  progress,
  onReAnalyze,
  onAutoLink,
}) {
  const [advancedMode, setAdvancedMode] = useState(false);
  const [expandedStep, setExpandedStep] = useState(null);

  if (!report && !analyzing) return null;

  const { steps = [], summary = {} } = report || {};

  return (
    <div className="rp-container">
      {/* ── Header ───────────────────────────── */}
      <div className="rp-header">
        <div className="rp-title-row">
          <h3 className="rp-title">📊 Content Reuse Analysis</h3>
          <div className="rp-actions">
            <label className="rp-toggle">
              <input
                type="checkbox"
                checked={advancedMode}
                onChange={(e) => setAdvancedMode(e.target.checked)}
              />
              <span className="rp-toggle-label">Advanced</span>
            </label>
            <button
              className="rp-btn rp-btn-secondary"
              onClick={onReAnalyze}
              disabled={analyzing}
            >
              {analyzing ? "Analyzing…" : "🔄 Re-Analyze"}
            </button>
            {report && summary.reuseCount > 0 && (
              <button className="rp-btn rp-btn-primary" onClick={onAutoLink}>
                🔗 Auto-Link {summary.reuseCount} Video{summary.reuseCount !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>

        {/* ── Progress bar during analysis ──── */}
        {analyzing && progress && (
          <div className="rp-progress-bar">
            <div
              className="rp-progress-fill"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
            <span className="rp-progress-text">
              Analyzing step {progress.current} of {progress.total}…
            </span>
          </div>
        )}
      </div>

      {/* ── Summary Bar ──────────────────────── */}
      {report && (
        <div className="rp-summary">
          <div className="rp-summary-pills">
            <span className="rp-pill rp-pill-reuse">
              🟢 Reuse: {summary.reusePercent}%
              <small>({summary.reuseCount})</small>
            </span>
            <span className="rp-pill rp-pill-adapt">
              🟡 Adapt: {summary.adaptPercent}%
              <small>({summary.adaptCount})</small>
            </span>
            <span className="rp-pill rp-pill-record">
              🔴 Record: {summary.recordPercent}%
              <small>({summary.recordCount})</small>
            </span>
          </div>
          <div className="rp-summary-bar">
            {summary.reusePercent > 0 && (
              <div
                className="rp-bar-segment rp-bar-reuse"
                style={{ width: `${summary.reusePercent}%` }}
                title={`Reuse: ${summary.reusePercent}%`}
              />
            )}
            {summary.adaptPercent > 0 && (
              <div
                className="rp-bar-segment rp-bar-adapt"
                style={{ width: `${summary.adaptPercent}%` }}
                title={`Adapt: ${summary.adaptPercent}%`}
              />
            )}
            {summary.recordPercent > 0 && (
              <div
                className="rp-bar-segment rp-bar-record"
                style={{ width: `${summary.recordPercent}%` }}
                title={`Record: ${summary.recordPercent}%`}
              />
            )}
          </div>
          {summary.estimatedRecordingMinutes > 0 && (
            <p className="rp-recording-estimate">
              ⏱ Estimated new recording needed:{" "}
              <strong>~{summary.estimatedRecordingMinutes} min</strong>
            </p>
          )}
        </div>
      )}

      {/* ── Step List ────────────────────────── */}
      {report && steps.length > 0 && (
        <div className="rp-step-list">
          {steps.map((s, idx) => {
            const cfg = STATUS_CONFIG[s.status];
            const isExpanded = expandedStep === idx;

            return (
              <div
                key={s.stepId || idx}
                className={`rp-step ${cfg.className} ${isExpanded ? "rp-step-expanded" : ""}`}
                onClick={() => setExpandedStep(isExpanded ? null : idx)}
              >
                <div className="rp-step-row">
                  <span className="rp-step-status">{cfg.emoji}</span>
                  <span className="rp-step-title">{s.title}</span>
                  <span className="rp-step-confidence">
                    {Math.round(s.confidence * 100)}%
                  </span>
                  {s.match && (
                    <span className="rp-step-match-brief">
                      {s.match.videoTitle} @ {s.match.startFormatted}–{s.match.endFormatted}
                    </span>
                  )}
                  {!s.match && s.status === "record" && (
                    <span className="rp-step-no-match">No match — needs recording</span>
                  )}
                  <span className="rp-step-chevron">{isExpanded ? "▾" : "▸"}</span>
                </div>

                {/* ── Expanded Details ──────────── */}
                {isExpanded && s.match && (
                  <div className="rp-step-details">
                    <div className="rp-detail-grid">
                      {s.match.thumbnailUrl && (
                        <img
                          src={s.match.thumbnailUrl}
                          alt={s.match.videoTitle}
                          className="rp-thumbnail"
                        />
                      )}
                      <div className="rp-detail-info">
                        <p>
                          <strong>Source:</strong> {s.match.videoTitle}
                        </p>
                        <p>
                          <strong>Segment:</strong> {s.match.startFormatted} –{" "}
                          {s.match.endFormatted}
                        </p>
                        <p>
                          <strong>Similarity:</strong> {s.match.similarity}
                        </p>
                        {s.match.previewText && (
                          <p className="rp-preview-text">
                            "{s.match.previewText}…"
                          </p>
                        )}
                        {s.match.videoKey && (
                          <a
                            href={`https://youtube.com/watch?v=${s.match.videoKey}&t=${s.match.start}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rp-link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            ▶ Watch on YouTube
                          </a>
                        )}
                      </div>
                    </div>

                    {/* ── Advanced: FFmpeg ───────── */}
                    {advancedMode && s.match.spliceCommand && (
                      <div className="rp-ffmpeg-block">
                        <label>FFmpeg Splice Command:</label>
                        <code>{s.match.spliceCommand}</code>
                      </div>
                    )}
                  </div>
                )}

                {isExpanded && !s.match && (
                  <div className="rp-step-details rp-no-match-details">
                    <p>
                      No existing videos match this topic closely enough.
                      A recording brief will be generated when you export.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
