/**
 * ProblemInput - Enhanced problem description input
 * Features:
 *   - Plain-English text description
 *   - Category-grouped tag picker for user context
 *   - Paste (Ctrl+V) + Drag-and-Drop screenshot zone
 *   - Error log paste area
 *   - Auto-detection of error signatures and UE5 tags
 */
import { useState, useMemo, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { Search, Tags, User, Image, Terminal, X, ChevronDown, ChevronUp } from "lucide-react";
import tagGraphService from "../../services/TagGraphService";
import { useTagData } from "../../context/TagDataContext";
import "./ProblemFirst.css";

export default function ProblemInput({ onSubmit, detectedPersona, isLoading }) {
  const [problem, setProblem] = useState("");
  const [detectedTags, setDetectedTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [pastedImage, setPastedImage] = useState(null); // base64 data URL
  const [errorLog, setErrorLog] = useState("");
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showErrorLog, setShowErrorLog] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dropZoneRef = useRef(null);

  // Past question history (last 6)
  const [queryHistory, setQueryHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("fix-problem-history") || "[]");
    } catch { return []; }
  });

  // Get tags from context
  const tagData = useTagData();
  const allTags = useMemo(() => tagData?.tags || [], [tagData?.tags]);

  // Group tags by top-level category
  const tagsByCategory = useMemo(() => {
    const groups = {};
    allTags.forEach((tag) => {
      const category =
        tag.category_path?.[0] ||
        tag.category ||
        tag.tag_id?.split(".")[0]?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ||
        "Other";
      if (!groups[category]) groups[category] = [];
      groups[category].push(tag);
    });
    // Sort categories alphabetically, put "Other" last
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });
  }, [allTags]);

  // Debounce tag detection
  const handleChange = useCallback((e) => {
    const text = e.target.value;
    setProblem(text);

    if (text.length > 15) {
      const errorMatches = tagGraphService.matchErrorSignature(text);
      // V2: extractTagsFromText returns { matches: [{tag, confidence, ...}], ... }
      const tagResult = tagGraphService.extractTagsFromText(text);
      // Merge error signature matches with V2 tag matches (normalize shape)
      const errorShaped = errorMatches.map((m) => ({ tag: m.tag, confidence: m.confidence }));
      const tagShaped = tagResult.matches.map((m) => ({ tag: m.tag, confidence: m.confidence }));
      const allMatches = [...errorShaped, ...tagShaped];
      const seen = new Set();
      const unique = allMatches.filter((m) => {
        if (seen.has(m.tag.tag_id)) return false;
        seen.add(m.tag.tag_id);
        return true;
      });
      setDetectedTags(unique.slice(0, 5));
    } else {
      setDetectedTags([]);
    }
  }, []);

  // Toggle user-selected tag
  const toggleTag = useCallback((tagId) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  // Handle clipboard paste for images
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (ev) => setPastedImage(ev.target.result);
        reader.readAsDataURL(file);
        return;
      }
    }
  }, []);

  // Handle drag-and-drop for images
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPastedImage(ev.target.result);
      reader.readAsDataURL(file);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (problem.trim().length < 10) return;

    // Save to history
    const trimmed = problem.trim();
    setQueryHistory((prev) => {
      const filtered = prev.filter((q) => q !== trimmed);
      const updated = [trimmed, ...filtered].slice(0, 6);
      localStorage.setItem("fix-problem-history", JSON.stringify(updated));
      return updated;
    });

    onSubmit({
      query: problem,
      detectedTagIds: detectedTags.map((t) => t.tag.tag_id),
      selectedTagIds,
      personaHint: detectedPersona?.name,
      pastedImage,
      errorLog: errorLog.trim() || null,
    });
  }, [problem, detectedTags, selectedTagIds, detectedPersona, onSubmit, pastedImage, errorLog]);

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

  const randomPlaceholder = placeholderExamples[0];

  return (
    <div className="problem-input-container" onPaste={handlePaste}>
      <div className="problem-input-header">
        <h2>
          <Search size={22} className="icon-inline" /> What's the problem?
        </h2>
        <p className="subtitle">
          Describe your UE5 issue in plain English. We'll diagnose the root cause and teach you to
          fix it.
        </p>
      </div>

      {/* Main text area */}
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

      {/* Auto-detected tags */}
      {detectedTags.length > 0 && (
        <div className="detected-tags">
          <span className="label">
            <Tags size={14} className="icon-inline" /> Detected:
          </span>
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

      {/* Tag Picker Toggle */}
      <div className="input-section-toggle">
        <button
          type="button"
          className={`toggle-btn ${showTagPicker ? "active" : ""}`}
          onClick={() => setShowTagPicker((v) => !v)}
        >
          <Tags size={14} />
          Select Topics
          {selectedTagIds.length > 0 && <span className="badge">{selectedTagIds.length}</span>}
          {showTagPicker ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <button
          type="button"
          className={`toggle-btn ${showErrorLog ? "active" : ""}`}
          onClick={() => setShowErrorLog((v) => !v)}
        >
          <Terminal size={14} />
          Paste Error Log
          {errorLog.trim() && <span className="badge">1</span>}
          {showErrorLog ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Tag Picker Panel */}
      {showTagPicker && (
        <div className="tag-picker">
          {tagsByCategory.map(([category, tags]) => (
            <div key={category} className="tag-group">
              <span className="group-label">{category}</span>
              <div className="group-chips">
                {tags.map((tag) => (
                  <button
                    key={tag.tag_id}
                    type="button"
                    className={`picker-chip ${selectedTagIds.includes(tag.tag_id) ? "selected" : ""}`}
                    onClick={() => toggleTag(tag.tag_id)}
                    title={tag.description}
                  >
                    {tag.display_name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error Log Paste Area */}
      {showErrorLog && (
        <div className="error-log-section">
          <textarea
            className="error-log-input"
            value={errorLog}
            onChange={(e) => setErrorLog(e.target.value)}
            placeholder="Paste your error output, build log, or crash log here..."
            rows={4}
          />
        </div>
      )}

      {/* Screenshot Paste / Drag-and-Drop Zone */}
      <div
        ref={dropZoneRef}
        className={`screenshot-zone ${isDragOver ? "drag-over" : ""} ${pastedImage ? "has-image" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {pastedImage ? (
          <div className="pasted-preview">
            <img src={pastedImage} alt="Pasted screenshot" />
            <button
              type="button"
              className="remove-image"
              onClick={() => setPastedImage(null)}
              aria-label="Remove screenshot"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="drop-prompt">
            <Image size={20} />
            <span>
              Paste (<kbd>Ctrl+V</kbd>) or drag a screenshot here
            </span>
          </div>
        )}
      </div>

      {/* Persona Context */}
      {detectedPersona && (
        <div className="persona-context">
          <span className="label">
            <User size={14} className="icon-inline" /> Context:
          </span>
          <span className="persona-chip">{detectedPersona.name}</span>
          <span className="hint">Recommendations will be tailored for you</span>
        </div>
      )}

      {/* Submit */}
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

      {/* Past question history */}
      {queryHistory.length > 0 && (
        <div className="query-history">
          <span className="history-label">🕘 Recent questions:</span>
          <div className="history-chips">
            {queryHistory.map((q, i) => (
              <div key={i} className="history-chip-row">
                <button
                  type="button"
                  className="history-chip"
                  onClick={() => {
                    setProblem(q);
                    const fakeEvent = { target: { value: q } };
                    handleChange(fakeEvent);
                  }}
                  title={q}
                >
                  {q.length > 50 ? q.slice(0, 50) + "…" : q}
                </button>
                <button
                  type="button"
                  className="history-delete"
                  onClick={() => {
                    setQueryHistory((prev) => {
                      const updated = prev.filter((_, j) => j !== i);
                      localStorage.setItem("fix-problem-history", JSON.stringify(updated));
                      return updated;
                    });
                  }}
                  title="Remove"
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}
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
