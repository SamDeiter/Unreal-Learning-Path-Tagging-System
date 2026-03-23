/**
 * scrape-demand-intel.js — Scheduled Demand Intelligence Scraper
 *
 * Runs as a GitHub Action (daily) to pre-compute demand intelligence data
 * and store it in Firestore for instant frontend reads.
 *
 * Architecture:
 *   1. Load demand_benchmarks.json for category taxonomy
 *   2. Call Gemini 2.5 Flash with grounded search for trending questions
 *   3. Call Gemini 2.5 Flash for community pain points (batched)
 *   4. Query Reddit public JSON API for real engagement counts
 *   5. Load video_library_enriched.json for coverage analysis
 *   6. Build ranked suggestions report with confidence scoring
 *   7. Write to Firestore: demand_intel/latest + demand_intel/history_{date}
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
const { computeDecayRisk, computeDemandIndex } = require("./decayDetector");

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

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const BATCH_SIZE = 3; // Concurrent Gemini calls
const TRENDING_PER_CATEGORY = 3; // Questions per category
const PAIN_POINT_LIMIT = 5;
const RATE_LIMIT_DELAY_MS = 2000;
const MAX_RETRIES = 3;

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

// ── Gemini REST API with retry ─────────────────────────────────────

async function callGemini(prompt, { retries = MAX_RETRIES, useGrounding = true } = {}) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

  const generationConfig = {
    temperature: 0.3,
    maxOutputTokens: 8192,
  };

  // IMPORTANT: responseMimeType "application/json" conflicts with google_search
  // grounding tools — Gemini cannot produce structured JSON while also using
  // search tools. Only enable JSON mode when grounding is OFF.
  if (!useGrounding) {
    generationConfig.responseMimeType = "application/json";
  }

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig,
  };

  // Grounded search — snake_case for REST API
  if (useGrounding) {
    body.tools = [{ google_search: {} }];
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const msg = `Gemini API ${response.status}: ${errorText.slice(0, 300)}`;

        // Retry on 429 (rate limit) or 5xx (server errors)
        if ((response.status === 429 || response.status >= 500) && attempt < retries) {
          const delay = RATE_LIMIT_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(`  ⚠️ ${msg} — retrying in ${delay}ms (attempt ${attempt}/${retries})`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        throw new Error(msg);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const groundingMetadata = data.candidates?.[0]?.groundingMetadata || null;

      // If grounding returned empty text, retry once without grounding as fallback
      if (useGrounding && !text.trim()) {
        console.warn("  ⚠️ Grounded search returned empty text — retrying without grounding...");
        return callGemini(prompt, { retries: 1, useGrounding: false });
      }

      return { text, groundingMetadata };
    } catch (err) {
      if (attempt < retries && !err.message.includes("404")) {
        const delay = RATE_LIMIT_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`  ⚠️ Attempt ${attempt} failed: ${err.message} — retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
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
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try { return JSON.parse(arrMatch[0]); } catch { /* fall through */ }
    }
    // Try extracting JSON object
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch { /* fall through */ }
    }
    console.warn("  ⚠️ Could not parse JSON from response:", cleaned.slice(0, 200));
    return null;
  }
}

// ── Reddit Public API ──────────────────────────────────────────────

async function fetchRedditEngagement(subtopic) {
  const query = encodeURIComponent(`unreal engine 5 ${subtopic}`);
  const url = `https://www.reddit.com/r/unrealengine/search.json?q=${query}&sort=relevance&t=month&limit=10`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "UE5-DemandIntel/1.0" },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const posts = data?.data?.children || [];

    if (posts.length === 0) return null;

    const postCount = posts.length;
    const totalUpvotes = posts.reduce((sum, p) => sum + (p.data.ups || 0), 0);
    const totalComments = posts.reduce((sum, p) => sum + (p.data.num_comments || 0), 0);

    return {
      postCount,
      avgUpvotes: Math.round(totalUpvotes / postCount),
      avgComments: Math.round(totalComments / postCount),
      totalEngagement: totalUpvotes + totalComments,
      topPost: posts[0]?.data ? {
        title: posts[0].data.title,
        url: `https://reddit.com${posts[0].data.permalink}`,
        ups: posts[0].data.ups,
        comments: posts[0].data.num_comments,
      } : null,
    };
  } catch {
    return null;
  }
}

async function scrapeRedditEngagement(taxonomy) {
  console.log("\n📊 Layer 2c: Fetching Reddit engagement data...");
  const results = {};
  const allSubtopics = [];

  for (const [category, subtopics] of Object.entries(taxonomy)) {
    for (const subtopic of subtopics) {
      allSubtopics.push({ category, subtopic });
    }
  }

  // Sample top subtopics to avoid hitting Reddit rate limits
  // Take first 2 from each category
  const sampled = [];
  for (const category of Object.keys(taxonomy)) {
    const catSubtopics = allSubtopics.filter((s) => s.category === category);
    sampled.push(...catSubtopics.slice(0, 2));
  }

  console.log(`  Sampling ${sampled.length} subtopics from ${Object.keys(taxonomy).length} categories`);

  for (let i = 0; i < sampled.length; i += BATCH_SIZE) {
    const batch = sampled.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map((s) => fetchRedditEngagement(s.subtopic))
    );

    batch.forEach((s, idx) => {
      const result = batchResults[idx];
      if (result.status === "fulfilled" && result.value) {
        if (!results[s.category]) results[s.category] = {};
        results[s.category][s.subtopic] = result.value;
      }
    });

    // Reddit rate limit: 1 request per second
    if (i + BATCH_SIZE < sampled.length) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  const totalEngagementPoints = Object.values(results)
    .flatMap((cat) => Object.values(cat))
    .filter(Boolean).length;
  console.log(`  ✅ Got Reddit data for ${totalEngagementPoints} subtopics`);
  return results;
}

// ── Scraping Functions ─────────────────────────────────────────────

async function scrapeTrendingQuestions(categories) {
  console.log(`\n🔍 Scraping trending questions across ${categories.length} categories...`);

  const allQuestions = [];

  // Batch categories into groups of 3-4 to get per-category coverage
  for (let i = 0; i < categories.length; i += 4) {
    const batch = categories.slice(i, i + 4);
    const batchNum = Math.floor(i / 4) + 1;
    const totalBatches = Math.ceil(categories.length / 4);
    console.log(`  📦 Batch ${batchNum}/${totalBatches}: ${batch.join(", ")}`);

    const prompt = `You are a UE5 community research assistant. Search for REAL questions that Unreal Engine 5 learners are currently asking in online communities.

REQUIRED SEARCH SOURCES:
- Reddit r/unrealengine (recent posts with upvotes)
- forums.unrealengine.com (Epic official forums)
- stackoverflow.com [unreal-engine5] tag
- Epic Developer Community (dev.epicgames.com)

CATEGORIES TO RESEARCH: ${batch.join(", ")}

For EACH category listed above, find ${TRENDING_PER_CATEGORY} real questions that people are asking. That means you should return exactly ${batch.length * TRENDING_PER_CATEGORY} questions total.

Return a JSON array:
[{
  "question": "The exact question learners are asking",
  "category": "Which of the categories above this belongs to",
  "subtopic": "Specific subtopic within that category",
  "frequency": "high|medium|low",
  "sources": [{
    "type": "reddit|epic_forum|stackoverflow|youtube",
    "title": "Post/thread title",
    "url": "URL",
    "date": "YYYY-MM-DD",
    "engagement": "e.g. 45 upvotes, 23 comments"
  }]
}]

IMPORTANT RULES:
- ONLY return questions from REAL posts you can find via search
- Every question MUST have at least one source with a URL
- Focus on learning/tutorial questions, not engine bug reports
- Return VALID JSON only`;

    try {
      const result = await callGemini(prompt);
      const parsed = parseJSON(result.text);

      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        allQuestions.push(...parsed);
        console.log(`    ✅ Got ${parsed.length} questions`);
      } else {
        console.warn(`    ⚠️ Batch ${batchNum}: empty or unparseable (raw: ${result.text.slice(0, 300)})`);
      }
    } catch (err) {
      console.error(`    ❌ Batch ${batchNum} failed: ${err.message}`);
    }

    // Rate limit between batches
    if (i + 4 < categories.length) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
    }
  }

  // Deduplicate and normalize
  const seen = new Set();
  const uniqueQuestions = allQuestions
    .filter((q) => {
      const key = (q.question || "").toLowerCase().trim();
      if (seen.has(key) || !key) return false;
      seen.add(key);
      return true;
    })
    .map((q) => ({
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

  console.log(`  ✅ Total: ${uniqueQuestions.length} unique trending questions`);
  return uniqueQuestions;
}

async function scrapePainPoints(category) {
  const prompt = `You are a UE5 community research assistant. Search for the most common struggles and confusion points that Unreal Engine 5 learners experience with: "${category}"

SEARCH THESE SOURCES:
- forums.unrealengine.com (Epic's official forums)
- Reddit r/unrealengine
- Epic Developer Community
- YouTube comments on UE5 tutorials about ${category}

Focus on posts from the last 6 months about UE5 version 5.3, 5.4, or 5.5.

Return a JSON array of the top ${PAIN_POINT_LIMIT} pain points:
[{
  "painPoint": "One-sentence description of the struggle",
  "sourceUrl": "URL where this was found",
  "sourceTitle": "Title of the post/thread",
  "relevance": "high|medium|low",
  "frequency": "How often this comes up (many posts, several posts, a few posts)"
}]

IMPORTANT RULES:
- Focus on LEARNER confusion, not engine bugs or crashes
- Each pain point should be specific and actionable (e.g. "Learners struggle to understand the difference between Actor Components and Scene Components" NOT "Components are confusing")
- Include REAL source URLs you found via search
- Return VALID JSON only`;

  try {
    const result = await callGemini(prompt);
    const parsed = parseJSON(result.text);

    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      console.warn(`    ⚠️ Pain points for "${category}": empty result (raw: ${result.text.slice(0, 300)})`);
      return [];
    }

    return parsed.slice(0, PAIN_POINT_LIMIT).map((pp) => ({
      painPoint: pp.painPoint || pp.pain_point || "",
      sourceUrl: pp.sourceUrl || pp.source_url || "",
      sourceTitle: pp.sourceTitle || pp.source_title || "",
      relevance: pp.relevance || "medium",
      frequency: pp.frequency || "",
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
  redditEngagement,
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
      const reddit = redditEngagement[category]?.[subtopic] || null;

      const sources = [];

      // Community Activity Index source
      sources.push({
        type: "community_index",
        url: "",
        title: `Community Activity Index: "${subtopic}"`,
        interestScore: demandScore,
        trend: demandScore > (data.overall || 50) ? "rising" : "stable",
      });

      // Reddit engagement source (real data)
      if (reddit) {
        sources.push({
          type: "reddit",
          url: reddit.topPost?.url || "",
          title: reddit.topPost?.title || `Reddit: ${subtopic}`,
          engagement: `${reddit.postCount} posts · ${reddit.avgUpvotes} avg upvotes · ${reddit.avgComments} avg comments`,
          redditStats: reddit,
        });
      }

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

      // Confidence scoring — now uses Reddit real data
      const verifiedSourceCount = sources.filter(
        (s) => s.type !== "community_index" && s.url
      ).length;
      const redditBoost = reddit ? Math.min(2, Math.floor(reddit.totalEngagement / 50)) : 0;
      const effectiveSources = verifiedSourceCount + redditBoost;

      const confidence =
        effectiveSources >= 4
          ? "high"
          : effectiveSources >= 2
            ? "medium"
            : "low";

      if (gap > 0 || sources.length > 0) {
        // Compute decay risk based on UE5 breaking changes
        const decay = computeDecayRisk(category, subtopic, sources);

        suggestions.push({
          topic: subtopic,
          category,
          demandScore,
          coverageInLibrary: coverageInfo.coverage,
          courseCount: coverageInfo.courseCount,
          gap: Math.max(0, gap),
          confidence,
          sourceCount: sources.length,
          redditEngagement: reddit,
          rankScore:
            demandScore * Math.max(1, effectiveSources + 1) -
            coverageInfo.coverage,
          decayRisk: decay.risk,
          decayReason: decay.reason,
          decayVersion: decay.breakingVersion,
          sources,
        });
      }
    }
  }

  // Compute weighted Demand Index across all suggestions
  computeDemandIndex(suggestions);

  // Sort by Demand Index (highest opportunity first)
  suggestions.sort((a, b) => b.demandIndex - a.demandIndex);

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
        method: "Gemini 2.5 Flash Grounded Search (GitHub Action)",
      },
      trendingQuestions: {
        count: trendingQuestions.length,
        method: "Gemini 2.5 Flash Grounded Search (GitHub Action)",
      },
      redditEngagement: {
        subtopicsScanned: Object.values(redditEngagement).flatMap((c) => Object.keys(c)).length,
        method: "Reddit Public JSON API",
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
  console.log("🚀 Demand Intelligence Scraper v2.0 — Starting...\n");
  console.log(`   Model: ${GEMINI_MODEL}`);
  console.log(`   Grounding: google_search`);
  console.log(`   Reddit API: enabled\n`);
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

  // ── Layer 2c: Reddit engagement data (real post counts) ─────────
  const redditEngagement = await scrapeRedditEngagement(taxonomy);

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
    redditEngagement,
    taxonomy,
    benchmarks,
    startTime,
  });

  console.log(`\n✅ Report complete:`);
  console.log(`   Suggestions: ${report.suggestions.length}`);
  console.log(`   Trending questions: ${report.trendingQuestions.length}`);
  console.log(`   Pain points: ${report.provenance.communitySearch.totalPainPoints}`);
  console.log(`   Reddit subtopics: ${report.provenance.redditEngagement.subtopicsScanned}`);
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

      // Write historical snapshot (for trend tracking)
      await db.doc(`demand_intel/history_${today}`).set({
        date: today,
        generatedAt: report.generatedAt,
        generationTimeMs: report.generationTimeMs,
        suggestionCount: report.suggestions.length,
        trendingCount: report.trendingQuestions.length,
        painPointCount: report.provenance.communitySearch.totalPainPoints,
        redditSubtopics: report.provenance.redditEngagement.subtopicsScanned,
        topSuggestions: report.suggestions.slice(0, 10).map((s) => ({
          topic: s.topic,
          category: s.category,
          gap: s.gap,
          demandScore: s.demandScore,
          confidence: s.confidence,
          coverageInLibrary: s.coverageInLibrary,
          redditEngagement: s.redditEngagement,
        })),
        // Store critical gaps for alerting
        criticalGaps: report.suggestions
          .filter((s) => s.demandScore > 75 && s.coverageInLibrary === 0)
          .slice(0, 5)
          .map((s) => ({
            topic: s.topic,
            category: s.category,
            demandScore: s.demandScore,
            gap: s.gap,
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
