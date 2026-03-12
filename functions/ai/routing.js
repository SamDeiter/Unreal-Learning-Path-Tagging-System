/**
 * routing.js — Query mode detection for the unified /query endpoint.
 *
 * Determines whether an incoming request is:
 *   - "onboarding" (persona-based First Hour flows)
 *   - "problem-first" (natural-language troubleshooting)
 *   - "unknown" (needs more info)
 *
 * Extracted from queryLearningPath.js for testability.
 */

/**
 * Detect whether this is an onboarding request or a problem-first request.
 *
 * @param {object} data - Raw request data
 * @returns {"onboarding" | "problem-first" | "unknown"} Detected mode
 */
function detectMode(data) {
  const { query, mode, persona, isOnboarding } = data;

  if (mode === "onboarding" || isOnboarding) return "onboarding";
  if (mode === "problem-first" || mode === "problem") return "problem-first";

  if (persona && query) {
    const queryLower = query.toLowerCase();
    const problemIndicators = [
      "error",
      "crash",
      "bug",
      "broken",
      "not working",
      "fails",
      "doesn't",
      "won't",
      "can't",
      "issue",
      "problem",
      "help",
      "fix",
      "debug",
      "null",
      "none",
      "access violation",
    ];
    const isProblem = problemIndicators.some((ind) => queryLower.includes(ind));
    return isProblem ? "problem-first" : "onboarding";
  }

  if (query && query.length > 10) return "problem-first";
  if (persona) return "onboarding";
  return "unknown";
}

module.exports = { detectMode };
