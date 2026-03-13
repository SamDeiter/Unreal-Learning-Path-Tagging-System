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
 * Supports matching by course code, video title, OR course title (fuzzy).
 */

// ── In-memory cache ────────────────────────────────────────────────
const cache = new Map();
let summaryPromise = null;
let summaryData = null;

/**
 * Load the augmentation summary data once.
 * Returns { byCode, byTitle } for dual-path matching.
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
    summaryData = { byCode: new Map(), byTitle: new Map() };
    return summaryData;
  }

  // Index 1: courseCode → [{ key, title, courseTitle }, ...]
  const byCode = new Map();
  // Index 2: normalized courseTitle → { code, entries }  (for title-based matching)
  const byTitle = new Map();

  for (const v of raw.videos) {
    const code = v.course;       // e.g. "100.01"
    const ct = v.course_title;   // e.g. "Introduction to Unreal Engine"

    const entry = { key: v.key, title: v.title, courseTitle: ct };

    // By code
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(entry);

    // By normalized course title → course code (first match wins)
    const normCT = normalize(ct);
    if (normCT && !byTitle.has(normCT)) {
      byTitle.set(normCT, code);
    }
  }

  summaryData = { byCode, byTitle };
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
 * Tries multiple matching strategies in order:
 *   1. Direct course code match + video title match within course
 *   2. Step title fuzzy-match against course titles (when code is missing)
 *   3. Step title fuzzy-match against ALL video titles globally
 *
 * @param {Object} step — The step object
 * @param {number} idx — Step index (fallback)
 * @param {{ byCode: Map, byTitle: Map }} index — Summary index
 * @returns {string|null} — Augmentation key like "100_01/21_NiagaraEditor" or null
 */
function findAugKey(step, idx, index) {
  const { byCode, byTitle } = index;

  const courseCode = step.code || step.courseCode || step.segment?.courseCode || "";
  const videoTitle = step.segment?.videoTitle || step.videos?.[0]?.title || step.videos?.[0]?.name || "";
  const stepTitle = step.title || "";

  // ── Strategy 1: Direct course code lookup ──
  const dotCode = courseCode.replace(/_/g, ".");
  let entries = byCode.get(dotCode);

  if (entries?.length) {
    // Try exact video title match within course
    if (videoTitle) {
      const normVT = normalize(videoTitle);
      const exact = entries.find((e) => normalize(e.title) === normVT);
      if (exact) return exact.key;

      const fuzzy = entries.find(
        (e) => normalize(e.title).includes(normVT) || normVT.includes(normalize(e.title))
      );
      if (fuzzy) return fuzzy.key;
    }
    // No video match → return first video in course (best available)
    return entries[0].key;
  }

  // ── Strategy 2: Match step title against course titles ──
  if (stepTitle) {
    const normStep = normalize(stepTitle);

    // Try direct course title match
    for (const [normCT, code] of byTitle.entries()) {
      if (normCT === normStep || normCT.includes(normStep) || normStep.includes(normCT)) {
        entries = byCode.get(code);
        if (entries?.length) return entries[0].key;
      }
    }

    // Try partial word overlap (at least 3 significant words match)
    const stepWords = normStep.match(/.{3,}/g) || [];
    if (stepWords.length >= 2) {
      for (const [normCT, code] of byTitle.entries()) {
        const matchCount = stepWords.filter((w) => normCT.includes(w)).length;
        if (matchCount >= 2) {
          entries = byCode.get(code);
          if (entries?.length) return entries[0].key;
        }
      }
    }
  }

  // ── Strategy 3: Match step title against ALL video titles globally ──
  if (stepTitle) {
    const normStep = normalize(stepTitle);
    for (const [, courseEntries] of byCode.entries()) {
      for (const entry of courseEntries) {
        const normET = normalize(entry.title);
        if (normET.includes(normStep) || normStep.includes(normET)) {
          return entry.key;
        }
      }
    }
  }

  return null;
}

/**
 * Fetch a single augmentation JSON file.
 * Key format: "100_01/21_NiagaraEditor" → /augmentation_data/100_01/21_NiagaraEditor.json
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

  // 🔧 Key Concepts — from why_annotations (procedural step + why)
  if (aug.why_annotations?.length > 0) {
    result.whatToDo = aug.why_annotations.slice(0, 3).map((wa) => {
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

  return result;
}

/**
 * Batch-fetch augmentation content for an array of steps.
 * Returns a parallel array of augmentation field objects (or {} if not found).
 */
export async function fetchAugmentationsForSteps(steps) {
  const index = await loadSummaryIndex();
  if (!index.byCode.size) return steps.map(() => ({}));

  const promises = steps.map(async (step, i) => {
    const augKey = findAugKey(step, i, index);
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
