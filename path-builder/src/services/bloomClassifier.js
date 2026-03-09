/**
 * bloomClassifier.js — Bloom's Taxonomy Cognitive Level Classifier
 *
 * Classifies course segments into Bloom's levels using keyword heuristics.
 * Used to filter content by skill level:
 *   Beginner    → remember + understand + apply
 *   Intermediate → understand + apply + analyze
 *   Advanced    → analyze + evaluate + create
 */

// ── Bloom's Taxonomy Levels (ordered low → high) ────────────────────

export const BLOOM_LEVELS = [
  "remember", // Recall facts: "What is a Blueprint?"
  "understand", // Explain concepts: "How does Nanite work?"
  "apply", // Use in context: "Create a material using Nanite"
  "analyze", // Break down: "Compare Nanite vs traditional LODs"
  "evaluate", // Judge: "When should you NOT use Nanite?"
  "create", // Build new: "Design a custom LOD pipeline"
];

// ── Keyword Heuristics ──────────────────────────────────────────────

const LEVEL_PATTERNS = {
  remember: [
    /\bwhat is\b/i,
    /\bdefine\b/i,
    /\blist\b/i,
    /\bidentify\b/i,
    /\bintroduction\b/i,
    /\boverview\b/i,
    /\bbasics?\b/i,
    /\bfundamentals?\b/i,
    /\bgetting started\b/i,
    /\brecall\b/i,
  ],
  understand: [
    /\bhow does\b/i,
    /\bexplain\b/i,
    /\bdescribe\b/i,
    /\bsummar/i,
    /\bunderstand/i,
    /\bconcepts?\b/i,
    /\btheory\b/i,
    /\bprinciples?\b/i,
    /\bwhy\b/i,
    /\bmeaning\b/i,
  ],
  apply: [
    /\bhow to\b/i,
    /\bstep[- ]by[- ]step\b/i,
    /\btutorial\b/i,
    /\bimplement/i,
    /\buse\b/i,
    /\bapply/i,
    /\bsetup?\b/i,
    /\bset up\b/i,
    /\bcreate a\b/i,
    /\bbuild a\b/i,
    /\bmake a\b/i,
    /\bworkflow\b/i,
  ],
  analyze: [
    /\bcompare?\b/i,
    /\bvs\.?\b/i,
    /\bdifference\b/i,
    /\banalyz/i,
    /\bbreak ?down\b/i,
    /\binspect\b/i,
    /\bdebug/i,
    /\btroubleshoot/i,
    /\bwhen to use\b/i,
    /\btrade[- ]?offs?\b/i,
  ],
  evaluate: [
    /\bbest practice/i,
    /\boptimiz/i,
    /\bperformance\b/i,
    /\bbenchmark/i,
    /\breview\b/i,
    /\bshould you\b/i,
    /\bpros?\b.*\bcons?\b/i,
    /\bcritique\b/i,
    /\bjudge\b/i,
    /\bchoose\b/i,
  ],
  create: [
    /\bdesign\b/i,
    /\barchitect/i,
    /\bfrom scratch\b/i,
    /\bcustom\b/i,
    /\badvanced\b/i,
    /\bmaster\b/i,
    /\bcomplex\b/i,
    /\bproject\b/i,
    /\bpipeline\b/i,
    /\bsystem\b/i,
  ],
};

// ── Skill Level → Allowed Bloom's Levels ───────────────────────────

const SKILL_BLOOM_MAP = {
  Beginner: ["remember", "understand", "apply"],
  Foundation: ["remember", "understand", "apply"],
  Intermediate: ["understand", "apply", "analyze"],
  Advanced: ["analyze", "evaluate", "create"],
};

// ── Classification ─────────────────────────────────────────────────

/**
 * Classify a segment/course by Bloom's Taxonomy level.
 *
 * @param {string} title — Course/segment title
 * @param {string} [snippet] — Optional transcript or summary text
 * @returns {{ level: string, confidence: number }}
 */
export function classifySegment(title, snippet = "") {
  const text = `${title} ${snippet}`.toLowerCase();
  const scores = {};

  for (const [level, patterns] of Object.entries(LEVEL_PATTERNS)) {
    let hits = 0;
    for (const pattern of patterns) {
      if (pattern.test(text)) hits++;
    }
    if (hits > 0) scores[level] = hits;
  }

  // Pick the highest-scoring level
  const entries = Object.entries(scores);
  if (entries.length === 0) {
    return { level: "apply", confidence: 0.3 }; // default fallback
  }

  entries.sort((a, b) => b[1] - a[1]);
  const [topLevel, topScore] = entries[0];
  const totalHits = entries.reduce((sum, [, s]) => sum + s, 0);
  const confidence = Math.min(topScore / Math.max(totalHits, 1), 1);

  return { level: topLevel, confidence: Math.round(confidence * 100) / 100 };
}

/**
 * Filter segments to only those appropriate for a given skill level.
 *
 * @param {Array} segments — Segments with title or transcript data
 * @param {string} skillLevel — "Beginner", "Intermediate", "Advanced"
 * @returns {Array} — Filtered segments with bloom metadata attached
 */
export function filterBySkillLevel(segments, skillLevel) {
  const allowed = new Set(SKILL_BLOOM_MAP[skillLevel] || SKILL_BLOOM_MAP.Intermediate);

  return segments
    .map((seg) => {
      const bloom = classifySegment(
        seg.title || "",
        seg.gemini_enriched?.one_sentence_summary || ""
      );
      return { ...seg, bloom };
    })
    .filter((seg) => allowed.has(seg.bloom.level));
}

/**
 * Get emoji + label for a Bloom's level (for UI badges).
 *
 * @param {string} level — Bloom's level string
 * @returns {{ emoji: string, label: string, color: string }}
 */
export function getBloomBadge(level) {
  const badges = {
    remember: { emoji: "📋", label: "Remember", color: "#58a6ff" },
    understand: { emoji: "💡", label: "Understand", color: "#3fb950" },
    apply: { emoji: "🔧", label: "Apply", color: "#d29922" },
    analyze: { emoji: "🔬", label: "Analyze", color: "#a371f7" },
    evaluate: { emoji: "⚖️", label: "Evaluate", color: "#f0883e" },
    create: { emoji: "🏗️", label: "Create", color: "#f85149" },
  };
  return badges[level] || badges.apply;
}
