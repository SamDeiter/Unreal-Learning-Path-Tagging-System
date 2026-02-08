/**
 * Narrator Service - Generates AI-powered intro and bridge text
 * Bridges multiple instructors with a unified voice
 */

/**
 * Generate personalized intro text for a learning path
 * @param {Object} params
 * @param {string} params.problemSummary - The user's problem summary
 * @param {Array} params.courses - Selected courses with instructor info
 * @param {Object} params.diagnosis - AI diagnosis from queryLearningPath
 * @returns {Object} Intro text and metadata
 */
export function generatePathIntro({ problemSummary, courses, diagnosis }) {
  if (!courses || courses.length === 0) {
    return {
      title: "Your Learning Path",
      intro: "Let's solve your problem step by step.",
      instructors: [],
      totalDuration: null,
    };
  }

  // Extract unique instructors from courses
  const instructors = extractInstructors(courses);

  // Calculate total duration
  const totalDuration = calculateTotalDuration(courses);

  // Generate intro based on problem and instructors
  const intro = buildIntroText({
    problemSummary,
    instructors,
    courseCount: courses.length,
    totalDuration,
    rootCauses: diagnosis?.root_causes || [],
  });

  return {
    title: `Your Path: ${summarizeProblem(problemSummary)}`,
    intro,
    instructors,
    totalDuration,
    courseCount: courses.length,
  };
}

/**
 * Generate context bridge text between videos
 * @param {Object} previousCourse - The course that just finished
 * @param {Object} nextCourse - The upcoming course
 * @param {Object} learningObjective - What this video teaches
 * @returns {Object} Bridge text and display info
 */
export function generateBridgeText(previousCourse, nextCourse, learningObjective) {
  if (!nextCourse) {
    return {
      type: "completion",
      text: "🎉 Congratulations! You've completed your learning path.",
      subtext: "You now have the skills to solve this problem and similar ones in the future.",
    };
  }

  const prevInstructor = extractInstructorName(previousCourse);
  const nextInstructor = extractInstructorName(nextCourse);
  const nextTitle = nextCourse.title || nextCourse.name || "the next lesson";

  // Different instructors = transition message
  if (prevInstructor && nextInstructor && prevInstructor !== nextInstructor) {
    return {
      type: "transition",
      text: `Now let's hear from ${nextInstructor}`,
      subtext: `${nextInstructor} will cover: ${learningObjective || nextTitle}`,
      instructor: nextInstructor,
    };
  }

  // Same instructor = continuation
  return {
    type: "continuation",
    text: `Next up: ${nextTitle}`,
    subtext: learningObjective || null,
    instructor: nextInstructor,
  };
}

/**
 * Extract unique instructors from courses
 */
function extractInstructors(courses) {
  const instructorSet = new Set();
  const instructorList = [];

  courses.forEach((course) => {
    const instructor = extractInstructorName(course);
    if (instructor && !instructorSet.has(instructor)) {
      instructorSet.add(instructor);
      instructorList.push({
        name: instructor,
        courses: [course.title || course.name],
        totalDuration: calculateCourseDuration(course),
      });
    } else if (instructor) {
      // Add course to existing instructor
      const existing = instructorList.find((i) => i.name === instructor);
      if (existing) {
        existing.courses.push(course.title || course.name);
        existing.totalDuration += calculateCourseDuration(course);
      }
    }
  });

  return instructorList;
}

/**
 * Extract instructor name from course metadata
 */
function extractInstructorName(course) {
  if (!course) return null;

  // Try different field names
  return (
    course.instructor ||
    course.author ||
    course.creator ||
    course.teacher ||
    // Parse from title if contains "by" or "with"
    parseInstructorFromTitle(course.title || course.name) ||
    null
  );
}

/**
 * Parse instructor name from title (e.g., "Lumen Basics by Sarah")
 */
function parseInstructorFromTitle(title) {
  if (!title) return null;

  // Match patterns like "... by Name" or "... with Name"
  const byMatch = title.match(/\bby\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i);
  if (byMatch) return byMatch[1];

  const withMatch = title.match(/\bwith\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i);
  if (withMatch) return withMatch[1];

  return null;
}

/**
 * Calculate total duration of all courses
 */
function calculateTotalDuration(courses) {
  const totalSeconds = courses.reduce((sum, course) => {
    return sum + calculateCourseDuration(course);
  }, 0);

  return formatDurationText(totalSeconds);
}

/**
 * Calculate duration of a single course in seconds
 */
function calculateCourseDuration(course) {
  if (!course) return 0;

  // Try duration_seconds directly
  if (course.duration_seconds) return course.duration_seconds;

  // Try duration_minutes
  if (course.duration_minutes) return course.duration_minutes * 60;

  // Sum video durations
  if (course.videos?.length) {
    return course.videos.reduce((sum, v) => sum + (v.duration_seconds || 0), 0);
  }

  return 0;
}

/**
 * Format duration in seconds to readable text
 */
function formatDurationText(seconds) {
  if (!seconds || seconds <= 0) return null;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
  }
  return `${minutes} min`;
}

/**
 * Summarize problem into short title
 */
function summarizeProblem(problemSummary) {
  if (!problemSummary) return "Learning Path";

  // Take first 30 chars, end at word boundary
  const truncated = problemSummary.slice(0, 40);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 20 ? truncated.slice(0, lastSpace) + "..." : truncated;
}

/**
 * Build the intro text paragraph
 */
function buildIntroText({ instructors, courseCount, totalDuration, rootCauses }) {
  const parts = [];

  // Opening based on problem
  if (rootCauses.length > 0) {
    parts.push(
      `We've identified ${rootCauses.length} root cause${rootCauses.length > 1 ? "s" : ""} for your issue.`
    );
  }

  // Instructor mention
  if (instructors.length === 1) {
    parts.push(
      `${instructors[0].name} will guide you through ${courseCount} lesson${courseCount > 1 ? "s" : ""}.`
    );
  } else if (instructors.length > 1) {
    const names = instructors.map((i) => i.name);
    const lastInstructor = names.pop();
    parts.push(`You'll learn from ${names.join(", ")} and ${lastInstructor}.`);
  } else {
    parts.push(`You have ${courseCount} lesson${courseCount > 1 ? "s" : ""} to complete.`);
  }

  // Duration
  if (totalDuration) {
    parts.push(`Total time: ${totalDuration}.`);
  }

  return parts.join(" ");
}

/**
 * Generate progress text for current position
 */
export function generateProgressText(currentIndex, totalCount) {
  const percent = Math.round(((currentIndex + 1) / totalCount) * 100);
  return {
    text: `Video ${currentIndex + 1} of ${totalCount}`,
    percent,
    isComplete: currentIndex + 1 >= totalCount,
  };
}

/**
 * Generate a hands-on challenge based on course metadata.
 * Uses template patterns — no API calls needed.
 *
 * @param {Object} course - current course object
 * @param {string} problemContext - the user's original problem summary
 * @returns {{ task: string, hint: string, difficulty: string }}
 */
export function generateChallenge(course, problemContext) {
  const outcome = course?.gemini_outcomes?.[0] || "";
  const tags = course?.extracted_tags || course?.tags || [];
  const tagNames = tags
    .map((t) => (typeof t === "string" ? t : t.name || t.display_name || ""))
    .filter(Boolean);

  // Find a tag that matches the user's problem context (case-insensitive partial match)
  let primaryTag = tagNames[0] || "this concept";
  if (problemContext && tagNames.length > 0) {
    const contextLower = problemContext.toLowerCase();
    const relevantTag = tagNames.find((tag) => contextLower.includes(tag.toLowerCase()));
    if (relevantTag) {
      primaryTag = relevantTag;
    }
  }
  const skillLevel = course?.gemini_skill_level || "Intermediate";

  // Three challenge patterns — all focused on APPLYING the fix, not reproducing the problem
  const patterns = [
    {
      // Pattern 1: Apply the fix
      task: problemContext
        ? `Open UE5 and apply what you just learned to fix "${problemContext}". Which ${primaryTag} settings were key to the solution?`
        : `Open UE5 and set up ${primaryTag} from scratch. Try to get a working result using the approach from this lesson.`,
      hint: outcome
        ? `Focus on: ${outcome}`
        : `Look for ${primaryTag} settings in the Details panel or Project Settings.`,
    },
    {
      // Pattern 2: Build something with the concept
      task: outcome
        ? `Using what you learned, try to ${outcome.toLowerCase()} in your own project.`
        : `Create a simple test scene that demonstrates ${primaryTag}. Start with default settings, then customize.`,
      hint:
        tagNames.length > 1
          ? `Key concepts: ${tagNames.slice(0, 3).join(", ")}`
          : `Search the UE5 docs for "${primaryTag}" if you get stuck.`,
    },
    {
      // Pattern 3: Explain it back
      task: `In your own words, explain how ${primaryTag} works and when you would use it. Then set up a quick example in UE5 to confirm your understanding.`,
      hint: outcome
        ? `Your explanation should cover: ${outcome}`
        : `Try explaining it as if teaching a teammate — what are the key steps?`,
    },
  ];

  // Pick a pattern based on a simple hash of the course title (deterministic)
  const titleHash = (course?.title || "").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const pattern = patterns[titleHash % patterns.length];

  return {
    task: pattern.task,
    hint: pattern.hint,
    difficulty: skillLevel,
  };
}
