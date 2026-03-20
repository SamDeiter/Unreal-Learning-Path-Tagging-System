/**
 * scrape-demand-intel.js — Scheduled Demand Intelligence Scraper
 *
 * Runs as a GitHub Action (daily) to pre-compute demand intelligence data
 * and store it in Firestore for instant frontend reads.
 *
 * Architecture:
 *   1. Load demand_benchmarks.json for category taxonomy
 *   2. Call Gemini REST API with grounded search for trending questions
 *   3. Call Gemini REST API for community pain points (batched)
 *   4. Load video_library_enriched.json for coverage analysis
 *   5. Build ranked suggestions report
 *   6. Write to Firestore: demand_intel/latest + demand_intel/history/{date}
 *
 * Required env vars:
 *   GEMINI_API_KEY           — Google AI Studio API key
 *   FIREBASE_SERVICE_ACCOUNT — Base64-encoded Firebase service account JSON
 *
 * Usage:
 *   node scripts/scrape-demand-intel.js
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// ── Paths ──────────────────────────────────────────────────────────
const BENCHMARKS_PATH = path.join(
  __dirname,
  "../path-builder/src/data/demand_benchmarks.json"
);
const VIDEO_LIBRARY_PATH = path.join(
  __dirname,
  "../path-builder/src/data/video_library_enriched.json"
);

// ── Config ─────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FIREBASE_SA_B64 = process.env.FIREBASE_SERVICE_ACCOUNT;

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const BATCH_SIZE = 3; // Concurrent Gemini calls
const TRENDING_LIMIT = 15;
const PAIN_POINT_LIMIT = 5;
const RATE_LIMIT_DELAY_MS = 1500;

// ── Firebase Init ──────────────────────────────────────────────────

function initFirestore() {
  if (!FIREBASE_SA_B64) {
    console.warn("⚠️  FIREBASE_SERVICE_ACCOUNT not set — will skip Firestore write");
    return null;
  }

  try {
    const serviceAccount = JSON.parse(
      Buffer.from(FIREBASE_SA_B64, "base64").toString("utf-8")
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    return admin.firestore();
  } catch (err) {
    console.error("❌ Failed to init Firebase:", err.message);
    return null;
  }
}

// ── Gemini REST API ────────────────────────────────────────────────

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4096,
    },
    // Enable grounded search for real community data
    tools: [{ googleSearch: {} }],
  };

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const groundingMetadata =
    data.candidates?.[0]?.groundingMetadata || null;

  return { text, groundingMetadata };
}

function parseJSON(text) {
  // Strip markdown fences if present
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try extracting JSON array from the response
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ── Scraping Functions ─────────────────────────────────────────────

async function scrapeTrendingQuestions(categories) {
  console.log(`\n🔍 Scraping trending questions across ${categories.length} categories...`);

  const prompt = `Search for the most commonly asked questions about Unreal Engine 5 that learners are posting RIGHT NOW.

SEARCH THESE SOURCES (in priority order):
1. Reddit r/unrealengine — recent posts with high engagement
2. forums.unrealengine.com — Epic's official forums
3. stackoverflow.com [unreal-engine5] tag — recent questions
4. Epic Developer Community — dev.epicgames.com discussions
5. YouTube comments on popular UE5 tutorials

Cover ALL major Unreal Engine 5 topic areas including: ${categories.join(", ")}

Return a JSON array of the top ${TRENDING_LIMIT} trending questions. For EACH question, include the ACTUAL source URL where you found it:

[{
  "question": "The exact question people are asking",
  "category": "Which UE5 system this relates to",
  "subtopic": "Specific subtopic",
  "frequency": "high" or "medium" or "low",
  "sources": [{
    "type": "reddit" or "epic_forum" or "stackoverflow" or "youtube",
    "title": "Title of the post/thread",
    "url": "URL if available",
    "date": "Approximate date (YYYY-MM-DD if known)",
    "engagement": "Number of upvotes, comments, or views if available"
  }]
}]

RULES:
- Return REAL questions from REAL posts — do not fabricate
- Include the post/thread title so we can verify
- Prioritize questions with high engagement
- Focus on learning/tutorial questions, not bug reports
- Return valid JSON only, no markdown fences`;

  try {
    const result = await callGemini(prompt);
    const parsed = parseJSON(result.text);

    if (!parsed || !Array.isArray(parsed)) {
      console.warn("  ⚠️ Failed to parse trending questions");
      return [];
    }

    const questions = parsed.slice(0, TRENDING_LIMIT).map((q) => ({
      question: q.question || "",
      category: q.category || "General",
      subtopic: q.subtopic || "",
      frequency: q.frequency || "medium",
      sources: (q.sources || []).map((src) => ({
        type: src.type || "unknown",
        url: src.url || "",
        title: src.title || "",
        date: src.date || "",
        engagement: src.engagement || "",
      })),
    }));

    console.log(`  ✅ Found ${questions.length} trending questions`);
    return questions;
  } catch (err) {
    console.error(`  ❌ Trending questions failed: ${err.message}`);
    return [];
  }
}

async function scrapePainPoints(category) {
  const prompt = `Search for the most common struggles, confusion points, and pain points that Unreal Engine 5 learners experience with: "${category}"

SEARCH PRIORITY:
1. forums.unrealengine.com (Epic's official forums)
2. Reddit r/unrealengine
3. Epic Developer Community
4. YouTube comments on UE5 tutorials

Return a JSON array of the top ${PAIN_POINT_LIMIT} pain points:
[{
  "painPoint": "One-sentence description of the struggle",
  "sourceUrl": "URL where this was found (if available)",
  "sourceTitle": "Title of the post/thread",
  "relevance": "high" or "medium" or "low"
}]

RULES:
- Focus on LEARNER confusion, not engine bugs
- Prioritize problems that affect beginners and intermediates
- Each pain point should be specific and actionable
- Return valid JSON only, no markdown fences`;

  try {
    const result = await callGemini(prompt);
    const parsed = parseJSON(result.text);

    if (!parsed || !Array.isArray(parsed)) return [];

    return parsed.slice(0, PAIN_POINT_LIMIT).map((pp) => ({
      painPoint: pp.painPoint || pp.pain_point || "",
      sourceUrl: pp.sourceUrl || pp.source_url || "",
      sourceTitle: pp.sourceTitle || pp.source_title || "",
      relevance: pp.relevance || "medium",
    }));
  } catch (err) {
    console.warn(`  ⚠️ Pain points for "${category}" failed: ${err.message}`);
    return [];
  }
}

async function scrapeAllPainPoints(categories) {
  console.log(`\n💬 Scraping pain points for ${categories.length} categories (batches of ${BATCH_SIZE})...`);

  const results = {};

  for (let i = 0; i < categories.length; i += BATCH_SIZE) {
    const batch = categories.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(categories.length / BATCH_SIZE);
    console.log(`  📦 Batch ${batchNum}/${totalBatches}: ${batch.join(", ")}`);

    const batchResults = await Promise.allSettled(
      batch.map((cat) => scrapePainPoints(cat))
    );

    batch.forEach((cat, idx) => {
      const result = batchResults[idx];
      results[cat] = result.status === "fulfilled" ? result.value : [];
    });

    // Rate limit between batches
    if (i + BATCH_SIZE < categories.length) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
    }
  }

  const totalPainPoints = Object.values(results).flat().length;
  console.log(`  ✅ Found ${totalPainPoints} pain points across ${categories.length} categories`);
  return results;
}

// ── Coverage Analysis (same logic as frontend) ────────────────────

function calculateCoverage(courses, taxonomy) {
  const coverage = {};
  const FULL_COVERAGE_THRESHOLD = 15;

  for (const [category, subtopics] of Object.entries(taxonomy)) {
    coverage[category] = {};

    for (const subtopic of subtopics) {
      const keywords = subtopic
        .toLowerCase()
        .replace(/[()]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 2);

      let matchCount = 0;
      for (const course of courses) {
        const allTags = [
          ...(course.gemini_system_tags || []),
          ...(course.ai_tags || []),
          ...(course.transcript_tags || []),
          ...Object.values(course.tags || {}).filter((v) => typeof v === "string"),
          course.title || "",
        ].map((t) => t.toLowerCase());

        const tagText = allTags.join(" ");

        const matched =
          keywords.length > 1
            ? keywords.every((kw) => tagText.includes(kw))
            : keywords.some((kw) => tagText.includes(kw));
        if (matched) matchCount++;
      }

      coverage[category][subtopic] = {
        coverage: matchCount === 0
          ? 0
          : Math.min(100, Math.round((matchCount / FULL_COVERAGE_THRESHOLD) * 100)),
        courseCount: matchCount,
      };
    }
  }

  return coverage;
}

// ── Build Full Report ──────────────────────────────────────────────

function buildReport({
  demandData,
  trendingQuestions,
  painPointsByCategory,
  coverageData,
  taxonomy,
  benchmarks,
  startTime,
}) {
  const suggestions = [];

  for (const [category, data] of Object.entries(demandData)) {
    for (const [subtopic, demandScore] of Object.entries(data.subtopics)) {
      const coverageInfo = coverageData[category]?.[subtopic] || {
        coverage: 0,
        courseCount: 0,
      };
      const gap = demandScore - coverageInfo.coverage;

      const sources = [];

      // Community Activity Index source
      sources.push({
        type: "community_index",
        url: "",
        title: `Community Activity Index: "${subtopic}"`,
        interestScore: demandScore,
        trend: demandScore > (data.overall || 50) ? "rising" : "stable",
      });

      // Trending question sources
      const relatedQuestions = trendingQuestions.filter(
        (q) =>
          q.category?.toLowerCase() === category.toLowerCase() ||
          q.subtopic?.toLowerCase().includes(subtopic.toLowerCase()) ||
          subtopic.toLowerCase().includes(q.subtopic?.toLowerCase() || "___")
      );
      for (const q of relatedQuestions) {
        for (const src of q.sources || []) {
          sources.push({ ...src, relatedQuestion: q.question });
        }
      }

      // Pain point sources
      const categoryPainPoints = painPointsByCategory[category] || [];
      const relatedPainPoints = categoryPainPoints.filter((pp) =>
        pp.painPoint?.toLowerCase().includes(subtopic.split(" ")[0].toLowerCase())
      );
      for (const pp of relatedPainPoints) {
        sources.push({
          type: pp.sourceUrl?.includes("reddit")
            ? "reddit"
            : pp.sourceUrl?.includes("forum")
              ? "epic_forum"
              : "epic_dev_community",
          url: pp.sourceUrl || "",
          title: pp.sourceTitle || pp.painPoint || "",
          painPoint: pp.painPoint,
        });
      }

      const verifiedSourceCount = sources.filter(
        (s) => s.type !== "community_index" && s.url
      ).length;
      const confidence =
        verifiedSourceCount >= 3
          ? "high"
          : verifiedSourceCount >= 1
            ? "medium"
            : "low";

      if (gap > 0 || sources.length > 0) {
        suggestions.push({
          topic: subtopic,
          category,
          demandScore,
          coverageInLibrary: coverageInfo.coverage,
          courseCount: coverageInfo.courseCount,
          gap: Math.max(0, gap),
          confidence,
          sourceCount: sources.length,
          rankScore:
            demandScore * Math.max(1, verifiedSourceCount + 1) -
            coverageInfo.coverage,
          sources,
        });
      }
    }
  }

  suggestions.sort((a, b) => b.rankScore - a.rankScore);

  return {
    generatedAt: new Date().toISOString(),
    generationTimeMs: Date.now() - startTime,
    scrapedBy: "github-action",
    provenance: {
      communityIndex: {
        version: benchmarks.version || "unknown",
        source: benchmarks.source || "manual",
        methodology: benchmarks.methodology || "",
        subtopicCount: Object.values(taxonomy).flat().length,
      },
      communitySearch: {
        categoriesScanned: Object.keys(painPointsByCategory).length,
        totalPainPoints: Object.values(painPointsByCategory).flat().length,
        method: "Gemini Grounded Search (GitHub Action)",
      },
      trendingQuestions: {
        count: trendingQuestions.length,
        method: "Gemini Grounded Search (GitHub Action)",
      },
      libraryCoverage: {
        totalCourses: coverageData._totalCourses || 0,
        categoriesAnalyzed: Object.keys(coverageData).length,
      },
    },
    suggestions: suggestions.slice(0, 30),
    trendingQuestions,
    painPointsByCategory,
    demandData,
    coverageData,
  };
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Demand Intelligence Scraper — Starting...\n");
  const startTime = Date.now();

  // ── Validate env ────────────────────────────────────────────────
  if (!GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY environment variable is required");
    process.exit(1);
  }

  // ── Load local data ─────────────────────────────────────────────
  console.log("📂 Loading local data files...");
  const benchmarks = JSON.parse(fs.readFileSync(BENCHMARKS_PATH, "utf-8"));
  const videoLibrary = JSON.parse(fs.readFileSync(VIDEO_LIBRARY_PATH, "utf-8"));
  const courses = videoLibrary.courses || [];

  // Build taxonomy from benchmarks subtopics
  const taxonomy = {};
  for (const [cat, subs] of Object.entries(benchmarks.subtopics || {})) {
    taxonomy[cat] = Object.keys(subs);
  }

  const categories = Object.keys(taxonomy);
  console.log(`  ✅ ${categories.length} categories, ${courses.length} courses loaded`);

  // ── Layer 1: Demand data (instant — local file) ─────────────────
  console.log("\n📊 Layer 1: Loading demand benchmarks...");
  const demandData = {};
  for (const [category, subtopics] of Object.entries(taxonomy)) {
    const overallScore = benchmarks.benchmarks[category] ?? 50;
    demandData[category] = {
      overall: overallScore,
      subtopics: {},
    };
    for (const subtopic of subtopics) {
      demandData[category].subtopics[subtopic] =
        benchmarks.subtopics[category]?.[subtopic] ?? overallScore;
    }
  }
  console.log("  ✅ Demand data loaded");

  // ── Layer 2a: Trending questions (Gemini grounded search) ───────
  const trendingQuestions = await scrapeTrendingQuestions(categories);

  // ── Layer 2b: Pain points per category (batched Gemini calls) ───
  const painPointsByCategory = await scrapeAllPainPoints(categories);

  // ── Layer 3: Coverage analysis (instant — local computation) ────
  console.log("\n📚 Layer 3: Computing library coverage...");
  const coverageData = calculateCoverage(courses, taxonomy);
  coverageData._totalCourses = courses.length;
  console.log("  ✅ Coverage computed");

  // ── Build report ────────────────────────────────────────────────
  console.log("\n📋 Building demand report...");
  const report = buildReport({
    demandData,
    trendingQuestions,
    painPointsByCategory,
    coverageData,
    taxonomy,
    benchmarks,
    startTime,
  });

  console.log(`\n✅ Report complete:`);
  console.log(`   Suggestions: ${report.suggestions.length}`);
  console.log(`   Trending questions: ${report.trendingQuestions.length}`);
  console.log(`   Pain points: ${report.provenance.communitySearch.totalPainPoints}`);
  console.log(`   Time: ${report.generationTimeMs}ms`);

  // ── Write to Firestore ──────────────────────────────────────────
  const db = initFirestore();
  if (db) {
    console.log("\n🔥 Writing to Firestore...");
    const today = new Date().toISOString().split("T")[0];

    try {
      // Write latest report (overwrite)
      await db.doc("demand_intel/latest").set(report);
      console.log("  ✅ demand_intel/latest updated");

      // Write historical snapshot
      await db.doc(`demand_intel/history_${today}`).set({
        date: today,
        generatedAt: report.generatedAt,
        suggestionCount: report.suggestions.length,
        trendingCount: report.trendingQuestions.length,
        painPointCount: report.provenance.communitySearch.totalPainPoints,
        topSuggestions: report.suggestions.slice(0, 5).map((s) => ({
          topic: s.topic,
          category: s.category,
          gap: s.gap,
          demandScore: s.demandScore,
        })),
      });
      console.log(`  ✅ demand_intel/history_${today} created`);
    } catch (err) {
      console.error(`  ❌ Firestore write failed: ${err.message}`);
    }
  } else {
    console.log("\n⏭️  Skipping Firestore write (no service account)");
    // Save locally for debugging
    const outputPath = path.join(__dirname, "../demand_intel_report.json");
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`  📄 Saved report to ${outputPath}`);
  }

  console.log(`\n🏁 Done in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
