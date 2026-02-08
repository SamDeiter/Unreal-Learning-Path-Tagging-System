/**
 * PathBuilder — Constraint-aware learning path construction (V2).
 *
 * Replaces simple "sorted list by score" with a deterministic path builder
 * that respects prerequisites, diversity, and time budgets.
 *
 * Usage:
 *   import { buildLearningPath } from './PathBuilder.js';
 *   const path = buildLearningPath(rankedCourses, matchedTagIds, { timeBudgetMinutes: 60 });
 */

import tagGraphService from "./TagGraphService.js";

/**
 * Role assignment rules (deterministic):
 *   - prerequisite: course tags have subtopic edges pointing toward matched tags
 *   - troubleshooting: course has symptom_of/often_caused_by tag matches
 *   - core: direct tag overlap with query
 *   - supplemental: only graph-propagated matches, no direct overlap
 */
const ROLE_PRIORITY = { prerequisite: 0, core: 1, troubleshooting: 2, supplemental: 3 };

/**
 * Estimate course duration in minutes.
 * Falls back to segment count * 10 min if no duration field exists.
 * @param {Object} course
 * @returns {number}
 */
function estimateDuration(course) {
  if (course.estimated_minutes) return course.estimated_minutes;
  if (course.total_duration_seconds) return Math.round(course.total_duration_seconds / 60);
  // Fallback: count videos/segments, estimate 10 min each
  const videoCount = course.videos?.length || 1;
  return videoCount * 10;
}

/**
 * Compute tag overlap ratio between a course and already-selected tags.
 * Returns 0-1 where 1 = full overlap (no diversity).
 * @param {Object} course
 * @param {Set<string>} selectedTags
 * @returns {number}
 */
function overlapRatio(course, selectedTags) {
  if (selectedTags.size === 0) return 0;

  const courseTags = new Set(
    [
      ...(course.canonical_tags || []),
      ...(course.gemini_system_tags || []),
      ...(course.transcript_tags || []),
    ].map((t) => (typeof t === "string" ? t.toLowerCase() : ""))
  );

  if (courseTags.size === 0) return 0;

  let overlap = 0;
  for (const ct of courseTags) {
    if (selectedTags.has(ct) || selectedTags.has(ct.split(".").pop())) {
      overlap++;
    }
  }

  return overlap / courseTags.size;
}

/**
 * Determine the role of a course based on its tag relationships.
 * @param {Object} course
 * @param {string[]} matchedTagIds - Tags from the user query
 * @returns {string} - "prerequisite" | "core" | "troubleshooting" | "supplemental"
 */
function assignRole(course, matchedTagIds) {
  const courseTags = [...(course.canonical_tags || []), ...(course.gemini_system_tags || [])].map(
    (t) => (typeof t === "string" ? t.toLowerCase() : "")
  );

  const matchedSet = new Set(matchedTagIds.map((t) => t.toLowerCase()));

  // Check for direct overlap → core
  let hasDirectOverlap = false;
  for (const ct of courseTags) {
    if (matchedSet.has(ct) || matchedSet.has(ct.split(".").pop())) {
      hasDirectOverlap = true;
      break;
    }
  }

  // Check for symptom/troubleshooting tags
  const hasTroubleshooting = courseTags.some((ct) => {
    const tag = tagGraphService.getTag(ct);
    return tag?.tag_type === "symptom" || tag?.tag_type === "error_code";
  });

  // Check for prerequisite relationship: course tags point TO matched tags via subtopic
  let isPrereq = false;
  for (const ct of courseTags) {
    const outEdges = tagGraphService.edgesBySource?.get(ct) || [];
    for (const edge of outEdges) {
      if (edge.relation === "subtopic" && matchedSet.has(edge.target)) {
        isPrereq = true;
        break;
      }
    }
    if (isPrereq) break;
  }

  if (isPrereq) return "prerequisite";
  if (hasTroubleshooting) return "troubleshooting";
  if (hasDirectOverlap) return "core";
  return "supplemental";
}

/**
 * Build a structured learning path from ranked courses.
 *
 * @param {Array} rankedCourses - Courses sorted by relevance score desc (must have _relevanceScore)
 * @param {string[]} matchedTagIds - Tag IDs matched from the user query
 * @param {Object} options
 * @param {number} [options.timeBudgetMinutes] - Optional time constraint
 * @param {number} [options.maxItems=8] - Max courses in path
 * @param {boolean} [options.preferTroubleshooting=false] - Boost troubleshooting results
 * @param {boolean} [options.diversity=true] - Penalize repeated tag clusters
 * @returns {{
 *   path: Array<{course: Object, role: string, reason: string, estimatedMinutes: number}>,
 *   metadata: {totalMinutes: number, tagCoverage: number, diversityScore: number, itemCount: number}
 * }}
 */
export function buildLearningPath(rankedCourses, matchedTagIds, options = {}) {
  const {
    timeBudgetMinutes = Infinity,
    maxItems = 8,
    preferTroubleshooting = false,
    diversity = true,
  } = options;

  if (!rankedCourses || rankedCourses.length === 0) {
    return {
      path: [],
      metadata: { totalMinutes: 0, tagCoverage: 0, diversityScore: 1, itemCount: 0 },
    };
  }

  // Step 1: Assign roles to all candidates
  const candidates = rankedCourses.map((course) => ({
    course,
    role: assignRole(course, matchedTagIds),
    estimatedMinutes: estimateDuration(course),
    score: course._relevanceScore || 0,
  }));

  // Step 2: Sort by role priority, then by score within each role
  candidates.sort((a, b) => {
    const roleDiff = ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role];
    if (roleDiff !== 0) return roleDiff;
    return b.score - a.score;
  });

  // Step 3: If preferTroubleshooting, boost troubleshooting items
  if (preferTroubleshooting) {
    candidates.sort((a, b) => {
      const aTs = a.role === "troubleshooting" ? 0 : 1;
      const bTs = b.role === "troubleshooting" ? 0 : 1;
      if (aTs !== bTs) return aTs - bTs;
      return b.score - a.score;
    });
  }

  // Step 4: Greedy selection with diversity + time budget constraints
  const selected = [];
  const selectedTagSet = new Set();
  let totalMinutes = 0;

  for (const candidate of candidates) {
    if (selected.length >= maxItems) break;
    if (totalMinutes + candidate.estimatedMinutes > timeBudgetMinutes) continue;

    // Diversity check: skip if >70% tag overlap with already selected
    if (diversity && selected.length > 0) {
      const overlap = overlapRatio(candidate.course, selectedTagSet);
      if (overlap > 0.7) continue;
    }

    // Add to path
    const reason = generateReason(candidate, matchedTagIds);
    selected.push({
      course: candidate.course,
      role: candidate.role,
      reason,
      estimatedMinutes: candidate.estimatedMinutes,
    });

    totalMinutes += candidate.estimatedMinutes;

    // Track selected tags for diversity
    const tags = [
      ...(candidate.course.canonical_tags || []),
      ...(candidate.course.gemini_system_tags || []),
    ].map((t) => (typeof t === "string" ? t.toLowerCase() : ""));
    tags.forEach((t) => {
      selectedTagSet.add(t);
      selectedTagSet.add(t.split(".").pop());
    });
  }

  // Step 5: Compute metadata
  const allMatchedLower = new Set(matchedTagIds.map((t) => t.toLowerCase()));
  let coveredCount = 0;
  for (const tag of allMatchedLower) {
    if (selectedTagSet.has(tag) || selectedTagSet.has(tag.split(".").pop())) {
      coveredCount++;
    }
  }
  const tagCoverage = allMatchedLower.size > 0 ? coveredCount / allMatchedLower.size : 0;

  // Diversity score: 1 - average overlap ratio of consecutive items
  let diversityScore = 1;
  if (selected.length > 1) {
    let totalOverlap = 0;
    const runningTags = new Set();
    for (const item of selected) {
      totalOverlap += overlapRatio(item.course, runningTags);
      const tags = [...(item.course.canonical_tags || [])].map((t) => t?.toLowerCase?.() || "");
      tags.forEach((t) => runningTags.add(t));
    }
    diversityScore = 1 - totalOverlap / selected.length;
  }

  return {
    path: selected,
    metadata: {
      totalMinutes,
      tagCoverage: Math.round(tagCoverage * 100) / 100,
      diversityScore: Math.round(diversityScore * 100) / 100,
      itemCount: selected.length,
    },
  };
}

/**
 * Generate a human-readable reason for why a course was included.
 * @param {Object} candidate
 * @param {string[]} matchedTagIds
 * @returns {string}
 */
function generateReason(candidate, matchedTagIds) {
  const { course, role } = candidate;
  const courseTags = [...(course.canonical_tags || []), ...(course.gemini_system_tags || [])].map(
    (t) => (typeof t === "string" ? t.toLowerCase() : "")
  );

  const matchedSet = new Set(matchedTagIds.map((t) => t.toLowerCase()));
  const overlapping = courseTags.filter(
    (t) => matchedSet.has(t) || matchedSet.has(t.split(".").pop())
  );

  switch (role) {
    case "prerequisite":
      return `Foundation course — covers prerequisite concepts for ${overlapping.slice(0, 2).join(", ")}`;
    case "core":
      return `Directly covers: ${overlapping.slice(0, 3).join(", ")}`;
    case "troubleshooting":
      return `Troubleshooting guide — addresses symptoms related to your query`;
    case "supplemental":
      return `Related content — expands on topics connected to your query`;
    default:
      return `Relevant to your search`;
  }
}

export { estimateDuration, overlapRatio, assignRole, ROLE_PRIORITY };
