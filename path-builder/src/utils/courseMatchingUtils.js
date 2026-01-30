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

/**
 * Calculates match score between goal and course
 * Higher scores = better match
 */
function scoreCourse(goal, course) {
  if (!course) return 0;
  const goalTokens = tokenize(goal);
  if (goalTokens.length === 0) return 0;

  let score = 0;

  // Build searchable content from course
  const title = normalize(course.title || course.folder_name || "");
  const description = normalize(course.description || "");

  // Handle tags - could be array or object with level/topic properties
  let tagsList = [];
  if (Array.isArray(course.extracted_tags)) {
    tagsList = tagsList.concat(course.extracted_tags);
  }
  if (Array.isArray(course.transcript_tags)) {
    tagsList = tagsList.concat(course.transcript_tags);
  }
  if (Array.isArray(course.tags)) {
    tagsList = tagsList.concat(course.tags);
  } else if (course.tags && typeof course.tags === "object") {
    // tags is an object like {level: "Beginner", topic: "Blueprints"}
    tagsList = tagsList.concat(Object.values(course.tags).filter((v) => typeof v === "string"));
  }
  const tags = tagsList.map(normalize);

  goalTokens.forEach((token) => {
    // Title match (highest value)
    if (title.includes(token)) {
      score += 30;
    }

    // Exact tag match (very high value)
    if (tags.some((tag) => tag === token || tag.includes(token))) {
      score += 25;
    }

    // Description match
    if (description.includes(token)) {
      score += 10;
    }

    // Partial word match in title
    if (title.split(/\s+/).some((word) => word.startsWith(token))) {
      score += 15;
    }
  });

  // Bonus for multiple tag matches
  const tagMatches = tags.filter((tag) => goalTokens.some((t) => tag.includes(t))).length;
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

  const scored = courses
    .map((course) => ({
      ...course,
      matchScore: scoreCourse(goal, course),
    }))
    .filter((c) => c.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);

  return scored.slice(0, limit);
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
