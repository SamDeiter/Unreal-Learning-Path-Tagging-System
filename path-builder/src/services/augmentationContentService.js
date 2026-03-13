/**
 * augmentationContentService.js — On-demand augmentation content fetcher.
 *
 * Loads per-video augmentation JSON from public/augmentation_data/{courseCode}/{video}.json
 * and transforms it into step-friendly fields that LessonCard already renders:
 *   - whyThisMatters  (from theory_breaks)
 *   - whatToDo         (from why_annotations → procedural steps with "why")
 *   - commonMistake    (from architectural_warnings)
 *   - takeaway         (from self_explanation_prompts)
 *   - prerequisites    (from missing_prerequisites)
 *
 * Uses augmentation_summary.json video keys for matching steps to files.
 */

// ── In-memory cache ────────────────────────────────────────────────
const cache = new Map();
let summaryPromise = null;
let summaryData = null;

/**
 * Load the augmentation summary (video key index) once.
 * Returns Map<dotCourseCode, Array<{ key, title }>>
 */
async function loadSummaryIndex() {
  if (summaryData) return summaryData;
  if (!summaryPromise) {
    summaryPromise = fetch(`${import.meta.env.BASE_URL}augmentation_summary.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  const raw = await summaryPromise;
  if (!raw?.videos) {
    summaryData = new Map();
    return summaryData;
  }

  // Group videos by course code → [{ key, title }, ...]
  const map = new Map();
  for (const v of raw.videos) {
    const code = v.course; // e.g. "100.01"
    if (!map.has(code)) map.set(code, []);
    map.get(code).push({ key: v.key, title: v.title });
  }
  summaryData = map;
  return summaryData;
}

/**
 * Normalize a string for fuzzy matching: lowercase, strip non-alnum.
 */
function normalize(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Find the best augmentation key for a step.
 *
 * @param {string} courseCode — Dot-separated code (e.g. "100.01") or underscore (e.g. "100_01")
 * @param {string} videoTitle — Video title from the step
 * @param {number} videoIndex — Index of the video in the course (fallback)
 * @param {Map} index — Summary index from loadSummaryIndex()
 * @returns {string|null} — Augmentation key like "100_01/21_NiagaraEditor" or null
 */
function findAugKey(courseCode, videoTitle, videoIndex, index) {
  // Normalize course code to dot format for index lookup
  const dotCode = (courseCode || "").replace(/_/g, ".");
  const entries = index.get(dotCode);
  if (!entries?.length) return null;

  // Try exact title match first
  if (videoTitle) {
    const normTitle = normalize(videoTitle);
    const exact = entries.find((e) => normalize(e.title) === normTitle);
    if (exact) return exact.key;

    // Fuzzy: title contains or is contained
    const fuzzy = entries.find(
      (e) => normalize(e.title).includes(normTitle) || normTitle.includes(normalize(e.title))
    );
    if (fuzzy) return fuzzy.key;
  }

  // Fallback: use video index
  if (typeof videoIndex === "number" && videoIndex >= 0 && videoIndex < entries.length) {
    return entries[videoIndex].key;
  }

  return null;
}

/**
 * Fetch a single augmentation JSON file.
 * Key format: "100_01/21_NiagaraEditor" → /augmentation_data/100_01/21_NiagaraEditor.json
 *
 * @param {string} augKey — e.g. "100_01/21_NiagaraEditor"
 * @returns {Promise<Object|null>}
 */
async function fetchAugFile(augKey) {
  if (cache.has(augKey)) return cache.get(augKey);

  const url = `${import.meta.env.BASE_URL}augmentation_data/${augKey}.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      cache.set(augKey, null);
      return null;
    }
    const data = await res.json();
    cache.set(augKey, data);
    return data;
  } catch {
    cache.set(augKey, null);
    return null;
  }
}

/**
 * Transform raw augmentation JSON into step-friendly fields.
 *
 * @param {Object} aug — Raw augmentation JSON
 * @returns {Object} — Fields ready to merge into a step
 */
function transformAugmentation(aug) {
  if (!aug) return {};

  const result = {};

  // 💡 Why This Matters — combine first 2 theory break concepts
  if (aug.theory_breaks?.length > 0) {
    result.whyThisMatters = aug.theory_breaks
      .slice(0, 2)
      .map((tb) => tb.concept)
      .join(" ");
  }

  // 🔧 Do This Now — from why_annotations (procedural step + why)
  if (aug.why_annotations?.length > 0) {
    result.whatToDo = aug.why_annotations.slice(0, 5).map((wa) => {
      const step = wa.procedural_step || "";
      const why = wa.why || "";
      return `${step}${why ? ` — ${why}` : ""}`;
    });
  }

  // ⚠️ Common Mistake — from architectural_warnings or antipattern_warnings
  const warnings = aug.architectural_warnings || [];
  if (warnings.length > 0) {
    result.commonMistake = typeof warnings[0] === "string"
      ? warnings[0]
      : warnings[0].warning || warnings[0].description || JSON.stringify(warnings[0]);
  } else {
    // Check why_annotations for antipattern_warnings
    const warnAnnotation = (aug.why_annotations || []).find((wa) => wa.antipattern_warning);
    if (warnAnnotation) {
      result.commonMistake = warnAnnotation.antipattern_warning;
    }
  }

  // 🎯 Key Takeaway — from first self_explanation_prompt
  if (aug.self_explanation_prompts?.length > 0) {
    const sep = aug.self_explanation_prompts[0];
    result.takeaway = `🤔 ${sep.prompt}${sep.expected_insight ? `\n\n💡 ${sep.expected_insight}` : ""}`;
  }

  // 📋 Prerequisites
  if (aug.missing_prerequisites?.length > 0) {
    result.prerequisites = aug.missing_prerequisites;
  }

  // Grade and score
  if (aug.evaluation_matrix_score) {
    result.augGrade = aug.evaluation_matrix_score.grade;
    result.augScore = aug.evaluation_matrix_score.total;
  }

  // Additional theory breaks beyond the first 2 (for "Go Deeper" or expandable sections)
  if (aug.theory_breaks?.length > 2) {
    result.additionalTheoryBreaks = aug.theory_breaks.slice(2).map((tb) => ({
      title: tb.title,
      concept: tb.concept,
      timestamp: tb.insert_after_timestamp,
    }));
  }

  return result;
}

/**
 * Batch-fetch augmentation content for an array of steps.
 *
 * Each step should have: { code, segment: { videoTitle }, videos: [...] }
 * Returns a parallel array of augmentation field objects (or {} if not found).
 *
 * @param {Array} steps — Path steps
 * @returns {Promise<Array<Object>>} — Augmentation fields per step
 */
export async function fetchAugmentationsForSteps(steps) {
  const index = await loadSummaryIndex();
  if (!index.size) return steps.map(() => ({}));

  const promises = steps.map(async (step, i) => {
    const courseCode = step.code || step.courseCode || step.segment?.courseCode || "";
    const videoTitle =
      step.segment?.videoTitle ||
      step.videos?.[0]?.title ||
      step.videos?.[0]?.name ||
      step.title ||
      "";
    const videoIndex = step.videoIndex ?? i;

    const augKey = findAugKey(courseCode, videoTitle, videoIndex, index);
    if (!augKey) return {};

    const augData = await fetchAugFile(augKey);
    return transformAugmentation(augData);
  });

  return Promise.all(promises);
}

/**
 * Clear the augmentation cache (useful for testing).
 */
export function clearAugmentationCache() {
  cache.clear();
  summaryData = null;
  summaryPromise = null;
}
