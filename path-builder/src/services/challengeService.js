/**
 * Challenge Service — Generates hands-on challenges from the challenge registry.
 * Static challenge data lives in data/challengeRegistry.json.
 */
import challengeRegistry from "../data/challengeRegistry.json";

/**
 * Generate a hands-on challenge based on course metadata.
 * Uses tag-specific templates with concrete UE5 steps.
 *
 * @param {Object} course - current course object
 * @param {string} problemContext - the user's original problem summary
 * @param {string} videoTitle - title of the current video
 * @returns {{ task: string, hint: string, expectedResult: string, difficulty: string }}
 */
export function generateChallenge(course, problemContext, videoTitle) {
  // Collect tags from ALL available sources
  const tags = [
    ...(course?.canonical_tags || []),
    ...(course?.gemini_system_tags || []),
    ...(course?.transcript_tags || []),
    ...(course?.extracted_tags || []),
    ...(Array.isArray(course?.tags) ? course.tags : []),
  ];
  const tagNames = tags
    .map((t) => (typeof t === "string" ? t.split(".").pop() : t.name || t.display_name || ""))
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i); // unique

  const skillLevel = course?.gemini_skill_level || "Intermediate";

  // Try to match tags against the challenge registry (case-insensitive)
  for (const tagName of tagNames) {
    const key = tagName.toLowerCase();
    const templates = challengeRegistry[key];
    if (templates && templates.length > 0) {
      const titleHash = (course?.title || "")
        .split("")
        .reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const template = templates[titleHash % templates.length];
      return {
        task: template.task,
        hint: template.hint,
        expectedResult: template.expectedResult,
        difficulty: skillLevel,
      };
    }
  }

  // Also check problem context for registry matches
  if (problemContext) {
    const contextLower = problemContext.toLowerCase();
    for (const [key, templates] of Object.entries(challengeRegistry)) {
      if (contextLower.includes(key)) {
        const template = templates[0];
        return {
          task: template.task,
          hint: template.hint,
          expectedResult: template.expectedResult,
          difficulty: skillLevel,
        };
      }
    }
  }

  // Fallback: still specific to UE5 even without a tag match
  const primaryTag =
    tagNames[0] || (videoTitle ? videoTitle.split(/\s+/).slice(0, 3).join(" ") : "this concept");
  const lessonRef = videoTitle ? `"${videoTitle}"` : "this lesson";
  const outcome = course?.gemini_outcomes?.[0] || "";

  return {
    task: problemContext
      ? `Open UE5 and apply the technique from ${lessonRef} to address "${problemContext}". In the Details panel, identify which ${primaryTag} settings you changed and note the before/after values.`
      : `Open UE5, create a test Actor, and set up ${primaryTag} from scratch following the approach from ${lessonRef}. Document which panels and properties you used.`,
    hint: outcome
      ? `Focus on: ${outcome}. Check Details panel and World Settings for relevant options.`
      : `Look for ${primaryTag} options in the Details panel, Modes panel, or Project Settings → Engine.`,
    expectedResult: problemContext
      ? `Your original issue ("${problemContext}") should be resolved or visibly improved in the viewport. Compare before/after values in the Details panel to confirm the change took effect.`
      : `You should see ${primaryTag} applied correctly in the viewport or preview. The Details panel should reflect the new settings, and the editor should show no warnings related to your changes.`,
    difficulty: skillLevel,
  };
}
