import { useState, useMemo } from "react";
import { useTagData } from "../../context/TagDataContext";
import { usePath } from "../../context/PathContext";
import {
  suggestPrerequisites,
  suggestSupplementalByTags,
  suggestNextSteps,
} from "../../utils/suggestionEngine";
import "./TagPathBuilder.css";

function TagPathBuilder({ courses }) {
  const { tags } = useTagData();
  const { addCourse, courses: pathCourses } = usePath();

  const [selectedTagIds, setSelectedTagIds] = useState(new Set());

  // Industry Filtering State
  const [selectedIndustry, setSelectedIndustry] = useState("All");
  const [showAllTags, setShowAllTags] = useState(false);

  // 1. Derive Industries and their associated tags from COURSES
  const { industries, industryToTagsMap } = useMemo(() => {
    const industrySet = new Set();
    const map = {}; // Industry -> Set<TagID> (Using IDs is safer than labels)

    // Helper to normalize strings for matching
    const normalize = (str) =>
      str
        ? str
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]/g, "")
        : "";

    // Build a lookup map for Tags (Label/Synonyms -> TagID)
    const tagLookup = new Map();
    tags.forEach((t) => {
      tagLookup.set(normalize(t.label), t.id);
      tagLookup.set(normalize(t.id), t.id);
      // Add synonyms if available
      if (t.synonyms) {
        t.synonyms.forEach((syn) => tagLookup.set(normalize(syn), t.id));
      }
      // Also split ID (e.g. "environment.level_design" -> "leveldesign")
      if (t.id.includes(".")) {
        const parts = t.id.split(".");
        tagLookup.set(normalize(parts[parts.length - 1]), t.id);
      }
    });

    courses.forEach((c) => {
      // Check both 'industry' field and 'tags.industry'
      const industry = c.industry || (c.tags && c.tags.industry);
      const topic = c.topic || (c.tags && c.tags.topic);
      const topics = c.topics || [];

      // Collect all potential "topics" for this course
      const courseTopics = new Set();
      if (topic) courseTopics.add(topic);
      topics.forEach((t) => courseTopics.add(t));

      if (industry) {
        // Handle comma-separated or array industries if feasible
        const indList = Array.isArray(industry) ? industry : [industry];

        indList.forEach((ind) => {
          if (ind === "General" || !ind) return;
          industrySet.add(ind);

          if (!map[ind]) map[ind] = new Set();

          courseTopics.forEach((tRaw) => {
            const key = normalize(tRaw);
            const tagId = tagLookup.get(key);
            if (tagId) {
              map[ind].add(tagId);
            }
          });
        });
      }
    });

    return {
      industries: Array.from(industrySet).sort(),
      industryToTagsMap: map,
    };
  }, [courses, tags]);

  // Group tags by top-level category
  const categorizedTags = useMemo(() => {
    const groups = {};

    // Deduplicate tags first
    const uniqueTags = Array.from(new Map(tags.map((t) => [t.id, t])).values());

    // Filter by Industry
    let filteredTags = uniqueTags;
    if (selectedIndustry !== "All" && !showAllTags) {
      const validTagIds = industryToTagsMap[selectedIndustry] || new Set();
      filteredTags = uniqueTags.filter((t) => validTagIds.has(t.id));
    }

    // Sort by popularity
    const tagsToShow = filteredTags.sort((a, b) => b.count - a.count);

    // Limit if needed
    const LIMIT = selectedIndustry === "All" && !showAllTags ? 50 : 1000;
    const finalTags = tagsToShow.slice(0, LIMIT);

    finalTags.forEach((tag) => {
      let cat = "General";
      if (tag.categoryPath) {
        if (Array.isArray(tag.categoryPath)) {
          cat = tag.categoryPath.length > 0 ? tag.categoryPath[0] : "General";
        } else if (typeof tag.categoryPath === "string") {
          cat = tag.categoryPath.split("/")[0];
        }
      }

      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(tag);
    });

    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [tags, selectedIndustry, showAllTags, industryToTagsMap]);

  // Collapsible State
  const [collapsedCategories, setCollapsedCategories] = useState(() => {
    if (categorizedTags.length > 0) {
      const initial = new Set();
      categorizedTags.forEach(([cat], index) => {
        if (index !== 0) initial.add(cat);
      });
      return initial;
    }
    return new Set();
  });

  const toggleCategory = (category) => {
    const next = new Set(collapsedCategories);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    setCollapsedCategories(next);
  };

  const toggleTag = (id) => {
    const next = new Set(selectedTagIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= 6) return; // Soft limit
      next.add(id);
    }
    setSelectedTagIds(next);
  };

  // Find selected tag objects
  const selectedTags = tags.filter((t) => selectedTagIds.has(t.id));

  // Heuristic Recommendation
  const handleSuggest = () => {
    console.log("handleSuggest triggered");

    // If no tags selected but we have a path, use the path's topics as implicit tags
    let intentTags = selectedTags;
    if (selectedTagIds.size === 0 && pathCourses.length > 0) {
      console.log("Using implicit path context...");
      const pathTopics = new Set();
      pathCourses.forEach((c) => {
        if (c.topics) c.topics.forEach((t) => pathTopics.add(t));
        if (c.topic) pathTopics.add(c.topic);
      });

      intentTags = tags.filter((t) => pathTopics.has(t.label));
    }

    if (intentTags.length === 0) {
      console.warn("No intent tags found. Aborting suggestion.");
      return;
    }

    // A. Supplemental (direct tag matches)
    const matches = suggestSupplementalByTags(intentTags, pathCourses, courses);

    // B. Prerequisites
    const prereqsForMatches = suggestPrerequisites(matches, courses, false);
    const prereqsForPath = suggestPrerequisites(pathCourses, courses, true);
    const allPrereqs = [...prereqsForMatches, ...prereqsForPath];

    // C. Next Steps
    const combinedCurrent = [...pathCourses, ...matches, ...allPrereqs];
    const nextSteps = suggestNextSteps(combinedCurrent, courses);

    // Dedup everything
    const uniqueToAdd = [];
    const seen = new Set(pathCourses.map((c) => c.code));

    const processList = (list) => {
      list.forEach((c) => {
        if (!seen.has(c.code)) {
          seen.add(c.code);
          uniqueToAdd.push(c);
        }
      });
    };

    processList(allPrereqs); // Prereqs first
    processList(matches); // Then core matches
    processList(nextSteps); // Then next steps

    // Add to path
    uniqueToAdd.forEach((c) => {
      addCourse(c);
    });

    // NOTE: We do NOT clear selectedTagIds here.
  };

  return (
    <div className="tag-path-builder">
      {/* Industry Filter Control */}
      <div className="industry-filter-bar">
        <select
          className="industry-select"
          value={selectedIndustry}
          onChange={(e) => setSelectedIndustry(e.target.value)}
        >
          <option value="All">All Industries</option>
          {industries.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>

        <label className="show-all-toggle" title="Show all tags regardless of industry">
          <input
            type="checkbox"
            checked={showAllTags}
            onChange={(e) => setShowAllTags(e.target.checked)}
          />
          <span className="toggle-label">Show Context</span>
        </label>
      </div>

      <div className="sentence-builder">
        <p className="sentence-text">
          I want to learn about
          {selectedTags.length === 0 && (
            <span className="text-placeholder"> ... (select tags)</span>
          )}
          {selectedTags.map((tag) => (
            <span key={tag.id} className="sentence-tag" onClick={() => toggleTag(tag.id)}>
              {tag.label}
            </span>
          ))}
        </p>
        <button
          className="btn btn-primary suggest-btn"
          disabled={selectedTags.length === 0 && pathCourses.length === 0}
          onClick={handleSuggest}
        >
          ✨{" "}
          {selectedTags.length === 0 && pathCourses.length > 0
            ? "Auto-Complete Path"
            : "Suggest Courses"}
        </button>
      </div>

      <div className="tag-categories">
        {categorizedTags.length === 0 ? (
          <div className="empty-tags-msg">No tags found for this industry. Try "Show Context".</div>
        ) : (
          categorizedTags.map(([category, groupTags]) => {
            const isCollapsed = collapsedCategories.has(category);
            return (
              <div key={category} className="category-group">
                <div className="category-title" onClick={() => toggleCategory(category)}>
                  <span>
                    {category} <span className="category-count">({groupTags.length})</span>
                  </span>
                  <span className={`chevron ${!isCollapsed ? "expanded" : ""}`}>▼</span>
                </div>

                {!isCollapsed && (
                  <div className="tag-cloud">
                    {groupTags.map((tag) => (
                      <button
                        key={tag.id}
                        className={`tag-chip ${selectedTagIds.has(tag.id) ? "selected" : ""}`}
                        onClick={() => toggleTag(tag.id)}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default TagPathBuilder;
