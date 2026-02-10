/**
 * Challenge Service — Generates hands-on challenges from the challenge registry.
 * Static challenge data lives in data/challengeRegistry.json.
 */
import challengeRegistry from "../data/challengeRegistry.json";

/**
 * Generate a hands-on challenge based on course metadata.
 * Uses tag-specific templates with concrete UE5 steps.
 * Guarantees unique challenges per course by collecting all relevant
 * templates and selecting based on courseIndex.
 *
 * @param {Object} course - current course object
 * @param {string} problemContext - the user's original problem summary
 * @param {string} videoTitle - title of the current video
 * @param {number} courseIndex - index of the course in the path (ensures uniqueness)
 * @returns {{ task: string, hint: string, expectedResult: string, difficulty: string }}
 */
export function generateChallenge(course, problemContext, videoTitle, courseIndex = 0) {
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
  const contextLower = (problemContext || "").toLowerCase();

  // ── Collect ALL matching template pools ──
  // Instead of short-circuiting on the first match, gather every relevant
  // template so we have enough variety to give each course a unique challenge.
  const allTemplates = [];
  const seenTasks = new Set();

  const addTemplates = (templates) => {
    for (const t of templates) {
      if (!seenTasks.has(t.task)) {
        seenTasks.add(t.task);
        allTemplates.push(t);
      }
    }
  };

  // 1. Problem-context matches (highest priority — added first)
  if (contextLower) {
    const registryKeys = Object.keys(challengeRegistry).sort((a, b) => b.length - a.length);
    for (const key of registryKeys) {
      if (contextLower.includes(key)) {
        addTemplates(challengeRegistry[key]);
      }
    }
  }

  // 2. Course-tag matches (added second, deduped)
  const sortedTagNames = [...tagNames].sort((a, b) => {
    const aInQuery = contextLower.includes(a.toLowerCase()) ? 1 : 0;
    const bInQuery = contextLower.includes(b.toLowerCase()) ? 1 : 0;
    return bInQuery - aInQuery;
  });
  for (const tagName of sortedTagNames) {
    const key = tagName.toLowerCase();
    if (challengeRegistry[key]) {
      addTemplates(challengeRegistry[key]);
    }
  }

  // 3. Pick from the combined pool using courseIndex (simple & guaranteed unique)
  if (allTemplates.length > 0) {
    const template = allTemplates[courseIndex % allTemplates.length];
    return {
      task: template.task,
      hint: template.hint,
      expectedResult: template.expectedResult,
      difficulty: skillLevel,
    };
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
