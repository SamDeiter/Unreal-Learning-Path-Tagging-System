/**
 * videoTopicExtractor — Extract human-readable learning topics from video filenames.
 *
 * Video filenames follow the pattern:
 *   100.01_09_ProjectBrowser_55.mp4 → "Project Browser"
 *   100.01_05_ContentPipeline_55.mp4 → "Content Pipeline"
 *
 * This logic was originally inline in Personas.generatePath() — extracted here
 * so both Personas and GuidedPlayer IntroCard can share it.
 */

const SKIP_TOPICS = new Set([
  "intro",
  "introduction",
  "outro",
  "summary",
  "review",
  "overview",
  "welcome",
]);

/**
 * Extract topics from video filenames.
 * @param {Array} videos - Array of video objects with a `name` field
 * @param {number} [maxCount=5] - Maximum number of topics to return
 * @returns {string[]} - Human-readable topic list (e.g. ["Project Browser", "Content Pipeline"])
 */
export function extractLearningTopics(videos, maxCount = 5) {
  if (!videos || !Array.isArray(videos)) return [];

  return (
    videos
      .map((v) => {
        const name = (v.name || "").replace(/\.[^.]+$/, ""); // strip extension
        // Extract the descriptive part (e.g., "ProjectBrowser" from "100.01_09_ProjectBrowser_55")
        const parts = name
          .split("_")
          .filter(
            (p) => p.length > 3 && !/^[\d.]+$/.test(p) && !/^\d{1,3}$/.test(p),
          );
        // The descriptive part is usually the longest non-numeric segment
        const topic = parts.reduce(
          (best, p) => (p.length > best.length ? p : best),
          "",
        );
        // Convert camelCase/PascalCase to spaced words
        return topic
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
      })
      .filter((t) => t.length > 3 && !SKIP_TOPICS.has(t.toLowerCase()))
      // Deduplicate
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .slice(0, maxCount)
  );
}

/**
 * Build a "You'll learn: ..." sentence from video topics.
 * Falls back to ai_tags when no topics can be extracted.
 * @param {Array} videos
 * @param {string[]} [aiTags=[]]
 * @returns {string}
 */
export function buildLearningOutcome(videos, aiTags = []) {
  const topics = extractLearningTopics(videos);
  if (topics.length > 0) {
    return `You'll learn: ${topics.join(", ")}`;
  }
  if (aiTags.length > 0) {
    return aiTags.slice(0, 4).join(", ");
  }
  return "";
}
