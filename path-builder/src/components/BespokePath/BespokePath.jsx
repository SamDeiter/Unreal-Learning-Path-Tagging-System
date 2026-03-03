/**
 * BespokePath — AI-generated "Fix a Problem" learning path UI
 *
 * Renders the full bespoke path experience:
 * 1. Query input → 2. Loading pipeline → 3. Sequenced path with bridge narrations
 */

import { useState, useCallback } from "react";
import { generateBespokePath } from "../../services/bespokePathService";
import PathStep from "./PathStep";
import BridgeNarration from "./BridgeNarration";
import PathProgress from "./PathProgress";
import "./BespokePath.css";

const EXAMPLE_QUERIES = [
  "How do I fix character animation jittering in multiplayer?",
  "Why does my material look different in Lumen vs path tracing?",
  "How to optimize Nanite meshes for open world performance?",
  "Setting up Gameplay Ability System for a melee combat game",
  "Why is my landscape material tiling so visible at distance?",
];

export default function BespokePath() {
  const [query, setQuery] = useState("");
  const [pathResult, setPathResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [pipelineStage, setPipelineStage] = useState("");

  const handleGenerate = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setPathResult(null);
    setCurrentStep(0);

    // Show pipeline stages for UX feedback
    setPipelineStage("Finding relevant content...");
    const result = await generateBespokePath(trimmed);

    if (!result.error && result.path.length > 0) {
      setPipelineStage("Path ready!");
    }

    setPathResult(result);
    setIsLoading(false);
    setPipelineStage("");
  }, [query, isLoading]);

  const handleExampleClick = (example) => {
    setQuery(example);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="bespoke-path">
      {/* Query Input Section */}
      <div className="bespoke-hero">
        <h2 className="bespoke-title">
          <span className="bespoke-icon">🔧</span> Fix a Problem
        </h2>
        <p className="bespoke-subtitle">
          Describe your UE5 problem and get an AI-curated learning path with video clips, docs, and
          step-by-step guidance.
        </p>

        <div className="bespoke-input-area">
          <div className="bespoke-input-wrapper">
            <textarea
              className="bespoke-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What UE5 problem are you trying to solve?"
              rows={2}
              disabled={isLoading}
            />
            <button
              className="bespoke-submit"
              onClick={handleGenerate}
              disabled={isLoading || !query.trim()}
            >
              {isLoading ? <span className="bespoke-spinner" /> : "🚀 Generate Path"}
            </button>
          </div>

          {/* Example queries */}
          {!pathResult && !isLoading && (
            <div className="bespoke-examples">
              <span className="examples-label">Try:</span>
              {EXAMPLE_QUERIES.map((ex, i) => (
                <button key={i} className="example-chip" onClick={() => handleExampleClick(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bespoke-loading">
          <div className="pipeline-indicator">
            <div className="pipeline-dots">
              <span className="dot active" />
              <span className="dot" />
              <span className="dot" />
            </div>
            <p className="pipeline-stage">{pipelineStage}</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {pathResult?.error && (
        <div className="bespoke-error">
          <span className="error-icon">⚠️</span>
          <p>{pathResult.error}</p>
        </div>
      )}

      {/* Path Results */}
      {pathResult && !pathResult.error && pathResult.path.length > 0 && (
        <div className="bespoke-results">
          <PathProgress
            steps={pathResult.path}
            currentStep={currentStep}
            onStepClick={setCurrentStep}
          />

          <div className="path-steps">
            {pathResult.path.map((step, i) => (
              <div key={step.segment.id || i}>
                {/* Bridge narration between steps */}
                {i > 0 && (
                  <BridgeNarration
                    bridge={pathResult.bridges.find((b) => b.from === i - 1 && b.to === i)}
                    fromCategory={pathResult.path[i - 1].category}
                    toCategory={step.category}
                  />
                )}

                <PathStep
                  step={step}
                  index={i}
                  isActive={i === currentStep}
                  onClick={() => setCurrentStep(i)}
                />
              </div>
            ))}
          </div>

          {/* Meta info */}
          <div className="bespoke-meta">
            <span>
              {pathResult.path.length} steps • {pathResult.segments.length} sources searched •{" "}
              Generated {new Date(pathResult.generatedAt).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
