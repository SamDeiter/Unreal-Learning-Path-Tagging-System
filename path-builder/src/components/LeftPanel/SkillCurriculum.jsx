import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { usePath } from "../../context/PathContext";
import "./SkillCurriculum.css";

/**
 * Skill Curriculum Builder
 * 
 * Features:
 * - Search autocomplete with suggestions
 * - Time budget filter
 * - Learning outcomes preview
 * - Tiered curriculum organization
 */
function SkillCurriculum({ courses }) {
  const { addCourse, courses: pathCourses } = usePath();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourses, setSelectedCourses] = useState(new Set());
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [timeBudget, setTimeBudget] = useState(""); // "" = no limit, or minutes
  const searchRef = useRef(null);

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
    
    courses.forEach(course => {
      // Get all tags for this course
      const courseTags = new Set();
      if (course.tags?.topic) courseTags.add(course.tags.topic.toLowerCase());
      course.gemini_system_tags?.forEach(t => courseTags.add(t.toLowerCase()));
      
      // Count co-occurrences
      const tagArray = Array.from(courseTags);
      tagArray.forEach(tag1 => {
        if (!coOccurrence[tag1]) coOccurrence[tag1] = {};
        tagArray.forEach(tag2 => {
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
      .map(([skill, count]) => ({
        name: skill,
        count,
        courseCount: courses.filter(c => {
          const tags = [...(c.gemini_system_tags || []), c.tags?.topic].filter(Boolean);
          return tags.some(t => t.toLowerCase() === skill);
        }).length
      }));
  }, [searchQuery, skillRelationships, courses]);

  // Autocomplete suggestions
  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return allSkills
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchQuery, allSkills]);

  // Smart search: find courses matching the typed phrase
  const matchingCourses = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];

    const query = searchQuery.toLowerCase();
    const queryWords = query.split(/\s+/).filter((w) => w.length > 2);

    return courses
      .map((course) => {
        let score = 0;
        const searchableText = [
          course.title,
          course.tags?.topic,
          course.tags?.level,
          ...(course.gemini_system_tags || []),
          ...(course.extracted_tags || []),
          course.gemini_enriched?.one_sentence_summary,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        queryWords.forEach((word) => {
          if (searchableText.includes(word)) score += 1;
        });

        if (searchableText.includes(query)) score += 3;
        if (course.tags?.topic?.toLowerCase().includes(query)) score += 5;

        return { course, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((item) => item.course);
  }, [searchQuery, courses]);

  // Build curriculum with time filtering
  const curriculum = useMemo(() => {
    if (matchingCourses.length === 0) return null;

    const pathCodes = new Set(pathCourses.map((c) => c.code));
    const levelOrder = { Beginner: 1, Foundation: 1, Intermediate: 2, Advanced: 3 };
    const maxMinutes = timeBudget ? parseInt(timeBudget) : Infinity;

    const sorted = [...matchingCourses].sort((a, b) => {
      const levelA = levelOrder[a.tags?.level] || 2;
      const levelB = levelOrder[b.tags?.level] || 2;
      return levelA - levelB;
    });

    const tiers = { prerequisites: [], core: [], advanced: [] };
    let runningTime = 0;

    sorted.forEach((course) => {
      const level = course.tags?.level;
      const isInPath = pathCodes.has(course.code);
      const courseTime = course.videos?.reduce((sum, v) => sum + (v.duration_minutes || 0), 0) || 30;

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
  }, [matchingCourses, pathCourses, timeBudget]);

  // Sync selection when curriculum changes
  const curriculumKey = curriculum ? curriculum.allCourses.map((c) => c.code).join(",") : "";
  
  useEffect(() => {
    if (curriculum && curriculum.allCourses.length > 0) {
      const newSelection = new Set(
        curriculum.allCourses.filter((c) => !c.isInPath).map((c) => c.code)
      );
      setSelectedCourses(newSelection);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const toAdd = curriculum.allCourses.filter(
      (c) => selectedCourses.has(c.code) && !c.isInPath
    );
    toAdd.forEach((course) => addCourse(course));
    setSelectedCourses(new Set());
  }, [curriculum, selectedCourses, addCourse]);

  const selectSuggestion = useCallback((name) => {
    setSearchQuery(name);
    setShowAutocomplete(false);
  }, []);

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
            setSearchQuery(e.target.value);
            setShowAutocomplete(true);
          }}
          onFocus={() => setShowAutocomplete(true)}
        />
        {searchQuery && (
          <button className="clear-search" onClick={() => setSearchQuery("")}>
            ×
          </button>
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

      {/* Time Budget Filter */}
      <div className="sc-time-filter">
        <label>⏱️ Time budget:</label>
        <select value={timeBudget} onChange={(e) => setTimeBudget(e.target.value)}>
          <option value="">No limit</option>
          <option value="60">~1 hour</option>
          <option value="120">~2 hours</option>
          <option value="180">~3 hours</option>
          <option value="300">~5 hours</option>
          <option value="600">~10 hours</option>
        </select>
      </div>

      {/* Skill Recommendations - "You might also need" */}
      {recommendedSkills.length > 0 && (
        <div className="sc-recommendations">
          <div className="recommendations-header">
            <span className="rec-icon">💡</span>
            <span className="rec-title">You might also need:</span>
          </div>
          <div className="recommendations-list">
            {recommendedSkills.map(skill => (
              <button
                key={skill.name}
                className="rec-skill-chip"
                onClick={() => setSearchQuery(prev => 
                  prev.toLowerCase().includes(skill.name.toLowerCase()) 
                    ? prev 
                    : `${prev} ${skill.name}`.trim()
                )}
                title={`${skill.courseCount} courses cover this skill`}
              >
                <span className="skill-name">{skill.name}</span>
                <span className="skill-count">{skill.courseCount}</span>
              </button>
            ))}
          </div>
          <p className="rec-hint">
            Click to add skills • Combined curriculum expands coverage
          </p>
        </div>
      )}

      {/* Quick-select skill chips */}
      {!searchQuery && (
        <div className="sc-skills">
          <span className="sc-skills-label">Popular topics:</span>
          {allSkills.filter((s) => s.type === "topic").slice(0, 12).map((skill) => (
            <button
              key={skill.name}
              className="skill-chip"
              onClick={() => setSearchQuery(skill.name)}
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
          <div className="sc-curriculum-header">
            <div className="curriculum-title">
              <h4>📚 Recommended Curriculum</h4>
              <span className="search-term">for "{searchQuery}"</span>
            </div>
            <div className="curriculum-stats">
              <span>{curriculum.totalCourses} courses</span>
              <span>•</span>
              <span>~{formatTime(curriculum.totalTime)}</span>
              {timeBudget && <span className="time-badge">⏱️ Fits budget</span>}
            </div>
          </div>

          {/* Learning Outcomes */}
          {curriculum.learningOutcomes.length > 0 && (
            <div className="sc-outcomes">
              <h5>🎓 After this curriculum, learners will be able to:</h5>
              <ul>
                {curriculum.learningOutcomes.slice(0, 5).map((outcome, i) => (
                  <li key={i}>{outcome}</li>
                ))}
                {curriculum.learningOutcomes.length > 5 && (
                  <li className="more">+{curriculum.learningOutcomes.length - 5} more outcomes</li>
                )}
              </ul>
            </div>
          )}

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

          {/* Actions */}
          <div className="sc-actions">
            <button
              className="add-to-path-btn"
              onClick={handleAddToPath}
              disabled={selectedCourses.size === 0}
            >
              ➕ Add {selectedCourses.size} Courses to Path
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Course card subcomponent
function CourseCard({ course, isSelected, onToggle, formatTime }) {
  return (
    <div
      className={`curriculum-course ${course.isInPath ? "in-path" : ""} ${isSelected ? "selected" : ""}`}
      onClick={() => !course.isInPath && onToggle(course.code)}
    >
      {!course.isInPath && (
        <input type="checkbox" checked={isSelected} onChange={() => {}} />
      )}
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
}

export default SkillCurriculum;
