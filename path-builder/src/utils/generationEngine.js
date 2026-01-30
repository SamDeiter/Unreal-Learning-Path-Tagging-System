/**
 * Generation Engine - MVP
 *
 * Deterministic heuristics to generate learning artifacts from
 * user intent and selected path courses.
 */

// Stable ID generator (hashing string)
const generateId = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
};

export const generateStructure = (intent, courses) => {
  if (!courses || courses.length === 0) return [];

  // Group by Role first, then Topic
  const sections = [];

  // 1. Core Section
  const coreCourses = courses.filter((c) => !c.role || c.role === "Core");
  if (coreCourses.length > 0) {
    sections.push({
      id: "section-core",
      title: "Core Curriculum: " + (intent.primaryGoal || "Main Path"),
      items: coreCourses.map((c) => ({
        id: generateId(c.code + "outline"),
        text: `Master concepts in ${c.title}`,
        relatedCourse: c.code,
      })),
    });
  }

  // 2. Supplemental Section
  const suppCourses = courses.filter((c) => c.role === "Supplemental");
  if (suppCourses.length > 0) {
    sections.push({
      id: "section-supp",
      title: "Deep Dives & Supplemental",
      items: suppCourses.map((c) => ({
        id: generateId(c.code + "outline"),
        text: `Explore advanced techniques in ${c.title}`,
        relatedCourse: c.code,
      })),
    });
  }

  // 3. Prerequisites Section
  const preCourses = courses.filter((c) => c.role === "Prerequisite");
  if (preCourses.length > 0) {
    sections.unshift({
      id: "section-pre",
      title: "Foundational Prerequisites",
      items: preCourses.map((c) => ({
        id: generateId(c.code + "outline"),
        text: `Build foundation with ${c.title}`,
        relatedCourse: c.code,
      })),
    });
  }

  return sections;
};

export const generateObjectives = (intent, courses) => {
  if (!courses || courses.length === 0) return [];

  const objectives = [];

  // 1. Goal-based objective
  const topic = intent.primaryGoal || "Custom Path";
  objectives.push({
    id: "obj-main",
    text: `Demonstrate competency in ${topic} by completing ${courses.length} learning modules.`,
    type: "goal",
  });

  // 2. Skill-based objectives (from tags)
  const allTags = courses.flatMap((c) => c.tags?.topic || []);
  const uniqueTopics = [...new Set(allTags)];

  uniqueTopics.slice(0, 5).forEach((topic) => {
    objectives.push({
      id: generateId(topic),
      text: `Apply ${topic} workflows in a production context.`,
      courses: courses.filter((c) => c.tags?.topic === topic).map((c) => c.code),
    });
  });

  // 3. Course-specific objectives (sample)
  courses.slice(0, 3).forEach((c) => {
    objectives.push({
      id: generateId(c.code + "obj"),
      text: `Synthesize key learnings from "${c.title}" into your project workflow.`,
      courses: [c.code],
    });
  });

  return objectives;
};

export const generateGoals = (intent, courses) => {
  return [
    {
      id: "goal-1",
      text: `Master ${intent.skillLevel || "fundamental"} concepts in ${intent.primaryGoal || "selected path"}`,
    },
    {
      id: "goal-2",
      text: `Dedicate approx. ${Math.ceil(courses.length * 2)} hours to hands-on practice`,
    },
    {
      id: "goal-3",
      text: "Build a portfolio piece demonstrating these skills",
    },
  ];
};

/**
 * Heuristic to optimize path order
 * Order: Prerequisite -> Core -> Supplemental
 * Secondary sort: Level (Beginner -> Advanced)
 */
export const optimizePathOrder = (courses) => {
  const rolePriority = { Prerequisite: 0, Core: 1, Supplemental: 2 };
  const levelPriority = { Beginner: 0, Intermediate: 1, Advanced: 2 };

  return [...courses].sort((a, b) => {
    // 1. Role
    const roleA = rolePriority[a.role || "Core"];
    const roleB = rolePriority[b.role || "Core"];
    if (roleA !== roleB) return roleA - roleB;

    // 2. Level
    const levelA = levelPriority[a.tags?.level] ?? 1;
    const levelB = levelPriority[b.tags?.level] ?? 1;
    if (levelA !== levelB) return levelA - levelB;

    // 3. Weight (High -> Low)
    const weightPriority = { High: 0, Medium: 1, Low: 2 };
    const weightA = weightPriority[a.weight || "Medium"] ?? 1;
    const weightB = weightPriority[b.weight || "Medium"] ?? 1;
    if (weightA !== weightB) return weightA - weightB;

    // 4. Original Title (stable sort fallback)
    return a.title.localeCompare(b.title);
  });
};
