/**
 * Course Matching Utilities
 * Matches courses to learning goals using fuzzy text matching and tag analysis.
 */

/**
 * Normalizes a string for matching: lowercase, remove special chars
 */
function normalize(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/**
 * Tokenizes a string into words for matching
 */
function tokenize(str) {
  return normalize(str)
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

// ── Cache for normalized course data ──
const courseCache = new WeakMap();

/**
 * Pre-processes and caches course data for faster matching.
 * Since course objects are stable, we can normalize them once.
 */
function getCachedCourseData(course) {
  let data = courseCache.get(course);
  if (!data) {
    const title = normalize(course.title || course.folder_name || "");
    const description = normalize(course.description || "");
    const tags = [];

    const addTags = (val) => {
      if (!val) return;
      if (Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
          if (typeof val[i] === "string") tags.push(normalize(val[i]));
        }
      } else if (typeof val === "object") {
        for (const k in val) {
          if (typeof val[k] === "string") tags.push(normalize(val[k]));
        }
      }
    };

    addTags(course.extracted_tags);
    addTags(course.transcript_tags);
    addTags(course.tags);

    data = {
      title,
      titleWords: title.split(/\s+/),
      description,
      tags: [...new Set(tags)], // Deduplicate
    };
    courseCache.set(course, data);
  }
  return data;
}

/**
 * Calculates match score between goal and course
 * Optimized: accepts pre-tokenized goal tokens and uses cached course data
 */
function scoreCourse(goalTokens, course) {
  if (!course || !goalTokens || goalTokens.length === 0) return 0;

  const { title, titleWords, description, tags } = getCachedCourseData(course);
  let score = 0;

  for (let i = 0; i < goalTokens.length; i++) {
    const token = goalTokens[i];

    // Title match (highest value)
    if (title.includes(token)) {
      score += 30;
      // Partial word match in title (bonus if it starts with token)
      for (let j = 0; j < titleWords.length; j++) {
        if (titleWords[j].startsWith(token)) {
          score += 15;
          break; // Bonus once per token
        }
      }
    }

    // Exact tag match (very high value)
    for (let j = 0; j < tags.length; j++) {
      if (tags[j].includes(token)) {
        score += 25;
        break; // Score once per token
      }
    }

    // Description match
    if (description.includes(token)) {
      score += 10;
    }
  }

  // Bonus for multiple tag matches
  let tagMatches = 0;
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    for (let j = 0; j < goalTokens.length; j++) {
      if (tag.includes(goalTokens[j])) {
        tagMatches++;
        break;
      }
    }
  }
  score += tagMatches * 5;

  return score;
}

/**
 * Matches courses to a learning goal
 * @param {string} goal - The user's learning goal (e.g., "Master Niagara VFX")
 * @param {Array} courses - Array of course objects
 * @param {number} limit - Max courses to return (default: 8)
 * @returns {Array} - Sorted array of courses with matchScore
 */
export function matchCoursesToGoal(goal, courses, limit = 8) {
  if (!goal || goal.trim().length < 3 || !courses || !Array.isArray(courses)) {
    return [];
  }

  // Optimize: Tokenize goal once instead of 2,400+ times
  const goalTokens = tokenize(goal);
  if (goalTokens.length === 0) return [];

  const scored = [];
  for (let i = 0; i < courses.length; i++) {
    const course = courses[i];
    const score = scoreCourse(goalTokens, course);
    if (score > 0) {
      scored.push({ ...course, matchScore: score });
    }
  }

  return scored.sort((a, b) => b.matchScore - a.matchScore).slice(0, limit);
}

/**
 * Gets suggested tags based on goal text
 * Useful for showing related topics
 */
export function getSuggestedTags(goal, tags) {
  const goalTokens = tokenize(goal);
  if (goalTokens.length === 0) return [];

  return tags
    .filter((tag) => {
      const tagName = normalize(tag.label || tag.display_name || "");
      return goalTokens.some((t) => tagName.includes(t));
    })
    .slice(0, 5);
}
