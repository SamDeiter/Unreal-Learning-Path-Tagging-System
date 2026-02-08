/**
 * run_eval.js — Evaluate tag matching quality against golden queries.
 *
 * Loads the tag graph, runs each golden query through extractTagsFromText,
 * and computes Precision, Recall, and F1 per query and overall.
 *
 * Usage:
 *   node eval/run_eval.js                     (runs eval, prints report)
 *   node eval/run_eval.js --json              (writes eval/report.json)
 *
 * Exits 0 if F1 >= threshold (default 0.3), else 1.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const GOLDEN_PATH = path.join(__dirname, "golden_queries.json");
const REPORT_PATH = path.join(__dirname, "report.json");

// Tag data paths
const TAGS_PATH = path.join(ROOT, "tags", "tags.json");

// ---- Lightweight tag extraction (mirrors TagGraphService.extractTagsFromText) ----

/**
 * Build a search index from tags data.
 * @param {Object} tagsData
 * @returns {Map<string, string>} lowercase trigger → tag_id
 */
function buildSearchIndex(tagsData) {
  const index = new Map();
  for (const tag of tagsData.tags) {
    // display_name
    index.set(tag.display_name.toLowerCase(), tag.tag_id);

    // synonyms
    if (tag.synonyms) {
      for (const syn of tag.synonyms) {
        index.set(syn.toLowerCase(), tag.tag_id);
      }
    }

    // aliases
    if (tag.aliases) {
      for (const alias of tag.aliases) {
        index.set(alias.value.toLowerCase(), tag.tag_id);
      }
    }

    // ui_terms from signals
    if (tag.signals?.ui_terms) {
      for (const term of tag.signals.ui_terms) {
        index.set(term.toLowerCase(), tag.tag_id);
      }
    }

    // error_signatures from signals
    if (tag.signals?.error_signatures) {
      for (const sig of tag.signals.error_signatures) {
        index.set(sig.toLowerCase(), tag.tag_id);
      }
    }
  }
  return index;
}

/**
 * Extract matched tag_ids from a natural-language query.
 * @param {string} query
 * @param {Map<string, string>} searchIndex
 * @returns {string[]} matched tag_ids
 */
function extractTags(query, searchIndex) {
  const queryLower = query.toLowerCase();
  const matched = new Set();

  for (const [trigger, tagId] of searchIndex) {
    if (queryLower.includes(trigger)) {
      matched.add(tagId);
    }
  }

  return [...matched];
}

// ---- Metrics ----

/**
 * Compute precision, recall, F1 for a single query.
 * @param {string[]} predicted - Tag IDs returned by the matcher
 * @param {string[]} expected - Tag IDs from golden query
 * @returns {{ precision: number, recall: number, f1: number }}
 */
function computeMetrics(predicted, expected) {
  if (expected.length === 0 && predicted.length === 0) {
    return { precision: 1, recall: 1, f1: 1 };
  }
  if (predicted.length === 0) {
    return { precision: 0, recall: 0, f1: 0 };
  }

  const expectedSet = new Set(expected);
  const truePositives = predicted.filter((p) => expectedSet.has(p)).length;

  const precision = truePositives / predicted.length;
  const recall = truePositives / expected.length;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    precision: Math.round(precision * 1000) / 1000,
    recall: Math.round(recall * 1000) / 1000,
    f1: Math.round(f1 * 1000) / 1000,
  };
}

// ---- Main ----

function runEval() {
  // Load data
  const tagsData = JSON.parse(fs.readFileSync(TAGS_PATH, "utf-8"));
  const goldenData = JSON.parse(fs.readFileSync(GOLDEN_PATH, "utf-8"));
  const searchIndex = buildSearchIndex(tagsData);

  const results = [];
  let totalP = 0,
    totalR = 0,
    totalF1 = 0;

  for (const gq of goldenData.queries) {
    const predicted = extractTags(gq.query, searchIndex);
    const metrics = computeMetrics(predicted, gq.expected_tags);

    results.push({
      id: gq.id,
      query: gq.query,
      difficulty: gq.difficulty,
      expected: gq.expected_tags,
      predicted,
      ...metrics,
    });

    totalP += metrics.precision;
    totalR += metrics.recall;
    totalF1 += metrics.f1;
  }

  const n = goldenData.queries.length;
  const summary = {
    total_queries: n,
    avg_precision: Math.round((totalP / n) * 1000) / 1000,
    avg_recall: Math.round((totalR / n) * 1000) / 1000,
    avg_f1: Math.round((totalF1 / n) * 1000) / 1000,
    timestamp: new Date().toISOString(),
  };

  return { summary, results };
}

// ---- CLI ----
if (require.main === module) {
  console.log("📊 Running tag matching evaluation...\n");

  const report = runEval();
  const F1_THRESHOLD = 0.3;

  // Print per-query results
  console.log("Query Results:");
  console.log("─".repeat(90));
  for (const r of report.results) {
    const status = r.f1 >= 0.5 ? "✅" : r.f1 > 0 ? "🟡" : "❌";
    const predicted = r.predicted.length > 0 ? r.predicted.join(", ") : "(none)";
    console.log(`${status} [${r.id}] "${r.query}"`);
    console.log(`   Expected:  ${r.expected.join(", ")}`);
    console.log(`   Predicted: ${predicted}`);
    console.log(`   P=${r.precision}  R=${r.recall}  F1=${r.f1}`);
    console.log("");
  }

  // Print summary
  console.log("─".repeat(90));
  console.log(`\n📈 Summary (${report.summary.total_queries} queries):`);
  console.log(`   Avg Precision: ${report.summary.avg_precision}`);
  console.log(`   Avg Recall:    ${report.summary.avg_recall}`);
  console.log(`   Avg F1:        ${report.summary.avg_f1}`);
  console.log(`   Threshold:     ${F1_THRESHOLD}`);
  console.log(
    `   Result:        ${report.summary.avg_f1 >= F1_THRESHOLD ? "✅ PASS" : "❌ FAIL"}\n`
  );

  // Write JSON report if --json flag
  if (process.argv.includes("--json")) {
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`📄 Report written to eval/report.json\n`);
  }

  process.exit(report.summary.avg_f1 >= F1_THRESHOLD ? 0 : 1);
}

module.exports = { runEval, extractTags, buildSearchIndex, computeMetrics };
