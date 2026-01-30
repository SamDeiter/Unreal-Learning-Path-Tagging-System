/**
 * Generation Engine - Improved
 *
 * Generates specific, content-aware learning artifacts from
 * user intent and selected path courses.
 */

// Stable ID generator (hashing string)
const generateId = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

/**
 * Get primary skill/topic from course based on tags
 */
const getPrimarySkill = (course) => {
  // Handle both array and object tag formats
  let tags = course.extracted_tags || [];
  if (!Array.isArray(tags)) {
    // If tags is not an array, try to extract from object or default to empty
    if (Array.isArray(course.tags)) {
      tags = course.tags;
    } else if (course.tags && typeof course.tags === "object") {
      // Extract topic if available
      tags = [course.tags.topic, course.tags.level].filter(Boolean);
    } else {
      tags = [];
    }
  }
  // Find most specific tag (longer = more specific)
  const sorted = [...tags].filter((t) => typeof t === "string").sort((a, b) => b.length - a.length);
  return sorted[0] || course.title?.split(" ")[0] || "UE5";
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

  // 3. Course-specific mastery objectives (format titles nicely)
  courses.slice(0, 2).forEach((c) => {
    // Clean up title: remove underscores, extract main concept
    const cleanTitle = (c.title || "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
    objectives.push({
      id: generateId(c.code + "obj"),
      text: `Apply lessons from "${cleanTitle}" in a hands-on project`,
      courses: [c.code],
    });
  });

  return objectives;
};

export const generateGoals = (intent, courses) => {
  // Extract skill strings only (filter out objects)
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
    // Only include string values
    return tags.filter((t) => typeof t === "string");
  });
  const topSkills = [...new Set(allSkills)].slice(0, 3);
  const skillsText = topSkills.length > 0 ? topSkills.join(", ") : "Unreal Engine";

  const totalMinutes = courses.reduce((sum, c) => {
    return sum + (c.duration_seconds || c.durationSeconds || 600) / 60;
  }, 0);
  const hours = Math.round((totalMinutes / 60) * 10) / 10; // Round to 1 decimal

  // Get skill level from intent or courses
  const skillLevel = intent.skillLevel || courses[0]?.gemini_skill_level || "working";

  return [
    {
      id: "goal-1",
      text: `Build ${skillLevel.toLowerCase()} proficiency in ${skillsText}`,
    },
    {
      id: "goal-2",
      text: `Complete ${courses.length} modules (~${hours} hours of focused learning)`,
    },
    {
      id: "goal-3",
      text: "Create a portfolio piece demonstrating your new skills",
    },
  ];
};

/**
 * Heuristic to optimize path order
 */
export const optimizePathOrder = (courses) => {
  const rolePriority = { Prerequisite: 0, Core: 1, Supplemental: 2 };
  const levelPriority = { Beginner: 0, Intermediate: 1, Advanced: 2 };

  return [...courses].sort((a, b) => {
    const roleA = rolePriority[a.role || "Core"];
    const roleB = rolePriority[b.role || "Core"];
    if (roleA !== roleB) return roleA - roleB;

    const levelA = levelPriority[a.tags?.level] ?? 1;
    const levelB = levelPriority[b.tags?.level] ?? 1;
    if (levelA !== levelB) return levelA - levelB;

    const weightPriority = { High: 0, Medium: 1, Low: 2 };
    const weightA = weightPriority[a.weight || "Medium"] ?? 1;
    const weightB = weightPriority[b.weight || "Medium"] ?? 1;
    if (weightA !== weightB) return weightA - weightB;

    return a.title.localeCompare(b.title);
  });
};
