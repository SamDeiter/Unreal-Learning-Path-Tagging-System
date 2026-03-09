/**
 * cognitiveLoadEngine.js — Cognitive Load & Spaced Repetition Scheduler
 *
 * Applies Cognitive Load Theory (CLT) to sequence courses optimally:
 *   1. Estimates intrinsic load per course (topic complexity × bloom level)
 *   2. Interleaves high-load and low-load courses
 *   3. Inserts review/practice checkpoints using spaced repetition
 *
 * Reference: Sweller, J. (1988). Cognitive Load During Problem Solving.
 */

import { classifySegment } from "./bloomClassifier";

// ── Constants ──────────────────────────────────────────────────────

const BLOOM_WEIGHT = {
  remember: 1,
  understand: 2,
  apply: 3,
  analyze: 4,
  evaluate: 5,
  create: 6,
};

const MAX_CONSECUTIVE_HIGH_LOAD = 2;
const HIGH_LOAD_THRESHOLD = 4;

// ── Load Estimation ────────────────────────────────────────────────

/**
 * Estimate cognitive load for a course (1-10 scale).
 *
 * @param {Object} course — Course object
 * @returns {{ load: number, factors: Object }}
 */
export function estimateCognitiveLoad(course) {
  const bloom = classifySegment(
    course.title || "",
    course.gemini_enriched?.one_sentence_summary || ""
  );
  const bloomLoad = BLOOM_WEIGHT[bloom.level] || 3;

  // Factor: video count increases extraneous load
  const videoCount = course.videos?.length || 1;
  const videoFactor = Math.min(videoCount / 5, 1.5);

  // Factor: duration > 2h increases load
  const duration = course.duration || 0.5;
  const durationFactor = Math.min(duration / 2, 1.5);

  // Factor: level tag
  const levelMultiplier = {
    Beginner: 0.7,
    Foundation: 0.7,
    Intermediate: 1.0,
    Advanced: 1.4,
  };
  const levelFactor = levelMultiplier[course.tags?.level] || 1.0;

  const rawLoad = bloomLoad * levelFactor * (0.5 + 0.25 * videoFactor + 0.25 * durationFactor);
  const load = Math.min(Math.round(rawLoad * 10) / 10, 10);

  return {
    load,
    factors: {
      bloomLevel: bloom.level,
      bloomLoad,
      videoFactor: Math.round(videoFactor * 100) / 100,
      durationFactor: Math.round(durationFactor * 100) / 100,
      levelFactor,
    },
  };
}

// ── Interleaving ───────────────────────────────────────────────────

/**
 * Interleave courses to avoid consecutive high-load sessions.
 * Preserves relative order but moves low-load courses between
 * high-load clusters.
 *
 * @param {Array} courses — Pre-sorted courses (e.g., from topoSort)
 * @returns {Array} — Reordered courses with load annotations
 */
export function interleaveCourses(courses) {
  if (courses.length <= 2) {
    return courses.map((c) => ({
      ...c,
      cognitiveLoad: estimateCognitiveLoad(c),
    }));
  }

  // Annotate all courses with load
  const annotated = courses.map((c) => ({
    ...c,
    cognitiveLoad: estimateCognitiveLoad(c),
  }));

  const high = annotated.filter((c) => c.cognitiveLoad.load >= HIGH_LOAD_THRESHOLD);
  const low = annotated.filter((c) => c.cognitiveLoad.load < HIGH_LOAD_THRESHOLD);

  // Interleave: max 2 high-load in a row, then insert a low-load
  const result = [];
  let highIdx = 0;
  let lowIdx = 0;
  let consecutiveHigh = 0;

  while (highIdx < high.length || lowIdx < low.length) {
    if (consecutiveHigh >= MAX_CONSECUTIVE_HIGH_LOAD && lowIdx < low.length) {
      result.push(low[lowIdx++]);
      consecutiveHigh = 0;
    } else if (highIdx < high.length) {
      result.push(high[highIdx++]);
      consecutiveHigh++;
    } else if (lowIdx < low.length) {
      result.push(low[lowIdx++]);
      consecutiveHigh = 0;
    }
  }

  return result;
}

// ── Spaced Repetition Checkpoints ──────────────────────────────────

/**
 * Insert review checkpoints into the course sequence.
 * Uses a simplified spaced repetition schedule:
 *   - After every 3-4 courses, insert a review of earlier material
 *   - Reviews cover the last N courses with highest load
 *
 * @param {Array} courses — Ordered course list
 * @param {Object} [opts] — Options
 * @param {number} [opts.reviewInterval=3] — Courses between reviews
 * @returns {Array} — Courses with review checkpoints interspersed
 */
export function insertReviewCheckpoints(courses, opts = {}) {
  const interval = opts.reviewInterval || 3;
  if (courses.length <= interval) return [...courses];

  const result = [];
  const covered = [];

  courses.forEach((course, idx) => {
    result.push(course);
    covered.push(course);

    // Insert checkpoint after every `interval` courses
    if ((idx + 1) % interval === 0 && idx < courses.length - 1) {
      const reviewTargets = covered
        .slice(-interval)
        .sort((a, b) => {
          const loadA = a.cognitiveLoad?.load || estimateCognitiveLoad(a).load;
          const loadB = b.cognitiveLoad?.load || estimateCognitiveLoad(b).load;
          return loadB - loadA;
        })
        .slice(0, 2);

      result.push({
        type: "review_checkpoint",
        reviewIndex: Math.floor((idx + 1) / interval),
        topics: reviewTargets.map((c) => c.title || c.code),
        suggestion: `Review: ${reviewTargets.map((c) => c.title).join(" + ")}`,
      });
    }
  });

  return result;
}

// ── Summary ────────────────────────────────────────────────────────

/**
 * Generate a cognitive load summary for the entire path.
 *
 * @param {Array} courses — Courses with load annotations
 * @returns {Object} — Summary stats
 */
export function getLoadSummary(courses) {
  const loads = courses
    .filter((c) => c.type !== "review_checkpoint")
    .map((c) => c.cognitiveLoad?.load || estimateCognitiveLoad(c).load);

  if (loads.length === 0) return { avg: 0, max: 0, min: 0, distribution: {} };

  const avg = Math.round((loads.reduce((s, l) => s + l, 0) / loads.length) * 10) / 10;
  const max = Math.max(...loads);
  const min = Math.min(...loads);

  // Distribution buckets
  const distribution = { low: 0, medium: 0, high: 0 };
  loads.forEach((l) => {
    if (l < 3) distribution.low++;
    else if (l < HIGH_LOAD_THRESHOLD) distribution.medium++;
    else distribution.high++;
  });

  return { avg, max, min, distribution, totalCourses: loads.length };
}
