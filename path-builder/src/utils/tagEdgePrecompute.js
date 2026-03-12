/**
 * tagEdgePrecompute.js — Extracted tag/edge computation from App.jsx
 *
 * Moves the O(n×m) tag count derivation + co-occurrence edge calculation
 * into a standalone module with identity-based caching. This avoids
 * recomputing on every React render when the underlying data hasn't changed.
 *
 * Performance:
 *   Before: O(tags × courses × tagFields) per render → ~1600 courses × 500 tags × 5 fields
 *   After:  O(courses × tagFields) + O(tags) per render (inverted index lookup)
 */

import tagsData from "../data/tags.json";
import edgesData from "../data/edges.json";

// ── Cache to skip recomputation when courses array identity hasn't changed ──
let _cachedCourses = null;
let _cachedResult = null;

/**
 * Collect all tag strings from a course (lowercased).
 * Shared helper used by both tag counting and co-occurrence.
 */
function collectCourseTags(course) {
  return [
    ...(course.canonical_tags || []),
    ...(course.ai_tags || []),
    ...(course.gemini_system_tags || []),
    ...(course.transcript_tags || []),
    ...(course.extracted_tags || []),
  ]
    .map((t) => (typeof t === "string" ? t.toLowerCase().trim() : ""))
    .filter(Boolean);
}

/**
 * Build an inverted index: lowercased tag string → Set<course indices>
 * This turns the O(tags × courses) scan into O(courses) + O(tags) lookups.
 */
function buildTagIndex(courses) {
  const index = new Map(); // lowercased tag string → Set<course index>
  courses.forEach((course, i) => {
    const tags = collectCourseTags(course);
    for (const tag of tags) {
      if (!index.has(tag)) index.set(tag, new Set());
      index.get(tag).add(i);
    }
  });
  return index;
}

/**
 * Compute processed tags with course counts using the inverted index.
 * Complexity: O(rawTags) instead of O(rawTags × courses × tagFields).
 */
function computeTags(courses, tagIndex) {
  const rawTags = tagsData.tags || [];
  const seenTagIds = new Set();

  return rawTags
    .filter((tag) => {
      if (seenTagIds.has(tag.tag_id)) return false;
      seenTagIds.add(tag.tag_id);
      return true;
    })
    .map((tag) => {
      // O(1) lookup via inverted index instead of O(courses) scan
      const tagIdLower = tag.tag_id.toLowerCase();
      const tagNameLower = tag.display_name.toLowerCase();
      const idMatches = tagIndex.get(tagIdLower);
      const nameMatches = tagIndex.get(tagNameLower);

      // Union the two sets (a tag can be referenced by ID or display name)
      let courseCount = 0;
      if (idMatches && nameMatches) {
        const union = new Set(idMatches);
        for (const idx of nameMatches) union.add(idx);
        courseCount = union.size;
      } else {
        courseCount = (idMatches?.size || 0) || (nameMatches?.size || 0);
      }

      return {
        id: tag.tag_id,
        label: tag.display_name,
        name: tag.display_name,
        count: courseCount,
        description: tag.description,
        tag_id: tag.tag_id,
        categoryPath: tag.category_path,
        category: tag.category,
        synonyms: tag.synonyms,
      };
    });
}

/**
 * Compute co-occurrence edges from courses — tags appearing together.
 * Supplements the sparse curated edges with real course data.
 */
function computeEdges(courses, processedTags) {
  // Curated edges from edges.json
  const rawEdges = Array.isArray(edgesData) ? edgesData : edgesData.edges || [];
  const curatedEdges = rawEdges.map((edge) => ({
    sourceTagId: edge.sourceTagId || edge.source,
    targetTagId: edge.targetTagId || edge.target,
    weight: edge.weight || 5,
    relation: edge.type || edge.relation || "related",
  }));

  // Build display name → tag ID lookup
  const nameToId = new Map();
  processedTags.forEach((t) => {
    nameToId.set(t.id.toLowerCase(), t.id);
    if (t.label) nameToId.set(t.label.toLowerCase(), t.id);
  });

  // Co-occurrence: O(courses × tags²) — unavoidable but now only runs once
  const coOccurrenceWeights = new Map();
  courses.forEach((course) => {
    const rawTags = collectCourseTags(course);
    const resolvedIds = rawTags.map((t) => nameToId.get(t)).filter(Boolean);
    const uniqueTags = [...new Set(resolvedIds)];
    for (let i = 0; i < uniqueTags.length; i++) {
      for (let j = i + 1; j < uniqueTags.length; j++) {
        const [a, b] = [uniqueTags[i], uniqueTags[j]].sort();
        const key = `${a}|${b}`;
        coOccurrenceWeights.set(key, (coOccurrenceWeights.get(key) || 0) + 1);
      }
    }
  });

  // Merge: curated edges take priority
  const edgeMap = new Map();
  curatedEdges.forEach((e) => {
    const [a, b] = [e.sourceTagId, e.targetTagId].sort();
    const key = `${a}|${b}`;
    edgeMap.set(key, e);
  });
  coOccurrenceWeights.forEach((weight, key) => {
    if (!edgeMap.has(key) && weight >= 25) {
      const [sourceTagId, targetTagId] = key.split("|");
      edgeMap.set(key, { sourceTagId, targetTagId, weight, relation: "co-occurrence" });
    }
  });

  return [...edgeMap.values()];
}

/**
 * Main entry point — returns { tags, edges } with identity-based caching.
 * If the courses array reference hasn't changed, returns the cached result.
 */
export function precomputeTagsAndEdges(courses) {
  if (courses === _cachedCourses && _cachedResult) {
    return _cachedResult;
  }

  const tagIndex = buildTagIndex(courses);
  const tags = computeTags(courses, tagIndex);
  const edges = computeEdges(courses, tags);

  _cachedCourses = courses;
  _cachedResult = { tags, edges };
  return _cachedResult;
}
