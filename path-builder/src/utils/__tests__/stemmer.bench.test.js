import { describe, it, expect, beforeAll } from "vitest";
import { getDocsForTopic } from "../../services/docsSearchService";
import docLinksData from "../../data/doc_links.json";

// --- Original Uncached Stem Match ---
function originalStem(word) {
  return word
    .replace(/ies$/i, "y")
    .replace(/ves$/i, "f")
    .replace(/(s|es|ing|ed|tion|ment)$/i, "")
    .toLowerCase();
}

function originalStemMatch(a, b) {
  const aStems = a.split(/[\s_-]+/).filter(w => w.length > 2).map(originalStem);
  const bStems = b.split(/[\s_-]+/).filter(w => w.length > 2).map(originalStem);
  return aStems.some(as => bStems.some(bs => as === bs || as.includes(bs) || bs.includes(as)));
}

const TIER_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };

async function originalGetDocsForTopic(topics, { maxTier = "advanced", limit = 10 } = {}) {
  if (!topics?.length) return [];

  const maxTierOrder = TIER_ORDER[maxTier] ?? 2;
  const topicSet = topics.map((t) => t.toLowerCase());
  const results = [];

  for (const [key, doc] of Object.entries(docLinksData)) {
    const tierOrder = TIER_ORDER[doc.tier] ?? 1;
    if (tierOrder > maxTierOrder) continue;

    let score = 0;
    const keyLower = key.toLowerCase().replace(/[-_]/g, " ");
    const labelLower = (doc.label || "").toLowerCase();
    const urlSlug = (doc.url || "").split("/").pop().replace(/-/g, " ").toLowerCase();
    const docTags = (doc.tags || []).map((t) => t.toLowerCase());
    const descLower = (doc.description || "").toLowerCase();

    let matchedTopicCount = 0;
    for (const topic of topicSet) {
      let matched = false;
      if (keyLower === topic) {
        score += 15;
        matched = true;
      } else if (keyLower.includes(topic)) {
        score += 8;
        matched = true;
      } else if (topic.includes(keyLower)) {
        score += 6;
        matched = true;
      } else if (doc.subsystem === topic) {
        score += 5;
        matched = true;
      } else if (labelLower.includes(topic)) {
        score += 6;
        matched = true;
      } else if (docTags.includes(topic)) {
        score += 2;
        matched = true;
      } else if (docTags.some((t) => t.includes(topic) || topic.includes(t))) {
        score += 1;
        matched = true;
      } else if (urlSlug.includes(topic)) {
        score += 2;
        matched = true;
      } else if (descLower.includes(topic)) {
        score += 1;
        matched = true;
      }
      // Stem fallbacks (Uncached)
      else if (originalStemMatch(topic, keyLower)) {
        score += 4;
        matched = true;
      } else if (originalStemMatch(topic, labelLower)) {
        score += 3;
        matched = true;
      } else if (docTags.some((t) => originalStemMatch(topic, t))) {
        score += 1;
        matched = true;
      } else if (originalStemMatch(topic, descLower)) {
        score += 1;
        matched = true;
      }
      if (matched) matchedTopicCount++;
    }

    if (matchedTopicCount >= 2) score += matchedTopicCount * 5;

    if (score >= 3) {
      results.push({
        key,
        label: doc.label,
        _score: score,
      });
    }
  }

  results.sort((a, b) => b._score - a._score);
  return results.slice(0, limit);
}

describe("stemmer and docsSearchService performance benchmark", () => {
  beforeAll(() => {
    globalThis.fetch = async (url) => {
      if (url.endsWith("doc_links.json")) {
        return {
          ok: true,
          json: async () => docLinksData,
        };
      }
      return { ok: false, status: 404 };
    };
  });

  it("compares unoptimized vs optimized getDocsForTopic search speeds", async () => {
    const iterations = 15;
    const query = ['lumen', 'lighting', 'mesh', 'performance'];

    // Warm-up
    await originalGetDocsForTopic(query);
    await getDocsForTopic(query);

    // Run Unoptimized
    const startUnoptimized = performance.now();
    for (let i = 0; i < iterations; i++) {
      await originalGetDocsForTopic(query);
    }
    const durationUnoptimized = performance.now() - startUnoptimized;

    // Run Optimized
    const startOptimized = performance.now();
    for (let i = 0; i < iterations; i++) {
      await getDocsForTopic(query);
    }
    const durationOptimized = performance.now() - startOptimized;

    const meanUnoptimized = durationUnoptimized / iterations;
    const meanOptimized = durationOptimized / iterations;
    const speedup = durationUnoptimized / durationOptimized;

    console.log(`\n==================================================`);
    console.log(`BENCHMARK RESULTS (over ${iterations} iterations):`);
    console.log(`Unoptimized : ${durationUnoptimized.toFixed(2)}ms (mean: ${meanUnoptimized.toFixed(2)}ms per search)`);
    console.log(`Optimized   : ${durationOptimized.toFixed(2)}ms (mean: ${meanOptimized.toFixed(2)}ms per search)`);
    console.log(`Speedup     : ${speedup.toFixed(2)}x faster!`);
    console.log(`==================================================\n`);

    expect(speedup).toBeGreaterThan(1.0); // Must be faster!
  }, 20000);
});
