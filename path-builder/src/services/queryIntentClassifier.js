/**
 * queryIntentClassifier.js — Rule-based query intent classification for search tuning.
 *
 * Classifies queries into three intents to adjust search weights:
 * - troubleshooting: user has a specific problem to fix
 * - learning: user wants to understand a topic or build something
 * - exploring: user is browsing or asking broad questions
 *
 * Runs in <1ms (no LLM call). Confidence < 0.5 means "use default weights."
 */

const TROUBLESHOOTING_SIGNALS = [
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
  "fix",
  "debug",
  "null",
  "access violation",
  "flicker",
  "artifact",
  "won't compile",
  "compile error",
  "packaging fail",
  "low fps",
  "performance drop",
  "stuttering",
  "hitching",
  "lag",
  "freeze",
  "black screen",
  "missing",
  "disappear",
  "z-fighting",
  "shadow acne",
  "light leak",
  "blurry",
  "pop-in",
];

const LEARNING_SIGNALS = [
  "how to",
  "how do",
  "tutorial",
  "guide",
  "best practice",
  "workflow",
  "learn",
  "understand",
  "setup",
  "set up",
  "configure",
  "implement",
  "create",
  "build",
  "make",
  "add",
  "enable",
  "getting started",
  "introduction",
  "basics",
  "step by step",
  "walkthrough",
];

const EXPLORING_SIGNALS = [
  "what is",
  "what are",
  "difference between",
  "compare",
  "vs",
  "overview",
  "explain",
  "features of",
  "capabilities",
  "options for",
  "types of",
  "alternatives",
  "pros and cons",
  "when to use",
  "should i use",
];

/**
 * Classify query intent for search parameter tuning.
 *
 * @param {string} query - The user's raw search query
 * @returns {{ intent: "troubleshooting"|"learning"|"exploring", confidence: number, signals: string[] }}
 */
export function classifyQueryIntent(query) {
  if (!query || typeof query !== "string") {
    return { intent: "exploring", confidence: 0, signals: [] };
  }

  const q = query.toLowerCase().trim();

  const troubleshootingMatches = TROUBLESHOOTING_SIGNALS.filter((s) => q.includes(s));
  const learningMatches = LEARNING_SIGNALS.filter((s) => q.includes(s));
  const exploringMatches = EXPLORING_SIGNALS.filter((s) => q.includes(s));

  // Score each intent — longer signal phrases get double weight
  const score = (matches) =>
    matches.reduce((sum, m) => sum + (m.includes(" ") ? 2 : 1), 0);

  const tScore = score(troubleshootingMatches);
  const lScore = score(learningMatches);
  const eScore = score(exploringMatches);

  const maxScore = Math.max(tScore, lScore, eScore);

  // No signals matched — classify by query structure
  if (maxScore === 0) {
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    // Very short queries (1-2 meaningful words) are exploratory
    if (words.length <= 2) {
      return { intent: "exploring", confidence: 0.4, signals: ["short_query"] };
    }
    // Longer queries without clear signals default to exploring
    return { intent: "exploring", confidence: 0.3, signals: ["no_signal"] };
  }

  // Troubleshooting wins over learning if both match (user has a problem)
  if (tScore >= lScore && tScore >= eScore) {
    const confidence = Math.min(1.0, 0.4 + tScore * 0.15);
    return { intent: "troubleshooting", confidence, signals: troubleshootingMatches };
  }

  if (lScore >= eScore) {
    const confidence = Math.min(1.0, 0.4 + lScore * 0.15);
    return { intent: "learning", confidence, signals: learningMatches };
  }

  const confidence = Math.min(1.0, 0.4 + eScore * 0.15);
  return { intent: "exploring", confidence, signals: exploringMatches };
}

export default { classifyQueryIntent };
