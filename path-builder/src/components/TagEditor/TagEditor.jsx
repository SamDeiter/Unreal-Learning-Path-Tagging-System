import { useMemo, useState, useCallback } from "react";
import { useTagData } from "../../context/TagDataContext";
import "./TagEditor.css";

/**
 * Tag Editor - Bulk tagging interface for efficient content tagging
 * Features: Multi-select courses, bulk add/remove tags, autocomplete, filters
 */
function TagEditor() {
  const { courses, tags } = useTagData();
  const [selectedCourses, setSelectedCourses] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [filter, setFilter] = useState("all"); // 'all' | 'untagged' | 'pending'
  const [pendingChanges, setPendingChanges] = useState([]); // Track changes before export
  const [activeTab, setActiveTab] = useState("bullkTagging"); // 'bulkTagging' | 'synonyms'

  // --- Synonym State ---
  const [synonymTarget, setSynonymTarget] = useState("");
  const [synonymSource, setSynonymSource] = useState("");
  const [pendingSynonyms, setPendingSynonyms] = useState([]);

  // Get all unique tags from the taxonomy
  const availableTags = useMemo(() => {
    const tagSet = new Set();

    // Add from base taxonomy
    tags?.forEach((tag) => {
      if (tag.label) tagSet.add(tag.label);
    });

    // Add commonly used tags from courses
    courses.forEach((course) => {
      course.gemini_system_tags?.forEach((t) => tagSet.add(t));
      course.canonical_tags?.forEach((t) => tagSet.add(t.split(".").pop()));
    });

    return Array.from(tagSet).sort();
  }, [tags, courses]);

  // Filter tag suggestions based on input
  const tagSuggestions = useMemo(() => {
    if (!tagInput.trim()) return availableTags.slice(0, 20);
    const lower = tagInput.toLowerCase();
    return availableTags.filter((t) => t.toLowerCase().includes(lower)).slice(0, 15);
  }, [tagInput, availableTags]);

  // Filter courses based on search and filter criteria
  const filteredCourses = useMemo(() => {
    let result = courses;

    // Apply status filter
    if (filter === "untagged") {
      result = result.filter((c) => !c.gemini_system_tags?.length && !c.canonical_tags?.length);
    } else if (filter === "pending") {
      result = result.filter((c) => !c.gemini_enriched);
    }

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.code?.toLowerCase().includes(q) ||
          c.title?.toLowerCase().includes(q) ||
          c.tags?.topic?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [courses, filter, searchQuery]);

  // Select/deselect a course
  const toggleCourse = useCallback((code) => {
    setSelectedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }, []);

  // Select all visible courses
  const selectAll = useCallback(() => {
    setSelectedCourses(new Set(filteredCourses.map((c) => c.code)));
  }, [filteredCourses]);

  // Deselect all
  const deselectAll = useCallback(() => {
    setSelectedCourses(new Set());
  }, []);

  // Add a tag to selected courses
  const addTagToSelected = useCallback(
    (tag) => {
      if (!tag.trim() || selectedCourses.size === 0) return;

      const change = {
        type: "add",
        tag: tag.trim(),
        courses: Array.from(selectedCourses),
        timestamp: new Date().toISOString(),
      };

      setPendingChanges((prev) => [...prev, change]);
      setTagInput("");
      setShowTagSuggestions(false);
    },
    [selectedCourses]
  );

  // Remove a tag from selected courses
  const removeTagFromSelected = useCallback(
    (tag) => {
      if (!tag.trim() || selectedCourses.size === 0) return;

      const change = {
        type: "remove",
        tag: tag.trim(),
        courses: Array.from(selectedCourses),
        timestamp: new Date().toISOString(),
      };

      setPendingChanges((prev) => [...prev, change]);
    },
    [selectedCourses]
  );

  // Get tags currently shared by all selected courses
  const sharedTags = useMemo(() => {
    if (selectedCourses.size === 0) return [];

    const selectedCourseData = courses.filter((c) => selectedCourses.has(c.code));
    if (selectedCourseData.length === 0) return [];

    // Get all tags from first selected course
    const firstTags = new Set([
      ...(selectedCourseData[0].gemini_system_tags || []),
      ...(selectedCourseData[0].canonical_tags || []),
    ]);

    // Keep only tags that appear in ALL selected courses
    selectedCourseData.forEach((course) => {
      const courseTags = new Set([
        ...(course.gemini_system_tags || []),
        ...(course.canonical_tags || []),
      ]);
      for (const tag of firstTags) {
        if (!courseTags.has(tag)) firstTags.delete(tag);
      }
    });

    return Array.from(firstTags);
  }, [selectedCourses, courses]);

  // Export pending changes as JSON
  const exportChanges = useCallback(() => {
    if (pendingChanges.length === 0) return;

    const blob = new Blob([JSON.stringify(pendingChanges, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tag_changes_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pendingChanges]);

  // Clear pending changes
  const clearChanges = useCallback(() => {
    setPendingChanges([]);
  }, []);

  // --- Synonym Handlers ---
  const addSynonymMapping = useCallback(() => {
    if (!synonymTarget.trim() || !synonymSource.trim()) return;

    const sourceTags = synonymSource
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const mapping = {
      type: "synonym",
      canonicalTag: synonymTarget.trim(),
      synonyms: sourceTags,
      timestamp: new Date().toISOString(),
    };

    setPendingSynonyms((prev) => [...prev, mapping]);
    setSynonymTarget("");
    setSynonymSource("");
  }, [synonymTarget, synonymSource]);

  const exportSynonyms = useCallback(() => {
    if (pendingSynonyms.length === 0) return;

    // Format for easy merging into tags.json
    const exportFormat = pendingSynonyms.map((m) => ({
      label: m.canonicalTag,
      category: "needs_category",
      synonyms: m.synonyms,
    }));

    const blob = new Blob([JSON.stringify(exportFormat, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `synonym_mappings_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pendingSynonyms]);

  const clearSynonyms = useCallback(() => {
    setPendingSynonyms([]);
  }, []);

  return (
    <div className="tag-editor">
      {/* Header */}
      <div className="te-header">
        <div className="te-header-top">
          <h2>✏️ Tag & Synonym Editor</h2>
          <div className="te-tabs">
            <button
              className={activeTab === "bulkTagging" ? "active" : ""}
              onClick={() => setActiveTab("bulkTagging")}
            >
              Bulk Tagging
            </button>
            <button
              className={activeTab === "synonyms" ? "active" : ""}
              onClick={() => setActiveTab("synonyms")}
            >
              Synonyms & Ontology
            </button>
          </div>
        </div>
        <p>Manage content tags, synonyms, and relationships efficiently.</p>
      </div>

      {activeTab === "bulkTagging" ? (
        <>
          {/* Toolbar */}
          <div className="te-toolbar">
            <div className="te-search">
              <input
                type="text"
                placeholder="Search courses by code, title, or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="te-filters">
              <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
                All ({courses.length})
              </button>
              <button
                className={filter === "untagged" ? "active" : ""}
                onClick={() => setFilter("untagged")}
              >
                Untagged
              </button>
              <button
                className={filter === "pending" ? "active" : ""}
                onClick={() => setFilter("pending")}
              >
                Pending AI
              </button>
            </div>
            <div className="te-selection-actions">
              <button onClick={selectAll}>Select All ({filteredCourses.length})</button>
              <button onClick={deselectAll}>Deselect All</button>
            </div>
          </div>

          {/* Main content area */}
          <div className="te-content">
            {/* Course list */}
            <div className="te-courses">
              <div className="te-courses-header">
                <span className="selected-count">{selectedCourses.size} selected</span>
              </div>
              <div className="te-course-list">
                {filteredCourses.map((course) => (
                  <div
                    key={course.code}
                    className={`te-course-item ${selectedCourses.has(course.code) ? "selected" : ""}`}
                    onClick={() => toggleCourse(course.code)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCourses.has(course.code)}
                      onChange={() => {}}
                    />
                    <div className="te-course-info">
                      <div className="te-course-header">
                        <span className="code">{course.code}</span>
                        {course.gemini_enriched ? (
                          <span className="ai-badge">AI</span>
                        ) : (
                          <span className="pending-badge">Pending</span>
                        )}
                      </div>
                      <div className="te-course-title">{course.title}</div>
                      <div className="te-course-tags">
                        {course.tags?.topic && (
                          <span className="mini-tag base">{course.tags.topic}</span>
                        )}
                        {course.gemini_system_tags?.slice(0, 3).map((t) => (
                          <span key={t} className="mini-tag ai">
                            {t}
                          </span>
                        ))}
                        {(course.gemini_system_tags?.length || 0) > 3 && (
                          <span className="more-tags">+{course.gemini_system_tags.length - 3}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tag actions panel */}
            <div className="te-actions">
              <div className="te-actions-section">
                <h3>Add Tags</h3>
                <p className="te-hint">
                  {selectedCourses.size > 0
                    ? `Add tags to ${selectedCourses.size} selected courses`
                    : "Select courses to add tags"}
                </p>
                <div className="te-tag-input-wrapper">
                  <input
                    type="text"
                    placeholder="Type tag name..."
                    value={tagInput}
                    onChange={(e) => {
                      setTagInput(e.target.value);
                      setShowTagSuggestions(true);
                    }}
                    onFocus={() => setShowTagSuggestions(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tagInput.trim()) {
                        addTagToSelected(tagInput);
                      }
                    }}
                    disabled={selectedCourses.size === 0}
                  />
                  <button
                    className="add-btn"
                    onClick={() => addTagToSelected(tagInput)}
                    disabled={!tagInput.trim() || selectedCourses.size === 0}
                  >
                    + Add
                  </button>
                </div>
                {showTagSuggestions && tagSuggestions.length > 0 && (
                  <div className="te-suggestions">
                    {tagSuggestions.map((tag) => (
                      <button
                        key={tag}
                        className="suggestion-btn"
                        onClick={() => addTagToSelected(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedCourses.size > 0 && sharedTags.length > 0 && (
                <div className="te-actions-section">
                  <h3>Remove Tags</h3>
                  <p className="te-hint">Tags shared by all selected courses</p>
                  <div className="te-shared-tags">
                    {sharedTags.map((tag) => (
                      <button
                        key={tag}
                        className="removable-tag"
                        onClick={() => removeTagFromSelected(tag)}
                        title="Click to remove from selected courses"
                      >
                        {tag} ×
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending changes */}
              {pendingChanges.length > 0 && (
                <div className="te-actions-section te-pending">
                  <h3>Pending Changes ({pendingChanges.length})</h3>
                  <div className="te-changes-list">
                    {pendingChanges.slice(-5).map((change, i) => (
                      <div key={i} className={`change-item ${change.type}`}>
                        <span className="change-type">{change.type === "add" ? "+" : "−"}</span>
                        <span className="change-tag">{change.tag}</span>
                        <span className="change-count">({change.courses.length} courses)</span>
                      </div>
                    ))}
                  </div>
                  <div className="te-actions-buttons">
                    <button className="export-btn" onClick={exportChanges}>
                      📥 Export Changes
                    </button>
                    <button className="clear-btn" onClick={clearChanges}>
                      🗑️ Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Quick stats */}
              <div className="te-actions-section te-stats">
                <h3>Quick Stats</h3>
                <div className="stat-row">
                  <span>Total courses:</span>
                  <span>{courses.length}</span>
                </div>
                <div className="stat-row">
                  <span>AI enriched:</span>
                  <span>{courses.filter((c) => c.gemini_enriched).length}</span>
                </div>
                <div className="stat-row">
                  <span>Untagged:</span>
                  <span>{courses.filter((c) => !c.gemini_system_tags?.length).length}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Synonyms Tab */}
          <div className="te-synonym-content">
            <div className="te-synonym-panel te-actions-section">
              <h3>Map Synonyms to Canonical Tags</h3>
              <p className="te-hint">
                Define aliases that should resolve to a single canonical tag. (e.g., Target:
                "blueprints", Synonyms: "bp", "blue-prints", "blueprint")
              </p>

              <div className="synonym-input-group">
                <label>Canonical Tag (Target)</label>
                <input
                  type="text"
                  placeholder="e.g. blueprints"
                  value={synonymTarget}
                  onChange={(e) => setSynonymTarget(e.target.value)}
                />
              </div>

              <div className="synonym-input-group">
                <label>Synonyms (Comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. bp, blue-prints"
                  value={synonymSource}
                  onChange={(e) => setSynonymSource(e.target.value)}
                />
              </div>

              <button
                className="add-btn synonym-add-btn"
                onClick={addSynonymMapping}
                disabled={!synonymTarget.trim() || !synonymSource.trim()}
              >
                + Add Mapping
              </button>
            </div>

            {/* Pending Synonyms Sidebar */}
            <div className="te-actions">
              <div className="te-actions-section te-pending">
                <h3>Pending Mappings ({pendingSynonyms.length})</h3>
                <div className="te-changes-list synonym-list">
                  {pendingSynonyms.map((mapping, idx) => (
                    <div key={idx} className="change-item add">
                      <span className="change-tag synonym-target">🎯 {mapping.canonicalTag}</span>
                      <div className="synonym-sources">
                        {mapping.synonyms.map((s) => (
                          <span key={s} className="mini-tag base">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {pendingSynonyms.length === 0 && (
                    <p className="te-hint">No mappings staged yet.</p>
                  )}
                </div>

                {pendingSynonyms.length > 0 && (
                  <div className="te-actions-buttons">
                    <button className="export-btn" onClick={exportSynonyms}>
                      📥 Export JSON
                    </button>
                    <button className="clear-btn" onClick={clearSynonyms}>
                      🗑️ Clear
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default TagEditor;
