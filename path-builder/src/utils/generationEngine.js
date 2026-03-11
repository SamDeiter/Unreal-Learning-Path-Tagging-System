/**
 * Generation Engine - Improved
 *
 * Generates specific, content-aware learning artifacts from
 * user intent and selected path courses.
 *
 * Phase 8C: Memoized generateId + taxonomy-weighted getPrimarySkill
 */

import tagGraphService from "../services/TagGraphService";
import { classifySegment } from "../services/bloomClassifier";

// Stable ID generator (hashing string) — Phase 8C: memoized
const _idCache = new Map();
const generateId = (str) => {
  if (_idCache.has(str)) return _idCache.get(str);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const id = Math.abs(hash).toString(16);
  _idCache.set(str, id);
  return id;
};

/**
 * Get primary skill/topic from course based on tags.
 * Phase 8C: Uses TagGlobalWeight from tags.json to pick the most
 * significant "root" skill instead of the longest string.
 */
const _skillCache = new Map();
const getPrimarySkill = (course) => {
  const cacheKey = course.code || course.title;
  if (_skillCache.has(cacheKey)) return _skillCache.get(cacheKey);

  // Collect all tag strings from the course
  let tags = course.extracted_tags || [];
  if (!Array.isArray(tags)) {
    if (Array.isArray(course.tags)) {
      tags = course.tags;
    } else if (course.tags && typeof course.tags === "object") {
      tags = [course.tags.topic, course.tags.level].filter(Boolean);
    } else {
      tags = [];
    }
  }
  // Also include gemini_system_tags (high quality)
  const geminiTags = Array.isArray(course.gemini_system_tags) ? course.gemini_system_tags : [];
  const allTags = [...tags, ...geminiTags].filter((t) => typeof t === "string");

  if (allTags.length === 0) {
    const fallback = course.title?.split(" ")[0] || "UE5";
    _skillCache.set(cacheKey, fallback);
    return fallback;
  }

  // Rank by global_weight from tags.json (higher = more significant)
  const ranked = allTags.map((tagStr) => {
    const tagData = tagGraphService.getTag(tagStr);
    const weight = tagData?.relevance?.global_weight || 0;
    // Prefer root-level tags (fewer dots = higher in taxonomy)
    const depth = (tagStr.match(/\./g) || []).length;
    // Combined score: weight matters most, depth is tiebreaker
    return { tag: tagStr, score: weight * 10 - depth };
  });

  ranked.sort((a, b) => b.score - a.score);

  // Use display_name if available, otherwise the tag_id
  const bestTag = ranked[0].tag;
  const tagData = tagGraphService.getTag(bestTag);
  const result = tagData?.display_name || bestTag.split(".").pop();

  _skillCache.set(cacheKey, result);
  return result;
};

/**
 * Generate action verb based on difficulty level
 */
const getActionVerb = (course, index) => {
  const level = course.tags?.level || course.difficulty || "Intermediate";
  const verbs = {
    Beginner: ["Learn", "Understand", "Discover", "Explore", "Get started with"],
    Intermediate: ["Apply", "Implement", "Build", "Create", "Develop"],
    Advanced: ["Master", "Optimize", "Architect", "Engineer", "Design"],
  };
  const levelVerbs = verbs[level] || verbs.Intermediate;
  return levelVerbs[index % levelVerbs.length];
};

/**
 * Generate specific outline text based on course content
 */
const generateOutlineText = (course, role, index) => {
  const skill = getPrimarySkill(course);
  const verb = getActionVerb(course, index);

  // Extract key topics from tags - handle array vs object
  let rawTags = course.extracted_tags || (Array.isArray(course.tags) ? course.tags : []);
  if (!Array.isArray(rawTags)) rawTags = [];
  const topics = rawTags.filter((t) => typeof t === "string").slice(0, 2);
  const topicStr = topics.length > 0 ? topics.join(" and ") : skill;

  // Role-specific templates with variety
  const templates = {
    Prerequisite: [
      `Establish ${topicStr} fundamentals`,
      `Build foundation in ${skill} concepts`,
      `Review essential ${topicStr} prerequisites`,
    ],
    Core: [
      `${verb} ${topicStr} techniques`,
      `${verb} practical ${skill} workflows`,
      `Complete hands-on ${topicStr} exercises`,
      `${verb} real-world ${skill} patterns`,
    ],
    Supplemental: [
      `Deepen understanding of ${topicStr}`,
      `Explore advanced ${skill} techniques`,
      `Extend knowledge with ${topicStr} deep dive`,
    ],
  };

  const roleTemplates = templates[role] || templates.Core;
  return roleTemplates[index % roleTemplates.length];
};

export const generateStructure = (intent, courses) => {
  if (!courses || courses.length === 0) return [];

  const sections = [];

  // 1. Core Section
  const coreCourses = courses.filter((c) => !c.role || c.role === "Core");
  if (coreCourses.length > 0) {
    sections.push({
      id: "section-core",
      title: "Core Curriculum: " + (intent.primaryGoal || "Main Path"),
      items: coreCourses.map((c, i) => ({
        id: generateId(c.code + "outline" + i),
        text: generateOutlineText(c, "Core", i),
        relatedCourse: c.code,
        courseTitle: c.title,
      })),
    });
  }

  // 2. Supplemental Section
  const suppCourses = courses.filter((c) => c.role === "Supplemental");
  if (suppCourses.length > 0) {
    sections.push({
      id: "section-supp",
      title: "Deep Dives & Extensions",
      items: suppCourses.map((c, i) => ({
        id: generateId(c.code + "outline" + i),
        text: generateOutlineText(c, "Supplemental", i),
        relatedCourse: c.code,
        courseTitle: c.title,
      })),
    });
  }

  // 3. Prerequisites Section
  const preCourses = courses.filter((c) => c.role === "Prerequisite");
  if (preCourses.length > 0) {
    sections.unshift({
      id: "section-pre",
      title: "Foundational Prerequisites",
      items: preCourses.map((c, i) => ({
        id: generateId(c.code + "outline" + i),
        text: generateOutlineText(c, "Prerequisite", i),
        relatedCourse: c.code,
        courseTitle: c.title,
      })),
    });
  }

  return sections;
};

export const generateObjectives = (intent, courses) => {
  if (!courses || courses.length === 0) return [];

  const objectives = [];

  // 1. Goal-based objective
  const topic = intent.primaryGoal || "Unreal Engine";
  objectives.push({
    id: "obj-main",
    text: `Master ${topic} fundamentals through ${courses.length} targeted learning modules`,
    type: "goal",
  });

  // 2. Extract unique skills from all courses
  const allSkills = courses.flatMap((c) => {
    // Handle both array and object tag formats
    let tags = c.extracted_tags || [];
    if (!Array.isArray(tags)) {
      if (Array.isArray(c.tags)) {
        tags = c.tags;
      } else if (c.tags && typeof c.tags === "object") {
        tags = [c.tags.topic].filter(Boolean);
      } else {
        tags = [];
      }
    }
    return tags.filter((t) => typeof t === "string").slice(0, 2);
  });
  const uniqueSkills = [...new Set(allSkills)].slice(0, 4);

  // Generate more varied skill-specific objectives
  const skillObjectives = [
    (skill) => `Apply ${skill} techniques effectively in production pipelines`,
    (skill) => `Debug and resolve common ${skill} issues independently`,
    (skill) => `Follow ${skill} best practices and industry standards`,
    (skill) => `Optimize ${skill} implementations for real-time performance`,
  ];

  uniqueSkills.forEach((skill, i) => {
    objectives.push({
      id: generateId(skill + i),
      text: skillObjectives[i % skillObjectives.length](skill),
    });
  });

  // 3. Course-specific mastery objectives using Gemini outcomes
  courses.slice(0, 3).forEach((c) => {
    // Use Gemini outcomes if available, otherwise create skill-based objective
    let objectiveText;

    if (c.gemini_outcomes && Array.isArray(c.gemini_outcomes) && c.gemini_outcomes.length > 0) {
      // Use first Gemini outcome (most important)
      objectiveText = c.gemini_outcomes[0];
    } else {
      // Fallback: create objective from primary skill
      const skill = getPrimarySkill(c);
      const cleanTitle = (c.title || "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
      const titleWords = cleanTitle.split(" ");
      const mainConcept = titleWords.length > 3 ? titleWords.slice(0, 3).join(" ") : cleanTitle;
      objectiveText = `Demonstrate ${skill} proficiency through ${mainConcept} techniques`;
    }

    objectives.push({
      id: generateId(c.code + "obj"),
      text: objectiveText,
      courses: [c.code],
    });
  });

  return objectives;
};

export const generateGoals = (intent, courses) => {
  // Extract and categorize skills for better goal generation
  const allSkills = courses.flatMap((c) => {
    let tags = c.extracted_tags || [];
    if (!Array.isArray(tags)) {
      if (Array.isArray(c.tags)) {
        tags = c.tags;
      } else if (c.tags && typeof c.tags === "object") {
        tags = [c.tags.topic].filter(Boolean);
      } else {
        tags = [];
      }
    }
    return tags.filter((t) => typeof t === "string");
  });

  // Get unique skills and categorize them - filter out short/meaningless values
  const uniqueSkills = [...new Set(allSkills)].filter(
    (s) => s.length > 3 && !["the", "and", "for", "with"].includes(s.toLowerCase())
  );

  // Try to find a primary domain from intent, skills, or course title
  const getTopicFromCourse = (courses) => {
    if (!courses.length) return null;
    const title = courses[0].title || courses[0].folder_name || "";
    // Extract meaningful topic from course title
    const topicMatch = title.match(/(?:Introduction to |Learn |Master |)(\w+(?:\s+\w+)?)/i);
    return topicMatch ? topicMatch[1] : title.split(/[-_]/)[0];
  };

  const primaryDomain =
    intent.primaryGoal ||
    uniqueSkills.find((s) => s.length > 4) ||
    getTopicFromCourse(courses) ||
    "Unreal Engine";

  // Calculate total time with proper grammar
  const totalMinutes = courses.reduce((sum, c) => {
    return sum + (c.duration_seconds || c.durationSeconds || 600) / 60;
  }, 0);
  const hours = Math.round((totalMinutes / 60) * 10) / 10;
  const hoursText = hours === 1 ? "1 hour" : `${hours} hours`;
  const moduleText = courses.length === 1 ? "1 module" : `${courses.length} modules`;

  // Get skill level from intent or courses
  const skillLevel = intent.skillLevel || courses[0]?.gemini_skill_level || "working";

  // Create domain-specific goals (time estimate first)
  const goals = [
    {
      id: "goal-1",
      text: `Complete ${moduleText} (~${hoursText} of focused learning)`,
    },
    {
      id: "goal-2",
      text: `Achieve ${skillLevel.toLowerCase()} proficiency in ${primaryDomain}`,
    },
  ];

  // Add a third goal based on context
  if (courses.length >= 3) {
    // Multi-course path: focus on integration
    goals.push({
      id: "goal-3",
      text: `Build a production-ready project integrating multiple ${primaryDomain} techniques`,
    });
  } else if (courses.length === 1) {
    // Single course: focus on mastery
    goals.push({
      id: "goal-3",
      text: `Apply ${primaryDomain} skills to a hands-on portfolio project`,
    });
  } else {
    // 2 courses: focus on progression
    goals.push({
      id: "goal-3",
      text: `Progress from fundamentals to practical ${primaryDomain} implementation`,
    });
  }

  return goals;
};

/**
 * Multi-signal weighted scoring to optimize path order.
 *
 * Signals (weighted):
 *   1. Tag depth & prerequisites  (40%) — shallower/foundational tags first
 *   2. Bloom taxonomy level       (30%) — Remember → Create progression
 *   3. Role metadata              (20%) — Prerequisite → Core → Supplemental
 *   4. Difficulty level            (10%) — Beginner → Intermediate → Advanced
 *
 * After scoring, courses are sorted ascending (lowest score = earliest).
 */

const BLOOM_ORDER = {
  remember: 1, understand: 2, apply: 3,
  analyze: 4, evaluate: 5, create: 6,
};

const ROLE_ORDER = { Prerequisite: 0, Core: 1, Supplemental: 2, "Next Step": 3 };
const LEVEL_ORDER = { Beginner: 0, Foundation: 0, Intermediate: 1, Advanced: 2 };

/**
 * Collect all tag strings from a course, combining every available source.
 */
function collectCourseTags(course) {
  const sources = [
    course.extracted_tags,
    course.gemini_system_tags,
    course.canonical_tags,
    course.ai_tags,
    course.transcript_tags,
  ];

  const tags = [];
  for (const src of sources) {
    if (Array.isArray(src)) {
      for (const t of src) {
        if (typeof t === "string") tags.push(t);
      }
    }
  }

  // Legacy object tags
  if (course.tags && typeof course.tags === "object" && !Array.isArray(course.tags)) {
    if (typeof course.tags.topic === "string") tags.push(course.tags.topic);
  }

  return tags;
}

/**
 * Compute average tag depth for a course.
 * Shallower tags (e.g. "rendering") → lower depth → foundational.
 * Deeper tags (e.g. "rendering.lumen.global_illumination") → higher depth → advanced.
 * Returns 0-1 normalized score.
 */
function tagDepthScore(course) {
  const tags = collectCourseTags(course);
  if (tags.length === 0) return 0.5; // neutral default

  let totalDepth = 0;
  let count = 0;
  for (const tagStr of tags) {
    const tagData = tagGraphService.getTag(tagStr);
    // Depth from dot segments: "rendering" = 1, "rendering.lumen" = 2
    const depth = (tagStr.match(/\./g) || []).length + 1;
    // Weight by global_weight so important tags matter more
    const weight = tagData?.relevance?.global_weight || 0.5;
    totalDepth += depth * weight;
    count += weight;
  }

  const avgDepth = count > 0 ? totalDepth / count : 1.5;
  // Normalize: depth 1 → 0.0, depth 4+ → 1.0
  return Math.min(Math.max((avgDepth - 1) / 3, 0), 1);
}

/**
 * Compute Bloom taxonomy score for a course.
 * Returns 0-1 normalized (Remember=0.17, Create=1.0).
 */
function bloomScore(course) {
  const bloom = classifySegment(
    course.title || "",
    course.gemini_enriched?.one_sentence_summary || ""
  );
  return (BLOOM_ORDER[bloom.level] || 3) / 6;
}

/**
 * Compute role score. Returns 0-1 normalized.
 */
function roleScore(course) {
  return (ROLE_ORDER[course.role || "Core"] ?? 1) / 3;
}

/**
 * Compute difficulty level score. Returns 0-1 normalized.
 */
function levelScore(course) {
  return (LEVEL_ORDER[course.tags?.level] ?? 1) / 2;
}

export const optimizePathOrder = (courses) => {
  if (courses.length <= 1) return [...courses];

  // Compute weighted position score for each course
  const scored = courses.map((course) => {
    const td = tagDepthScore(course);
    const bl = bloomScore(course);
    const rl = roleScore(course);
    const lv = levelScore(course);

    const score = (0.40 * td) + (0.30 * bl) + (0.20 * rl) + (0.10 * lv);

    return { course, score };
  });

  // Sort ascending — lowest score comes first (foundational → advanced)
  scored.sort((a, b) => a.score - b.score || a.course.title.localeCompare(b.course.title));

  return scored.map(({ course }) => course);
};
