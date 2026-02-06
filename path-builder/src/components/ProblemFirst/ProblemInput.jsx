/**
 * ProblemInput - Plain-English problem description input
 * With auto-detection of error signatures and UE5 tags
 */
import { useState, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import tagGraphService from "../../services/TagGraphService";
import "./ProblemFirst.css";

export default function ProblemInput({ onSubmit, detectedPersona, isLoading }) {
  const [problem, setProblem] = useState("");
  const [detectedTags, setDetectedTags] = useState([]);

  // Debounce tag detection to avoid excessive processing
  const handleChange = useCallback((e) => {
    const text = e.target.value;
    setProblem(text);

    // Only run detection after 300ms of no typing
    if (text.length > 15) {
      const matches = tagGraphService.matchErrorSignature(text);
      const tagMatches = tagGraphService.extractTagsFromText(text);

      // Combine and deduplicate
      const allMatches = [...matches, ...tagMatches];
      const seen = new Set();
      const unique = allMatches.filter((m) => {
        if (seen.has(m.tag.tag_id)) return false;
        seen.add(m.tag.tag_id);
        return true;
      });

      setDetectedTags(unique.slice(0, 5)); // Limit to 5 tags
    } else {
      setDetectedTags([]);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (problem.trim().length < 10) return;

    onSubmit({
      query: problem,
      detectedTagIds: detectedTags.map((t) => t.tag.tag_id),
      personaHint: detectedPersona?.name,
    });
  }, [problem, detectedTags, detectedPersona, onSubmit]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && e.ctrlKey) {
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const placeholderExamples = useMemo(
    () => [
      'My Blueprint Cast is giving me "Accessed None" error when trying to...',
      "Lumen is too noisy in my interior scene and I've tried increasing quality...",
      "My character animation stutters when blending between states...",
      "Nanite is causing Z-fighting on overlapping meshes...",
      "Material instances aren't updating at runtime when I change parameters...",
    ],
    []
  );

  // Use first placeholder (avoiding Math.random in render)
  const randomPlaceholder = placeholderExamples[0];

  return (
    <div className="problem-input-container">
      <div className="problem-input-header">
        <h2>🔍 What's the problem?</h2>
        <p className="subtitle">
          Describe your UE5 issue in plain English. We'll diagnose the root cause and teach you to
          fix it.
        </p>
      </div>

      <div className="problem-input-field">
        <textarea
          value={problem}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={randomPlaceholder}
          rows={5}
          disabled={isLoading}
          aria-label="Problem description"
        />
        <div className="char-count">
          {problem.length} characters
          {problem.length < 10 && problem.length > 0 && (
            <span className="warning"> (minimum 10)</span>
          )}
        </div>
      </div>

      {detectedTags.length > 0 && (
        <div className="detected-tags">
          <span className="label">🏷️ Detected:</span>
          <div className="tag-list">
            {detectedTags.map((match) => (
              <span
                key={match.tag.tag_id}
                className="tag-chip"
                title={match.tag.description || match.tag.display_name}
              >
                {match.tag.display_name}
                <span className="confidence">{Math.round(match.confidence * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {detectedPersona && (
        <div className="persona-context">
          <span className="label">👤 Context:</span>
          <span className="persona-chip">
            {detectedPersona.emoji || "🎮"} {detectedPersona.name}
          </span>
          <span className="hint">Recommendations will be tailored for you</span>
        </div>
      )}

      <div className="problem-input-actions">
        <button
          className="submit-btn primary"
          onClick={handleSubmit}
          disabled={problem.trim().length < 10 || isLoading}
        >
          {isLoading ? (
            <>
              <span className="spinner" /> Diagnosing...
            </>
          ) : (
            <>Get Diagnosis →</>
          )}
        </button>
        <span className="hint">
          Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to submit
        </span>
      </div>
    </div>
  );
}

ProblemInput.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  detectedPersona: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    emoji: PropTypes.string,
  }),
  isLoading: PropTypes.bool,
};

ProblemInput.defaultProps = {
  detectedPersona: null,
  isLoading: false,
};
