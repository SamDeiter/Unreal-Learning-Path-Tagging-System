/**
 * dataProcessing.js - Utility functions for processing course and tag data
 *
 * This module centralizes all data transformation logic so components
 * don't need to recompute things.
 */

/**
 * Extract unique tags from courses and count occurrences
 * @param {Array} courses - Array of course objects
 * @returns {Array} Array of { id, label, count } objects
 */
export function extractTagsFromCourses(courses) {
  const tagCounts = new Map();

  courses.forEach((course) => {
    // Get all tag types from course
    const courseTags = [
      course.tags?.level,
      course.tags?.topic,
      ...(course.tags?.keywords || []),
      ...(course.keywords || []),
      ...(course.concepts || []),
    ].filter(Boolean);

    courseTags.forEach((tag) => {
      const normalizedTag = tag.toLowerCase().trim();
      const current = tagCounts.get(normalizedTag) || { count: 0, label: tag };
      tagCounts.set(normalizedTag, {
        count: current.count + 1,
        label: current.label, // Keep original casing from first occurrence
      });
    });
  });

  return Array.from(tagCounts.entries()).map(([id, data]) => ({
    id,
    label: data.label,
    count: data.count,
  }));
}

/**
 * Build edges from co-occurring tags in courses
 * @param {Array} courses - Array of course objects
 * @returns {Array} Array of { sourceTagId, targetTagId, weight } objects
 */
export function buildTagEdges(courses) {
  const edgeWeights = new Map();

  courses.forEach((course) => {
    // Get all tags for this course
    const courseTags = [
      course.tags?.level,
      course.tags?.topic,
      ...(course.tags?.keywords || []),
      ...(course.keywords || []),
      ...(course.concepts || []),
    ]
      .filter(Boolean)
      .map((t) => t.toLowerCase().trim());

    // Create edges for all pairs (co-occurrence)
    for (let i = 0; i < courseTags.length; i++) {
      for (let j = i + 1; j < courseTags.length; j++) {
        const [a, b] = [courseTags[i], courseTags[j]].sort();
        const key = `${a}|${b}`;
        edgeWeights.set(key, (edgeWeights.get(key) || 0) + 1);
      }
    }
  });

  return Array.from(edgeWeights.entries()).map(([key, weight]) => {
    const [sourceTagId, targetTagId] = key.split("|");
    return { sourceTagId, targetTagId, weight };
  });
}

/**
 * Filter courses by search query and filters
 * @param {Array} courses - All courses
 * @param {Object} options - Filter options
 * @returns {Array} Filtered courses
 */
export function filterCourses(courses, { search = "", level = null, topic = null }) {
  return courses.filter((course) => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        course.title?.toLowerCase().includes(searchLower) ||
        course.code?.toLowerCase().includes(searchLower) ||
        course.tags?.topic?.toLowerCase().includes(searchLower) ||
        course.keywords?.some((k) => k.toLowerCase().includes(searchLower));

      if (!matchesSearch) return false;
    }

    // Level filter
    if (level && course.tags?.level !== level) {
      return false;
    }

    // Topic filter
    if (topic && course.tags?.topic !== topic) {
      return false;
    }

    return true;
  });
}

/**
 * Sort courses by various criteria
 * @param {Array} courses - Courses to sort
 * @param {string} sortBy - Sort criteria
 * @param {string} direction - 'asc' or 'desc'
 * @returns {Array} Sorted courses
 */
export function sortCourses(courses, sortBy = "title", direction = "asc") {
  const sorted = [...courses].sort((a, b) => {
    let valueA, valueB;

    switch (sortBy) {
      case "title":
        valueA = a.title?.toLowerCase() || "";
        valueB = b.title?.toLowerCase() || "";
        break;
      case "level":
        const levels = { Beginner: 0, Intermediate: 1, Advanced: 2 };
        valueA = levels[a.tags?.level] ?? 99;
        valueB = levels[b.tags?.level] ?? 99;
        break;
      case "videos":
        valueA = a.video_count || 0;
        valueB = b.video_count || 0;
        break;
      default:
        valueA = a[sortBy] || "";
        valueB = b[sortBy] || "";
    }

    if (valueA < valueB) return -1;
    if (valueA > valueB) return 1;
    return 0;
  });

  return direction === "desc" ? sorted.reverse() : sorted;
}
