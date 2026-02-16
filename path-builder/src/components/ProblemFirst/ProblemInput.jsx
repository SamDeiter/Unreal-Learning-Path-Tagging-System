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
import { Search, User, Image, Terminal, XCircle, Tags } from "lucide-react";
import tagGraphService from "../../services/TagGraphService";

import "./ProblemFirst.css";



export default function ProblemInput({ onSubmit, detectedPersona, isLoading }) {
  const [problem, setProblem] = useState("");
  const [detectedTags, setDetectedTags] = useState([]);
  const [pastedImage, setPastedImage] = useState(null); // base64 data URL
  const [errorLog, setErrorLog] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const dropZoneRef = useRef(null);

  // Past question history (last 6) — stored as {query, cartId} objects
  // Migrate from old string[] format on first load
  const [queryHistory, setQueryHistory] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("fix-problem-history") || "[]");
      // Migrate old string[] → {query, cartId}[] format
      const migrated = raw.map((item) =>
        typeof item === "string" ? { query: item, cartId: null } : item
      );
      if (raw.length > 0 && typeof raw[0] === "string") {
        localStorage.setItem("fix-problem-history", JSON.stringify(migrated));
      }
      return migrated;
    } catch { return []; }
  });



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

  // Save a cart_id to history after a fresh diagnosis completes
  const updateCartIdForQuery = useCallback((queryText, cartId) => {
    setQueryHistory((prev) => {
      const updated = prev.map((item) =>
        item.query === queryText ? { ...item, cartId } : item
      );
      localStorage.setItem("fix-problem-history", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Expose updateCartIdForQuery to parent via a ref-like pattern
  // The parent can call onSubmit and receive this function back
  const handleSubmit = useCallback((cachedCartId = null, overrideQuery = null) => {
    const queryText = (overrideQuery || problem).trim();
    if (queryText.length < 10) return;

    // Save to history (without cartId yet — it comes after diagnosis)
    setQueryHistory((prev) => {
      const filtered = prev.filter((item) => item.query !== queryText);
      const updated = [{ query: queryText, cartId: cachedCartId }, ...filtered].slice(0, 6);
      localStorage.setItem("fix-problem-history", JSON.stringify(updated));
      return updated;
    });

    onSubmit({
      query: queryText,
      detectedTagIds: detectedTags.map((t) => t.tag.tag_id),
      selectedTagIds: [],
      personaHint: detectedPersona?.name,
      pastedImage,
      errorLog: errorLog.trim() || null,
      cachedCartId: cachedCartId || null,
      updateCartIdForQuery,
    });
  }, [problem, detectedTags, detectedPersona, onSubmit, pastedImage, errorLog, updateCartIdForQuery]);

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

      {/* Error Log Paste Zone — matches screenshot drop zone style */}
      <div
        className={`screenshot-zone ${errorLog.trim() ? "has-image" : ""}`}
        onClick={() => {
          if (!errorLog.trim()) {
            document.getElementById("error-log-input")?.focus();
          }
        }}
      >
        {errorLog.trim() ? (
          <div className="pasted-preview error-log-preview">
            <pre className="error-log-display">{errorLog}</pre>
            <button
              type="button"
              className="clear-error-log"
              onClick={(e) => { e.stopPropagation(); setErrorLog(""); }}
              aria-label="Remove error log"
              title="Clear error log"
            >
              <XCircle size={20} />
            </button>
          </div>
        ) : (
          <div className="drop-prompt">
            <Terminal size={20} />
            <span>
              Paste (<kbd>Ctrl+V</kbd>) an error log or build output
            </span>
          </div>
        )}
        <textarea
          id="error-log-input"
          className="error-log-hidden-input"
          value={errorLog}
          onChange={(e) => setErrorLog(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData?.getData("text");
            if (text) {
              e.preventDefault();
              setErrorLog(text);
            }
          }}
          rows={1}
        />
      </div>

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
              className="clear-error-log"
              onClick={() => setPastedImage(null)}
              aria-label="Remove screenshot"
              title="Remove screenshot"
            >
              <XCircle size={20} />
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
          onClick={() => handleSubmit()}
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
            {queryHistory.map((item, i) => {
              const q = item.query || item; // backward compat
              const cartId = item.cartId || null;
              const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
              const isCached = Boolean(cartId);
              return (
                <div key={i} className="history-chip-row">
                  <button
                    type="button"
                    className={`history-chip ${isCached ? "cached" : ""}`}
                    onClick={() => {
                      setProblem(q);
                      const fakeEvent = { target: { value: q } };
                      handleChange(fakeEvent);
                      // Auto-submit with cached cart ID if available
                      if (isCached && !isLoading) {
                        // Pass q as overrideQuery to avoid stale closure
                        setTimeout(() => handleSubmit(cartId, q), 50);
                      }
                    }}
                    title={isCached ? `${q} (cached — instant load)` : q}
                    disabled={isLoading}
                  >
                    {isCached && <span className="cache-indicator">⚡</span>}
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
              );
            })}
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
