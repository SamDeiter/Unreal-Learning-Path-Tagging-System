/**
 * Suggestion Engine
 *
 * Provides heuristics to automatically suggest Prerequisites and Supplemental
 * courses based on the current path and selected tags.
 */

// Confidence threshold for tags
const MIN_CONFIDENCE = 2;

/**
 * Suggest Prerequisites
 * Logic: For every "Core" course in the path, find "Beginner" or "Foundation"
 * courses that share the same Topic.
 *
 * @param {Array} pathCourses - Current courses in the path
 * @param {Array} library - Full list of available courses
 * @returns {Array} - List of suggested prerequisite courses
 */
export const suggestPrerequisites = (pathCourses, library) => {
  if (!pathCourses || pathCourses.length === 0) return [];

  const existingCodes = new Set(pathCourses.map((c) => c.code));
  const suggestions = new Map(); // Use Map to deduplicate by code

  // Use all passed courses to base suggestions on
  const coreCourses = pathCourses;

  coreCourses.forEach((core) => {
    const coreTopic = core.tags?.topic;
    const coreLevel = core.tags?.level;

    if (!coreTopic) return;

    // We only suggest prereqs if the core is NOT already beginner
    if (coreLevel === "Beginner" || coreLevel === "Foundation") return;

    // Find candidates
    const candidates = library.filter((c) => {
      // Must be same topic
      if (c.tags?.topic !== coreTopic) return false;
      // Must be lower level (Beginner is universal prereq)
      if (c.tags?.level !== "Beginner" && c.tags?.level !== "Foundation") return false;
      // Must not be in path already
      if (existingCodes.has(c.code)) return false;
      return true;
    });

    candidates.forEach((cand) => {
      if (!suggestions.has(cand.code)) {
        suggestions.set(cand.code, {
          ...cand,
          role: "Prerequisite",
          why: `Foundation for ${coreTopic} (supports ${core.title})`,
        });
      }
    });
  });

  return Array.from(suggestions.values());
};

/**
 * Helper to calculate score based on tag overlap
 * @param {Array} selectedTags - Array of tag OBJECTS { id, label, category }
 * @param {Array} pathCourses
 * @param {Array} library
 * @param {Array} prereqs
 */
export const suggestSupplementalByTags = (selectedTags, pathCourses, library, prereqs = []) => {
  if (!selectedTags || selectedTags.length === 0) return [];

  const existingCodes = new Set([...pathCourses.map((c) => c.code), ...prereqs.map((c) => c.code)]);

  // Helper to normalize strings for matching
  const normalize = (str) =>
    str
      ? str
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]/g, "")
      : "";

  // Build a set of normalized keys from user's selected tags (ID, Label, Synonyms)
  const selectedTagKeys = new Set();
  selectedTags.forEach((tag) => {
    selectedTagKeys.add(normalize(tag.label));
    selectedTagKeys.add(normalize(tag.id));
    if (tag.synonyms) {
      tag.synonyms.forEach((syn) => selectedTagKeys.add(normalize(syn)));
    }
    // Also add last segment of ID (e.g., "visuals.lighting" -> "lighting")
    if (tag.id && tag.id.includes(".")) {
      const parts = tag.id.split(".");
      selectedTagKeys.add(normalize(parts[parts.length - 1]));
    }
  });

  devLog("Selected Tag Keys for matching:", Array.from(selectedTagKeys));

  const scored = library
    .map((course) => {
      if (existingCodes.has(course.code)) return null;

      let score = 0;
      // Collect all course tag values
      const courseTagValues = [
        course.tags?.level,
        course.tags?.topic,
        course.tags?.product,
        course.tags?.industry,
        ...(course.tags?.ai_tags || []),
      ].filter(Boolean);

      courseTagValues.forEach((val) => {
        if (selectedTagKeys.has(normalize(val))) {
          score += 1;
        }
      });

      return { course, score };
    })
    .filter((item) => item && item.score > 0)
    .sort((a, b) => b.score - a.score);

  devLog(
    "Scored courses:",
    scored.slice(0, 10).map((s) => ({ title: s.course.title, score: s.score }))
  );

  return scored.slice(0, 5).map((item) => {
    const course = item.course;
    const level = course.tags?.level || "";
    const title = course.title || "";

    // Auto-detect prerequisites: Beginner/Foundation level OR "intro" in title
    const isIntro = level === "Beginner" || level === "Foundation" || /intro/i.test(title);

    return {
      ...course,
      role: isIntro ? "Prerequisite" : "Core",
      weight: isIntro ? "High" : "Medium",
      why: `Matches your interest in: ${selectedTags
        .map((t) => t.label)
        .slice(0, 3)
        .join(", ")}`,
    };
  });
};

/**
 * Suggest Next Steps
 * Logic: Analyze the current path's topics and levels.
 * If a topic ends at "Beginner", suggest "Intermediate" for that topic.
 * If a topic ends at "Intermediate", suggest "Advanced".
 *
 * @param {Array} pathCourses - Current courses in the path
 * @param {Array} library - Full list of available courses
 * @returns {Array} - List of suggested next step courses
 */
export const suggestNextSteps = (pathCourses, library) => {
  if (!pathCourses || pathCourses.length === 0) return [];

  const existingCodes = new Set(pathCourses.map((c) => c.code));
  const suggestions = [];

  // Group path by topic
  const topicLevels = {}; // { "Blueprints": "Intermediate", ... } (stores MAX level found)

  pathCourses.forEach((c) => {
    if (!c.tags?.topic || !c.tags?.level) return;
    const topic = c.tags.topic;
    const level = c.tags.level;

    // Level hierarchy
    const levels = { Beginner: 1, Foundation: 1, Intermediate: 2, Advanced: 3 };
    const currentVal = levels[topicLevels[topic]] || 0;
    const newVal = levels[level] || 0;

    if (newVal > currentVal) {
      topicLevels[topic] = level;
    }
  });

  // Find next step for each topic
  Object.entries(topicLevels).forEach(([topic, maxLevel]) => {
    let targetLevel = "";
    if (maxLevel === "Beginner" || maxLevel === "Foundation") targetLevel = "Intermediate";
    else if (maxLevel === "Intermediate") targetLevel = "Advanced";

    if (!targetLevel) return; // No next step for Advanced or unknown

    // Find candidates in library
    const candidates = library.filter((c) => {
      if (existingCodes.has(c.code)) return false;
      if (c.tags?.topic !== topic) return false;
      if (c.tags?.level !== targetLevel) return false;
      return true;
    });

    // Pick top candidate (maybe random, or first found)
    // For now, take the first one
    if (candidates.length > 0) {
      const nextStep = candidates[0];
      suggestions.push({
        ...nextStep,
        role: "Next Step",
        why: `Continue your ${topic} journey (Next Step: ${targetLevel})`,
      });
    }
  });

  return suggestions;
};

import { topicDocs } from "../data/topicDocs";

import { devLog } from "./logger";

/**
 * Get Official Documentation Links
 * Logic: Extract unique topics from the path, look up in topicDocs.
 *
 * @param {Array} pathCourses
 * @returns {Array} - List of { title, url }
 */
export const getOfficialDocs = (pathCourses) => {
  if (!pathCourses || pathCourses.length === 0) return [];

  const topics = new Set();
  pathCourses.forEach((c) => {
    if (c.tags?.topic) topics.add(c.tags.topic);
    // Also check explicit topic field if tags missing
    if (c.topic) topics.add(c.topic);
  });

  const docs = [];
  const seenUrls = new Set();

  topics.forEach((t) => {
    if (topicDocs[t]) {
      topicDocs[t].forEach((doc) => {
        if (!seenUrls.has(doc.url)) {
          seenUrls.add(doc.url);
          docs.push({ ...doc, topic: t });
        }
      });
    }
  });

  return docs;
};
