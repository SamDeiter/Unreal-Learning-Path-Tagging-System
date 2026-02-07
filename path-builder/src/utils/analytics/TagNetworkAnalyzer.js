/**
 * Tag Network Analysis Utilities
 *
 * Provides methods to analyze tag relationships beyond simple edges.
 */

// 1. Tag Co-occurrence Analysis
export const analyzeCoOccurrence = (courses, _tags) => {
  // Build adjacency matrix from course tags
  const adjacency = new Map();

  courses.forEach((course) => {
    const courseTags = [
      course.tags?.level,
      course.tags?.topic,
      ...(course.tags?.ai_tags || []),
    ].filter(Boolean);

    // Pairwise counting
    for (let i = 0; i < courseTags.length; i++) {
      for (let j = i + 1; j < courseTags.length; j++) {
        const t1 = courseTags[i];
        const t2 = courseTags[j];

        const key = [t1, t2].sort().join("::");
        adjacency.set(key, (adjacency.get(key) || 0) + 1);
      }
    }
  });

  return adjacency;
};

// 2. Implicit Prerequisite Detection
// Heuristic: If Tag A appears heavily in Beginner and Tag B in Advanced,
// and they co-occur or allow transition, infer A -> B.
export const detectPrerequisites = (courses) => {
  const topicLevels = new Map(); // topic -> avg level score (0,1,2)

  const levelScore = { Beginner: 0, Intermediate: 1, Advanced: 2 };

  courses.forEach((course) => {
    const score = levelScore[course.tags?.level];
    if (score === undefined) return;

    const topic = course.tags?.topic;
    if (!topic) return;

    if (!topicLevels.has(topic)) topicLevels.set(topic, { sum: 0, count: 0 });
    const stat = topicLevels.get(topic);
    stat.sum += score;
    stat.count++;
  });

  // Calculate avg level per topic
  const topicAvg = [];
  topicLevels.forEach((val, key) => {
    topicAvg.push({ topic: key, avg: val.sum / val.count });
  });

  // Sort by difficulty
  return topicAvg.sort((a, b) => a.avg - b.avg);
};

// 3. Cognitive Load Scoring (Entropy)
// Heuristic: More tags = higher load? Rare tags = higher load?
export const calculateCognitiveLoad = (course) => {
  let load = 1;
  // Base load from level
  if (course.tags?.level === "Intermediate") load += 2;
  if (course.tags?.level === "Advanced") load += 4;

  // Tag density
  const tagCount = (course.tags?.ai_tags || []).length;
  load += tagCount * 0.5;

  return Math.min(load, 10); // Cap at 10
};
