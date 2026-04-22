/**
 * routing.js — Query mode detection for the unified /query endpoint.
 *
 * Determines whether an incoming request is:
 *   - "goal-build"    (broad learner goals → roadmap of milestone micro-paths)
 *   - "onboarding"    (persona-based First Hour flows)
 *   - "problem-first" (natural-language troubleshooting)
 *   - "unknown"       (needs more info)
 *
 * Extracted from queryLearningPath.js for testability.
 */

// ── Indicator lists ─────────────────────────────────────────────────

const PROBLEM_INDICATORS = [
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
  "flicker",
  "artifact",
  "won't compile",
];

const GOAL_BUILD_INDICATORS = [
  "new to ue5",
  "new to unreal",
  "beginner",
  "from scratch",
  "first game",
  "first project",
  "want to make",
  "want to build",
  "want to create",
  "want to learn",
  "learn unreal",
  "learn ue5",
  "just starting",
  "getting started",
  "how do i start",
  "where do i start",
  "roadmap",
  "learning path for",
  "complete beginner",
  "never used unreal",
  "teach me",
];

/**
 * Detect query mode from incoming request data.
 *
 * @param {object} data - Raw request data
 * @param {object} [learnerState] - Optional per-user skillState (from skillStateReader)
 * @returns {"goal-build" | "onboarding" | "problem-first" | "unknown"} Detected mode
 */
function detectMode(data, learnerState = {}) {
  const { query, mode, persona, isOnboarding } = data;

  // ── Explicit mode override ──
  if (mode === "goal-build") return "goal-build";
  if (mode === "onboarding" || isOnboarding) return "onboarding";
  if (mode === "problem-first" || mode === "problem") return "problem-first";

  const ls = learnerState || {};
  const lsPersona = typeof ls.persona === "string" ? ls.persona : null;
  const lsTopicsLearned = Array.isArray(ls.topicsLearned) ? ls.topicsLearned : [];
  const lsSkillState = (ls.skillState && typeof ls.skillState === "object") ? ls.skillState : {};

  if (query) {
    const queryLower = query.toLowerCase();

    const isProblem = PROBLEM_INDICATORS.some((ind) => queryLower.includes(ind));
    const isGoalBuild = GOAL_BUILD_INDICATORS.some((ind) => queryLower.includes(ind));

    // Strong keyword signals take precedence
    if (isGoalBuild && !isProblem) return "goal-build";
    if (isProblem) return "problem-first";

    // ── SkillState tiebreakers for ambiguous queries ──
    // Expert-level topic referenced in query → bias toward goal-build (advanced)
    const expertTags = Object.entries(lsSkillState)
      .filter(([, v]) => v && v.level === "expert")
      .map(([tag]) => tag);
    if (expertTags.length > 0) {
      const hit = expertTags.some((tag) => {
        const needle = String(tag).toLowerCase().replace(/[._-]/g, " ");
        return queryLower.includes(needle) || needle.split(" ").some((part) => part.length > 3 && queryLower.includes(part));
      });
      if (hit) return "goal-build";
    }

    // Persona set but no learned topics → prefer onboarding for vague queries
    if ((persona || lsPersona) && lsTopicsLearned.length === 0 && query.length <= 40) {
      return "onboarding";
    }

    // Persona + query but no strong signals → onboarding
    if (persona) return "onboarding";

    // Fallback for long queries without indicators
    if (query.length > 10) return "problem-first";
  }

  if (persona || lsPersona) return "onboarding";
  return "unknown";
}

module.exports = { detectMode, PROBLEM_INDICATORS, GOAL_BUILD_INDICATORS };
