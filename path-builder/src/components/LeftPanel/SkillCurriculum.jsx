import { useState, useMemo, useCallback, useEffect, useRef, memo } from "react";
import { usePath } from "../../context/PathContext";
import { useVectorSearch } from "../../hooks/useVectorSearch";
import { getCourseDurationMinutes } from "../../utils/courseDuration";
import "./SkillCurriculum.css";

// UE5 concept synonym map for semantic matching
// Maps broad topics → related narrower concepts that should also match
const UE5_CONCEPT_MAP = {
  ai: [
    "behavior tree",
    "blackboard",
    "ai perception",
    "ai controller",
    "navigation",
    "navmesh",
    "eqs",
    "environment query",
    "npc",
    "patrol",
    "stimulus",
  ],
  "ai systems": [
    "behavior tree",
    "blackboard",
    "ai perception",
    "ai controller",
    "navigation",
    "navmesh",
    "eqs",
    "environment query",
    "npc",
    "patrol",
  ],
  animation: [
    "anim blueprint",
    "state machine",
    "montage",
    "blend space",
    "ik",
    "retarget",
    "skeletal mesh",
    "control rig",
    "sequencer",
  ],
  blueprint: [
    "visual scripting",
    "bp",
    "event graph",
    "construction script",
    "function library",
    "macro",
    "interface",
  ],
  materials: [
    "material editor",
    "shader",
    "texture",
    "pbr",
    "substance",
    "material instance",
    "material function",
    "landscape material",
  ],
  lighting: [
    "lumen",
    "light source",
    "shadow",
    "global illumination",
    "reflection",
    "skylight",
    "exposure",
    "volumetric",
  ],
  landscape: [
    "terrain",
    "world partition",
    "foliage",
    "heightmap",
    "landscape material",
    "erosion",
    "sculpt",
    "world building",
  ],
  physics: [
    "collision",
    "rigid body",
    "constraint",
    "physics simulation",
    "chaos",
    "destructible",
    "ragdoll",
  ],
  networking: [
    "replication",
    "multiplayer",
    "server",
    "client",
    "rpc",
    "net serialization",
    "online subsystem",
  ],
  ui: ["umg", "widget", "hud", "menu", "slate", "user interface", "common ui"],
  rendering: [
    "nanite",
    "lumen",
    "virtual shadow",
    "render pipeline",
    "post process",
    "screen space",
    "ray tracing",
  ],
  audio: ["sound", "metasound", "attenuation", "reverb", "ambient", "music", "dialogue"],
  gameplay: [
    "game mode",
    "game state",
    "player controller",
    "character",
    "ability system",
    "game framework",
    "pawn",
  ],
  "world building": [
    "landscape",
    "level design",
    "environment",
    "foliage",
    "world partition",
    "terrain",
    "open world",
    "biome",
  ],
  cinematics: ["sequencer", "camera", "cutscene", "cine camera", "level sequence", "movie render"],
  niagara: ["particle", "vfx", "emitter", "particle system", "visual effects", "fx"],
  procedural: ["pcg", "procedural generation", "hism", "runtime generation", "procedural mesh"],
  "c++": ["unreal c++", "uclass", "uproperty", "ufunction", "gameplay framework", "module"],
};

/**
 * Skill Curriculum Builder
 *
 * Features:
 * - Search autocomplete with suggestions
 * - Time budget filter
 * - Learning outcomes preview
 * - Tiered curriculum organization
 */
function SkillCurriculum({ courses, preSelectedSkill, onSkillUsed }) {
  const { addCourse, courses: pathCourses, learningIntent } = usePath();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedCourses, setSelectedCourses] = useState(new Set());
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  // Debounce search — keyword + vector matching only fires 300ms after last keystroke
  const updateSearch = useCallback((value) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), 300);
  }, []);

  // Cleanup debounce timer
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  // Async vector search (fires on debounced query, not every keystroke)
  const { vectorResults, isSearching } = useVectorSearch(debouncedQuery, courses);

  // Use shared time budget from Intelligence Panel (hours → minutes)
  const timeBudget =
    learningIntent?.timeBudget && learningIntent.timeBudget !== "none"
      ? String(parseInt(learningIntent.timeBudget) * 60)
      : "";

  // Auto-populate search when preSelectedSkill changes (from Analytics insights)
  useEffect(() => {
    if (preSelectedSkill) {
      updateSearch(preSelectedSkill);
      if (onSkillUsed) onSkillUsed(); // Clear after use
    }
  }, [preSelectedSkill, onSkillUsed, updateSearch]);

  // Get all unique skills for autocomplete
  const allSkills = useMemo(() => {
    const skillSet = new Map();

    courses.forEach((course) => {
      // Topics
      const topic = course.tags?.topic;
      if (topic) {
        skillSet.set(topic.toLowerCase(), { name: topic, type: "topic" });
      }

      // AI-detected tags
      course.gemini_system_tags?.forEach((tag) => {
        if (!skillSet.has(tag.toLowerCase())) {
          skillSet.set(tag.toLowerCase(), { name: tag, type: "ai" });
        }
      });
    });

    return Array.from(skillSet.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [courses]);

  // Calculate skill co-occurrence (which skills appear together)
  const skillRelationships = useMemo(() => {
    const coOccurrence = {};

    courses.forEach((course) => {
      // Get all tags for this course
      const courseTags = new Set();
      if (course.tags?.topic) courseTags.add(course.tags.topic.toLowerCase());
      course.gemini_system_tags?.forEach((t) => courseTags.add(t.toLowerCase()));

      // Count co-occurrences
      const tagArray = Array.from(courseTags);
      tagArray.forEach((tag1) => {
        if (!coOccurrence[tag1]) coOccurrence[tag1] = {};
        tagArray.forEach((tag2) => {
          if (tag1 !== tag2) {
            coOccurrence[tag1][tag2] = (coOccurrence[tag1][tag2] || 0) + 1;
          }
        });
      });
    });

    return coOccurrence;
  }, [courses]);

  // Get recommended skills based on current search
  const recommendedSkills = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const queryLower = searchQuery.toLowerCase();
    const related = skillRelationships[queryLower];
    if (!related) return [];

    // Sort by co-occurrence count and get top 5
    return Object.entries(related)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([skill, count]) => {
        const matchingCourses = courses.filter((c) => {
          const tags = [...(c.gemini_system_tags || []), c.tags?.topic].filter(Boolean);
          return tags.some((t) => t.toLowerCase() === skill);
        });
        // Calculate estimated time
        const totalMinutes = matchingCourses.reduce((sum, course) => {
          return sum + getCourseDurationMinutes(course);
        }, 0);
        return {
          name: skill,
          count,
          courseCount: matchingCourses.length,
          estimatedTime: totalMinutes,
        };
      });
  }, [searchQuery, skillRelationships, courses]);

  // Autocomplete suggestions
  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return allSkills.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [searchQuery, allSkills]);

  // Smart search: find courses matching the typed phrase
  const matchingCourses = useMemo(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 2) return [];

    const query = debouncedQuery.toLowerCase().trim();
    // Preserve short but important UE5 domain terms
    const KEEP_SHORT = new Set([
      "ai",
      "ui",
      "vr",
      "ar",
      "fx",
      "bp",
      "hud",
      "ik",
      "lod",
      "pcg",
      "rhi",
      "smr",
      "umg",
      "vfx",
      "c++",
      "2d",
      "3d",
    ]);
    const queryWords = query.split(/\s+/).filter((w) => w.length > 2 || KEEP_SHORT.has(w));

    if (queryWords.length === 0) return [];

    return courses
      .map((course) => {
        let score = 0;
        const title = (course.title || "").toLowerCase();
        const topic = (course.tags?.topic || "").toLowerCase();
        const aiTags = (course.gemini_system_tags || []).map((t) => t.toLowerCase());
        const extractedTags = (course.extracted_tags || []).map((t) => t.toLowerCase());
        const summary = (course.gemini_enriched?.one_sentence_summary || "").toLowerCase();

        // Build searchable text for substring matching
        const searchableText = [title, topic, ...aiTags, ...extractedTags, summary].join(" ");

        // 1. Exact full-phrase match in title → huge bonus
        if (title.includes(query)) score += 10;

        // 2. Exact full-phrase match in topic → strong bonus
        if (topic.includes(query)) score += 8;

        // 3. Per-word scoring using word boundaries
        let wordsMatched = 0;
        queryWords.forEach((word) => {
          // Use word boundary regex to avoid partial matches
          const wordRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
          if (wordRegex.test(title)) {
            score += 3; // Title match is most valuable
            wordsMatched++;
          } else if (wordRegex.test(topic)) {
            score += 2.5;
            wordsMatched++;
          } else if (aiTags.some((t) => wordRegex.test(t))) {
            score += 2;
            wordsMatched++;
          } else if (wordRegex.test(searchableText)) {
            score += 1;
            wordsMatched++;
          }
        });

        // 4. Semantic synonym expansion — boost courses matching related UE5 concepts
        // Check both individual words and the full query against the concept map
        const synonymTerms = new Set();
        queryWords.forEach((w) => {
          if (UE5_CONCEPT_MAP[w]) UE5_CONCEPT_MAP[w].forEach((s) => synonymTerms.add(s));
        });
        if (UE5_CONCEPT_MAP[query]) {
          UE5_CONCEPT_MAP[query].forEach((s) => synonymTerms.add(s));
        }
        if (synonymTerms.size > 0) {
          let synonymHits = 0;
          synonymTerms.forEach((term) => {
            const termRegex = new RegExp(
              `\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
              "i"
            );
            if (termRegex.test(searchableText)) {
              synonymHits++;
            }
          });
          // Synonym matches add semantic relevance (reduced weight vs direct match)
          if (synonymHits > 0) {
            score += synonymHits * 1.5;
            // Count as partial word match for the all-words-required check
            wordsMatched = Math.max(wordsMatched, Math.ceil(queryWords.length * 0.75));
          }
        }

        // 5. REQUIRE all query words to match — if any word misses, heavily penalize
        if (wordsMatched < queryWords.length) {
          // Allow partial match only if >50% of words match AND score is high
          if (wordsMatched < queryWords.length * 0.5) {
            score = 0; // Drop completely if less than half the words match
          } else {
            score *= 0.3; // Heavy penalty for partial match
          }
        }

        return { course, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((item) => item.course);
  }, [debouncedQuery, courses]);

  // Merge keyword results with vector search results (deduplicated)
  const mergedCourses = useMemo(() => {
    const seen = new Set();
    const dedup = (list) =>
      list.filter((c) => {
        const key = c.code || c.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return [...dedup(matchingCourses), ...dedup(vectorResults)];
  }, [matchingCourses, vectorResults]);

  // Build curriculum with time filtering
  const curriculum = useMemo(() => {
    if (mergedCourses.length === 0) return null;

    const pathCodes = new Set(pathCourses.map((c) => c.code));
    const levelOrder = { Beginner: 1, Foundation: 1, Intermediate: 2, Advanced: 3 };
    const maxMinutes = timeBudget ? parseInt(timeBudget) : Infinity;

    // Boost "Introduction to Unreal Engine" for beginners
    const isBeginnerContext =
      learningIntent?.skillLevel === "Beginner" || /\bintro(duction)?\b/i.test(debouncedQuery);
    const UE_INTRO_CODE = "100.01";

    // Inject intro course if not already in results (search may not find it)
    let workingCourses = [...mergedCourses];
    if (isBeginnerContext && !workingCourses.some((c) => c.code === UE_INTRO_CODE)) {
      const introCourse = courses.find((c) => c.code === UE_INTRO_CODE);
      if (introCourse) workingCourses.unshift(introCourse);
    }

    // Industry filter — only keep courses matching selected industries
    const selectedIndustries = learningIntent?.industries;
    if (selectedIndustries && selectedIndustries.length > 0) {
      workingCourses = workingCourses.filter((c) => {
        const courseInd = c.tags?.industry || "General";
        // Always include General (cross-industry fundamentals)
        if (courseInd === "General") return true;
        return selectedIndustries.includes(courseInd);
      });
    }

    const sorted = workingCourses.sort((a, b) => {
      // Pin intro course to top for beginners
      if (isBeginnerContext) {
        if (a.code === UE_INTRO_CODE) return -1;
        if (b.code === UE_INTRO_CODE) return 1;
      }
      const levelA = levelOrder[a.tags?.level] || 2;
      const levelB = levelOrder[b.tags?.level] || 2;
      return levelA - levelB;
    });

    const tiers = { prerequisites: [], core: [], advanced: [] };
    let runningTime = 0;

    sorted.forEach((course) => {
      const level = course.tags?.level;
      const isInPath = pathCodes.has(course.code);
      const courseTime = getCourseDurationMinutes(course);

      // Apply time budget filter
      if (runningTime + courseTime > maxMinutes && maxMinutes !== Infinity) {
        return; // Skip courses that exceed budget
      }
      runningTime += courseTime;

      const enrichedCourse = {
        ...course,
        isInPath,
        estimatedTime: courseTime,
      };

      if (level === "Beginner" || level === "Foundation") {
        tiers.prerequisites.push(enrichedCourse);
      } else if (level === "Advanced") {
        tiers.advanced.push(enrichedCourse);
      } else {
        tiers.core.push(enrichedCourse);
      }
    });

    const allCourses = [...tiers.prerequisites, ...tiers.core, ...tiers.advanced];
    const totalTime = allCourses.reduce((sum, c) => sum + c.estimatedTime, 0);

    // Collect learning outcomes from Gemini-enriched data
    const learningOutcomes = [];
    allCourses.forEach((course) => {
      course.gemini_enriched?.learning_outcomes?.forEach((outcome) => {
        if (!learningOutcomes.includes(outcome)) {
          learningOutcomes.push(outcome);
        }
      });
    });

    return { tiers, totalCourses: allCourses.length, totalTime, allCourses, learningOutcomes };
  }, [
    mergedCourses,
    pathCourses,
    timeBudget,
    debouncedQuery,
    learningIntent?.skillLevel,
    learningIntent?.industries,
    courses,
  ]);

  // Reset selection when curriculum changes — start empty, let user choose
  const curriculumKey = curriculum ? curriculum.allCourses.map((c) => c.code).join(",") : "";

  useEffect(() => {
    setSelectedCourses(new Set());
  }, [curriculumKey]);

  const toggleCourse = useCallback((code) => {
    setSelectedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const handleAddToPath = useCallback(() => {
    if (!curriculum) return;
    const toAdd = curriculum.allCourses.filter((c) => selectedCourses.has(c.code) && !c.isInPath);
    toAdd.forEach((course) => addCourse(course));
    setSelectedCourses(new Set());
  }, [curriculum, selectedCourses, addCourse]);

  const selectSuggestion = useCallback((name) => {
    updateSearch(name);
    setDebouncedQuery(name); // Immediately trigger course search (no debounce wait)
    setShowAutocomplete(false);
  }, [updateSearch]);

  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Close autocomplete on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="skill-curriculum">
      {/* Header */}
      <div className="sc-header">
        <h3>🎯 What do you want to teach?</h3>
        <p>Type a skill or phrase, or click a topic below</p>
      </div>

      {/* Search with Autocomplete */}
      <div className="sc-search" ref={searchRef}>
        <input
          type="text"
          placeholder="e.g., lighting fundamentals, Niagara VFX, materials..."
          value={searchQuery}
          onChange={(e) => {
            updateSearch(e.target.value);
            setShowAutocomplete(true);
          }}
          onFocus={() => setShowAutocomplete(true)}
        />
        {searchQuery && (
          <button className="clear-search" onClick={() => updateSearch("")}>
            ×
          </button>
        )}
        {isSearching && (
          <span className="sc-vector-indicator" title="Deep semantic matching...">
            🔍
          </span>
        )}

        {/* Autocomplete Dropdown */}
        {showAutocomplete && suggestions.length > 0 && (
          <div className="sc-autocomplete">
            {suggestions.map((s) => (
              <div
                key={s.name}
                className={`autocomplete-item ${s.type}`}
                onClick={() => selectSuggestion(s.name)}
              >
                <span className="suggestion-name">{s.name}</span>
                <span className={`suggestion-type ${s.type}`}>
                  {s.type === "topic" ? "📁" : "🤖"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Skill Recommendations - "You might also need" */}
      {recommendedSkills.length > 0 && (
        <div className="sc-recommendations">
          <div className="recommendations-header">
            <span className="rec-icon">💡</span>
            <span className="rec-title">You might also need:</span>
          </div>
          <div className="recommendations-list">
            {recommendedSkills.map((skill) => (
              <button
                key={skill.name}
                className="rec-skill-chip"
                onClick={() =>
                  setSearchQuery((prev) =>
                    prev.toLowerCase().includes(skill.name.toLowerCase())
                      ? prev
                      : `${prev} ${skill.name}`.trim()
                  )
                }
                title={`${skill.courseCount} courses • ~${formatTime(skill.estimatedTime)}`}
              >
                <span className="skill-name">{skill.name}</span>
                <span className="skill-count">{skill.courseCount}</span>
                <span className="skill-time">~{formatTime(skill.estimatedTime)}</span>
              </button>
            ))}
          </div>
          <p className="rec-hint">Click to add skills • Combined curriculum expands coverage</p>
        </div>
      )}

      {/* Quick-select skill chips */}
      {!searchQuery && (
        <div className="sc-skills">
          <span className="sc-skills-label">Popular topics:</span>
          {allSkills
            .filter((s) => s.type === "topic")
            .slice(0, 12)
            .map((skill) => (
              <button
                key={skill.name}
                className="skill-chip"
                onClick={() => updateSearch(skill.name)}
              >
                {skill.name}
              </button>
            ))}
        </div>
      )}

      {/* No results message */}
      {searchQuery && matchingCourses.length === 0 && (
        <div className="sc-no-results">
          <p>No courses found for "{searchQuery}"</p>
          <p className="hint">Try different keywords or select a topic above</p>
        </div>
      )}

      {/* Curriculum Preview */}
      {curriculum && (
        <div className="sc-curriculum">
          <div className="sc-search-context">
            🔎 Results for: <strong>{searchQuery}</strong>
          </div>
          <div className="sc-curriculum-header">
            <div className="curriculum-summary">
              <span className="curriculum-count">📚 {curriculum.totalCourses} courses</span>
              <span className="curriculum-sep">·</span>
              <span className="curriculum-time">~{formatTime(curriculum.totalTime)}</span>
              {timeBudget && <span className="time-badge">✅ Within budget</span>}
            </div>
            <button
              className="generate-path-btn"
              onClick={handleAddToPath}
              disabled={selectedCourses.size === 0}
              title={`Add ${selectedCourses.size} selected courses to your learning path`}
            >
              ➕{" "}
              {selectedCourses.size === curriculum.totalCourses
                ? `Add All (${selectedCourses.size})`
                : `Add Selected (${selectedCourses.size})`}
            </button>
          </div>

          <div className="curriculum-tiers">
            {/* Prerequisites */}
            {curriculum.tiers.prerequisites.length > 0 && (
              <div className="curriculum-tier">
                <div className="tier-header prerequisites">
                  <span className="tier-icon">🟢</span>
                  <span className="tier-name">Start Here</span>
                  <span className="tier-count">{curriculum.tiers.prerequisites.length}</span>
                </div>
                <div className="tier-courses">
                  {curriculum.tiers.prerequisites.map((course) => (
                    <CourseCard
                      key={course.code}
                      course={course}
                      isSelected={selectedCourses.has(course.code)}
                      onToggle={toggleCourse}
                      formatTime={formatTime}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Core */}
            {curriculum.tiers.core.length > 0 && (
              <div className="curriculum-tier">
                <div className="tier-header core">
                  <span className="tier-icon">🔵</span>
                  <span className="tier-name">Core Learning</span>
                  <span className="tier-count">{curriculum.tiers.core.length}</span>
                </div>
                <div className="tier-courses">
                  {curriculum.tiers.core.map((course) => (
                    <CourseCard
                      key={course.code}
                      course={course}
                      isSelected={selectedCourses.has(course.code)}
                      onToggle={toggleCourse}
                      formatTime={formatTime}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Advanced */}
            {curriculum.tiers.advanced.length > 0 && (
              <div className="curriculum-tier">
                <div className="tier-header advanced">
                  <span className="tier-icon">🟣</span>
                  <span className="tier-name">Advanced</span>
                  <span className="tier-count">{curriculum.tiers.advanced.length}</span>
                </div>
                <div className="tier-courses">
                  {curriculum.tiers.advanced.map((course) => (
                    <CourseCard
                      key={course.code}
                      course={course}
                      isSelected={selectedCourses.has(course.code)}
                      onToggle={toggleCourse}
                      formatTime={formatTime}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Course card subcomponent (memoized to avoid re-renders when parent state changes)
const CourseCard = memo(function CourseCard({ course, isSelected, onToggle, formatTime }) {
  return (
    <div
      className={`curriculum-course ${course.isInPath ? "in-path" : ""} ${isSelected ? "selected" : ""}`}
      onClick={() => !course.isInPath && onToggle(course.code)}
    >
      {!course.isInPath && <input type="checkbox" checked={isSelected} onChange={() => {}} />}
      <div className="course-info">
        <div className="course-title">{course.title}</div>
        <div className="course-meta">
          <span className="course-time">{formatTime(course.estimatedTime)}</span>
          <span className="course-level">{course.tags?.level}</span>
          {course.isInPath && <span className="already-added">✓ Already in path</span>}
        </div>
      </div>
    </div>
  );
});

export default SkillCurriculum;
