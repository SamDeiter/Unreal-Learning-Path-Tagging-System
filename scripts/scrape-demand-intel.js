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
 *   5. Load video_library_enriched.json (or video_library.json fallback) for coverage analysis
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


// ── Command Line Args ─────────────────────────────────────────────
const args = process.argv.slice(2);
const engine = args.includes("--engine") ? args[args.indexOf("--engine") + 1] : "UE5";
console.log(`Running in ${engine} mode...`);

// ── Paths ──────────────────────────────────────────────────────────
const BENCHMARKS_FILENAME = engine === "UEFN" ? "demand_benchmarks_uefn.json" : "demand_benchmarks.json";
const BENCHMARKS_PATH = path.join(
  __dirname,
  "../path-builder/src/data",
  BENCHMARKS_FILENAME
);

const VIDEO_LIBRARY_ENRICHED = path.join(
  __dirname,
  "../path-builder/src/data/video_library_enriched.json"
);
const VIDEO_LIBRARY_FALLBACK = path.join(
  __dirname,
  "../path-builder/src/data/video_library.json"
);
const VIDEO_LIBRARY_PATH = fs.existsSync(VIDEO_LIBRARY_ENRICHED)
  ? VIDEO_LIBRARY_ENRICHED
  : VIDEO_LIBRARY_FALLBACK;

// ── Config ─────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FIREBASE_SA_B64 = process.env.FIREBASE_SERVICE_ACCOUNT;

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const BATCH_SIZE = 6; // Concurrent Gemini calls (pain points batch size)
const TRENDING_PER_CATEGORY = 2; // Questions per category (kept small to avoid truncation)
const PAIN_POINT_LIMIT = 5;
const RATE_LIMIT_DELAY_MS = 2000;
const MAX_RETRIES = 3;
const PARALLEL_CONCURRENCY = 2; // Run 2 Gemini calls in parallel for speed

// ── Firebase Init ──────────────────────────────────────────────────

function initFirestore() {
  if (!FIREBASE_SA_B64) {
    console.warn("⚠️  FIREBASE_SERVICE_ACCOUNT not set — will skip Firestore write");
    return null;
  }

  try {
    // Guard against double initialization (called for YouTube read + report write)
    if (admin.apps.length === 0) {
      const serviceAccount = JSON.parse(
        Buffer.from(FIREBASE_SA_B64, "base64").toString("utf-8")
      );
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

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
    maxOutputTokens: 16384,
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

    // Truncated JSON repair: Gemini may hit token limit mid-object.
    // Find the last complete object boundary "},", trim after it, close array.
    const arrStart = cleaned.indexOf("[");
    if (arrStart !== -1) {
      const partial = cleaned.slice(arrStart);
      // Find last complete object (ends with "}")
      const lastCloseBrace = partial.lastIndexOf("}");
      if (lastCloseBrace > 0) {
        const repaired = partial.slice(0, lastCloseBrace + 1) + "]";
        try {
          const result = JSON.parse(repaired);
          console.warn(`  ⚠️ Repaired truncated JSON (salvaged ${Array.isArray(result) ? result.length : 1} items)`);
          return result;
        } catch { /* fall through */ }
      }

      // Deeper repair: strip trailing incomplete key-value pairs and close brackets
      const attempt = partial.replace(/,?\s*"[^"]*"\s*:\s*[^,}\]]*$/, "");
      const opens = (attempt.match(/\[/g) || []).length;
      const closes = (attempt.match(/\]/g) || []).length;
      const openBraces = (attempt.match(/\{/g) || []).length;
      const closeBraces = (attempt.match(/\}/g) || []).length;
      const fixed = attempt + "}".repeat(Math.max(0, openBraces - closeBraces)) + "]".repeat(Math.max(0, opens - closes));
      try {
        const result = JSON.parse(fixed);
        console.warn(`  ⚠️ Deep-repaired truncated JSON (salvaged ${Array.isArray(result) ? result.length : 1} items)`);
        return result;
      } catch { /* exhausted all repair strategies */ }
    }

    console.warn("  ⚠️ Could not parse JSON from response:", cleaned.slice(0, 200));
    return null;
  }
}

// ── Grounding metadata validation ──────────────────────────────────
//
// When Gemini answers with `tools: [{google_search: {}}]`, the real sources it
// browsed land in `groundingMetadata.groundingChunks[].web.{uri,title}`. The
// `uri` is a vertexaisearch.cloud.google.com redirect that resolves to the
// actual page in a browser and is valid for ~30 days. The `title` is the real
// page title, usually formatted "Page Title - hostname.com".
//
// LLM-emitted URLs inside the JSON body are NOT constrained to these — the
// model will happily fabricate plausible-looking links. So at normalize time
// we throw the LLM URL away and try to match the LLM-emitted source TITLE to
// a grounding chunk title, substituting in the chunk's verified uri.
//
// If no match → leave url empty and let the UI fall back to a platform search.

function extractGroundingChunks(groundingMetadata) {
  if (!groundingMetadata) return [];
  const chunks = groundingMetadata.groundingChunks || [];
  return chunks
    .map((c) => ({
      uri: c.web?.uri || "",
      title: c.web?.title || "",
    }))
    .filter((c) => c.uri && c.title);
}

function normalizeTitleForMatch(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s*[-|–—]\s*[a-z0-9.-]+\.[a-z]{2,}\s*$/i, "") // strip trailing " - hostname.com"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findGroundedUri(srcTitle, groundedChunks) {
  const norm = normalizeTitleForMatch(srcTitle);
  if (!norm || !groundedChunks.length) return "";
  // exact normalized title match
  for (const c of groundedChunks) {
    if (normalizeTitleForMatch(c.title) === norm) return c.uri;
  }
  // substring either direction — guards against partial titles
  for (const c of groundedChunks) {
    const cn = normalizeTitleForMatch(c.title);
    if (!cn) continue;
    if (cn.includes(norm) || norm.includes(cn)) return c.uri;
  }
  return "";
}

// ── Reddit Public API ──────────────────────────────────────────────

async function fetchRedditEngagement(subtopic) {
  const query = encodeURIComponent(`${engine === "UEFN" ? "UEFN Verse" : "unreal engine 5"} ${subtopic}`);
  const subreddit = engine === "UEFN" ? "FortniteCreative" : "unrealengine";
  const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${query}&sort=relevance&t=month&limit=10`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "UE-DemandIntel/2.0 (github.com/SamDeiter; demand-intel-bot)" },
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

  for (const [category, subtopicsObj] of Object.entries(taxonomy)) {
    const subtopics = Object.keys(subtopicsObj);
    for (const subtopic of subtopics) {
      allSubtopics.push({ category, subtopic });
    }
  }

  // Sample top subtopics to avoid hitting Reddit rate limits
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

  // Build batches of categories
  const TRENDING_BATCH = 6;
  const batches = [];
  for (let i = 0; i < categories.length; i += TRENDING_BATCH) {
    batches.push(categories.slice(i, i + TRENDING_BATCH));
  }
  const totalBatches = batches.length;
  console.log(`  Running ${totalBatches} batches (${PARALLEL_CONCURRENCY} in parallel)...`);

  // Process batches with limited concurrency
  for (let g = 0; g < batches.length; g += PARALLEL_CONCURRENCY) {
    const group = batches.slice(g, g + PARALLEL_CONCURRENCY);

    const promises = group.map(async (batch, idx) => {
      const batchNum = g + idx + 1;
      console.log(`  📦 Batch ${batchNum}/${totalBatches}: ${batch.join(", ")}`);

      const prompt = `You are a ${engine} community research assistant. Search for REAL questions that Unreal Engine (${engine}) learners are currently asking in online communities.

REQUIRED SEARCH SOURCES:
- ${engine === "UEFN" ? "Reddit r/FortniteCreative (recent posts with upvotes)" : "Reddit r/unrealengine (recent posts with upvotes)"}
- forums.unrealengine.com (Epic official forums)
- ${engine === "UEFN" ? "stackoverflow.com [fortnite-creative] tag" : "stackoverflow.com [unreal-engine5] tag"}
- Epic Developer Community (dev.epicgames.com)
- ${engine} tutorials and gamedev content on YouTube, TikTok, and Instagram
- x.com / twitter.com: search ${engine === "UEFN" ? "#UEFN #FortniteCreative" : "#UnrealEngine #UE5"} hashtags for viral posts, threads, and questions (use site:x.com)
- Udemy and Skillshare ${engine} courses

CATEGORIES TO RESEARCH: ${batch.join(", ")}

For EACH category listed above, find ${TRENDING_PER_CATEGORY} real questions that people are asking. That means you should return exactly ${batch.length * TRENDING_PER_CATEGORY} questions total.

Return a JSON array:
[{
  "question": "The exact question learners are asking",
  "category": "Which of the categories above this belongs to",
  "subtopic": "Specific subtopic within that category",
  "frequency": "high|medium|low",
  "sources": [{
    "type": "reddit|epic_forum|stackoverflow|youtube|tiktok|instagram|udemy|twitch|twitter",
    "title": "Post/thread title",
    "url": "URL",
    "date": "YYYY-MM-DD",
    "engagement": "e.g. 45 upvotes, 23 comments"
  }]
}]

IMPORTANT RULES:
- CRITICAL: Each question gets exactly ONE source entry — its PRIMARY platform where you found the strongest signal
- Every question MUST have at least one source with a URL
- Focus on learning/tutorial questions, not engine bug reports
- Return VALID JSON only.`;

      try {
        const result = await callGemini(prompt);
        const parsed = parseJSON(result.text);
        const groundedChunks = extractGroundingChunks(result.groundingMetadata);

        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          console.log(
            `    ✅ Batch ${batchNum}: got ${parsed.length} questions` +
              (groundedChunks.length ? ` (${groundedChunks.length} grounded sources)` : "")
          );
          // Annotate each question with the batch's grounded chunks so the
          // normalize step downstream can rewrite hallucinated URLs.
          return parsed.map((q) => ({ ...q, _groundedChunks: groundedChunks }));
        } else {
          console.warn(`    ⚠️ Batch ${batchNum}: empty or unparseable`);
          return [];
        }
      } catch (err) {
        console.error(`    ❌ Batch ${batchNum} failed: ${err.message}`);
        return [];
      }
    });

    // Wait for this group of parallel batches
    const results = await Promise.allSettled(promises);
    for (const r of results) {
      if (r.status === "fulfilled" && r.value && r.value.length > 0) {
        allQuestions.push(...r.value);
      }
    }

    if (g + PARALLEL_CONCURRENCY < batches.length) {
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
    .map((q) => {
      const chunks = Array.isArray(q._groundedChunks) ? q._groundedChunks : [];
      return {
        question: q.question || "",
        category: q.category || "General",
        subtopic: q.subtopic || "",
        frequency: q.frequency || "medium",
        sources: (q.sources || []).map((src) => {
          // Replace LLM-emitted URL with a grounded one matched by title.
          // No match → leave empty so the UI uses its search fallback.
          const groundedUri = findGroundedUri(src.title, chunks);
          return {
            type: src.type || "unknown",
            url: groundedUri,
            title: src.title || "",
            date: src.date || "",
            engagement: src.engagement || "",
            verified: Boolean(groundedUri),
          };
        }),
      };
    });

  console.log(`  ✅ Total: ${uniqueQuestions.length} unique trending questions`);
  return uniqueQuestions;
}


async function scrapePainPoints(category) {
  const prompt = `You are a ${engine} community research assistant. Search for the most common struggles and confusion points that Unreal Engine (${engine}) learners experience with: "${category}"

SEARCH THESE SOURCES:
- forums.unrealengine.com (Epic's official forums)
- ${engine === "UEFN" ? "Reddit r/FortniteCreative" : "Reddit r/unrealengine"}
- Epic Developer Community
- YouTube comments on ${engine} tutorials about ${category}
- TikTok/Instagram ${engine} reels and gamedev content
- x.com / twitter.com: search ${engine === "UEFN" ? "#UEFN #FortniteCreative #VerseScript" : "#UnrealEngine #UE5 #gamedev"} for pain point discussions (use site:x.com)

Focus on posts from the last 6 months.

Return a JSON array of the top ${PAIN_POINT_LIMIT} pain points:
[{
  "painPoint": "One-sentence description of the struggle",
  "sourceUrl": "URL where this was found",
  "sourceTitle": "Title of the post/thread",
  "relevance": "high|medium|low",
  "frequency": "How often this comes up"
}]

IMPORTANT RULES:
- Focus on LEARNER confusion, not engine bugs
- Include REAL source URLs you found via search
- Return VALID JSON only`;

  try {
    const result = await callGemini(prompt);
    const parsed = parseJSON(result.text);
    const groundedChunks = extractGroundingChunks(result.groundingMetadata);

    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      return [];
    }

    return parsed.slice(0, PAIN_POINT_LIMIT).map((pp) => {
      const sourceTitle = pp.sourceTitle || pp.source_title || "";
      const groundedUri = findGroundedUri(sourceTitle, groundedChunks);
      return {
        painPoint: pp.painPoint || pp.pain_point || "",
        // Drop the LLM-emitted sourceUrl; substitute a grounded uri when we
        // can match by title, otherwise leave empty for the UI fallback.
        sourceUrl: groundedUri,
        sourceTitle,
        relevance: pp.relevance || "medium",
        frequency: pp.frequency || "",
        verified: Boolean(groundedUri),
      };
    });
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

    if (i + BATCH_SIZE < categories.length) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
    }
  }

  const totalPainPoints = Object.values(results).flat().length;
  console.log(`  ✅ Found ${totalPainPoints} pain points across ${categories.length} categories`);
  return results;
}

// ── Coverage Analysis ─────────────────────────────────────────────

function calculateCoverage(courses, taxonomy) {
  const coverage = {};
  const FULL_COVERAGE_THRESHOLD = engine === "UEFN" ? 8 : 15; // Lower threshold for UEFN since it's newer/smaller

  for (const [category, subtopicsObj] of Object.entries(taxonomy)) {
    coverage[category] = {};
    const subtopics = Object.keys(subtopicsObj);

    for (const subtopic of subtopics) {
      const keywords = subtopic
        .toLowerCase()
        .replace(/[()]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 2);

      let matchCount = 0;
      for (const course of courses) {
        // Simple engine filter for UEFN
        const isUEFN = course.title?.toLowerCase().includes("uefn") || 
                       course.title?.toLowerCase().includes("verse") ||
                       course.tags?.engine?.toLowerCase() === "uefn";
        
        if (engine === "UEFN" && !isUEFN) continue;

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
  youtubeMetrics,
  trendsData,
  redditSentiment,
  courses,
}) {
  const suggestions = [];

  for (const [category, data] of Object.entries(demandData)) {
    for (const [subtopic, demandScore] of Object.entries(data.subtopics)) {
      const coverageInfo = coverageData[category]?.[subtopic] || {
        coverage: 0,
        courseCount: 0,
      };
      const gap = demandScore - coverageInfo.coverage;

      let reddit = redditEngagement[category]?.[subtopic] || null;
      if (!reddit && redditEngagement[category]) {
        const catEntries = Object.values(redditEngagement[category]).filter(Boolean);
        if (catEntries.length > 0) {
          reddit = {
            postCount: Math.round(catEntries.reduce((s, e) => s + (e.postCount || 0), 0) / catEntries.length),
            avgUpvotes: Math.round(catEntries.reduce((s, e) => s + (e.avgUpvotes || 0), 0) / catEntries.length),
            avgComments: Math.round(catEntries.reduce((s, e) => s + (e.avgComments || 0), 0) / catEntries.length),
            totalEngagement: Math.round(catEntries.reduce((s, e) => s + (e.totalEngagement || 0), 0) / catEntries.length),
            topPost: catEntries[0]?.topPost || null,
            _fallback: true,
          };
        }
      }

      const sources = [];

      sources.push({
        type: "community_index",
        url: "",
        title: `Community Activity Index: "${subtopic}"`,
        interestScore: demandScore,
        trend: demandScore > (data.overall || 50) ? "rising" : "stable",
      });

      if (reddit) {
        sources.push({
          type: "reddit",
          url: reddit.topPost?.url || "",
          title: reddit.topPost?.title || `Reddit: ${subtopic}`,
          engagement: `${reddit.postCount} posts · ${reddit.avgUpvotes} avg upvotes`,
          redditStats: reddit,
        });
      }

      const relatedQuestions = trendingQuestions.filter(
        (q) =>
          q.category?.toLowerCase() === category.toLowerCase() ||
          q.subtopic?.toLowerCase().includes(subtopic.toLowerCase())
      );
      for (const q of relatedQuestions) {
        for (const src of q.sources || []) {
          sources.push({ ...src, relatedQuestion: q.question });
        }
      }

      const categoryPainPoints = painPointsByCategory[category] || [];
      const relatedPainPoints = categoryPainPoints.filter((pp) =>
        pp.painPoint?.toLowerCase().includes(subtopic.split(" ")[0].toLowerCase())
      );
      for (const pp of relatedPainPoints) {
        sources.push({
          type: pp.sourceUrl?.includes("reddit") ? "reddit" : "community_resource",
          url: pp.sourceUrl || "",
          title: pp.sourceTitle || pp.painPoint || "",
          painPoint: pp.painPoint,
        });
      }

      const verifiedSourceCount = sources.filter((s) => s.type !== "community_index" && s.url).length;
      const confidence = verifiedSourceCount >= 3 ? "high" : verifiedSourceCount >= 1 ? "medium" : "low";

      if (gap > 0 || sources.length > 0) {
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
          rankScore: demandScore * Math.max(1, verifiedSourceCount + 1) - coverageInfo.coverage,
          decayRisk: decay.risk,
          decayReason: decay.reason,
          decayVersion: decay.breakingVersion,
          sources,
        });
      }
    }
  }

  computeDemandIndex(suggestions, { youtubeMetrics, trendsData });
  suggestions.sort((a, b) => b.demandIndex - a.demandIndex);

  return {
    generatedAt: new Date().toISOString(),
    generationTimeMs: Date.now() - startTime,
    scrapedBy: "github-action",
    engine: engine,
    provenance: {
      communityIndex: {
        version: benchmarks.version || "unknown",
        subtopicCount: Object.values(taxonomy).reduce((sum, subMap) => sum + Object.keys(subMap).length, 0),
      },
      communitySearch: {
        categoriesScanned: Object.keys(painPointsByCategory).length,
        totalPainPoints: Object.values(painPointsByCategory).flat().length,
      },
      trendingQuestions: {
        count: trendingQuestions.length,
      },
      redditEngagement: {
        subtopicsScanned: Object.values(redditEngagement).flatMap((c) => Object.keys(c)).length,
      },
      libraryCoverage: {
        totalCourses: (courses || []).length,
      },
    },
    suggestions: suggestions.slice(0, 30),
    trendingQuestions: trendingQuestions.slice(0, 20),
    painPointsByCategory,
  };
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log(`\n🚀 Starting Demand Intelligence Scraper (${engine})...`);

  // ── Layer 1: Taxonomy & Benchmarks ────────────────────────────────
  console.log("\n🧪 Layer 1: Loading taxonomy and benchmarks...");
  if (!fs.existsSync(BENCHMARKS_PATH)) {
    throw new Error(`Benchmarks file missing: ${BENCHMARKS_PATH}`);
  }
  const benchmarks = JSON.parse(fs.readFileSync(BENCHMARKS_PATH, "utf-8"));
  const coursesRaw = JSON.parse(fs.readFileSync(VIDEO_LIBRARY_PATH, "utf-8"));
  const courses = Array.isArray(coursesRaw) ? coursesRaw : (coursesRaw.courses || []);

  const taxonomy = benchmarks.subtopics;
  const categories = Object.keys(taxonomy);
  console.log(`  ✅ Loaded ${categories.length} categories from ${BENCHMARKS_FILENAME}`);

  // ── Layer 2: Demand Signals ───────────────────────────────────────
  console.log("\n📡 Layer 2: Gathering demand signals...");

  const demandData = {};
  for (const category of categories) {
    const subtopics = Object.keys(taxonomy[category]);
    const overallScore = benchmarks.benchmarks[category] ?? 50;
    demandData[category] = {
      overall: overallScore,
      subtopics: {},
    };
    for (const subtopic of subtopics) {
      demandData[category].subtopics[subtopic] =
        taxonomy[category]?.[subtopic] ?? overallScore;
    }
  }
  console.log("  ✅ Demand data loaded");

  const trendingQuestions = await scrapeTrendingQuestions(categories);
  const painPointsByCategory = await scrapeAllPainPoints(categories);
  const redditEngagement = await scrapeRedditEngagement(taxonomy);

  const db = initFirestore();
  const collectionName = engine === "UEFN" ? "demand_intel_uefn" : "demand_intel";

  let youtubeMetrics = null;
  if (db) {
    try {
      const ytDoc = await db.doc(`${collectionName}/youtube_metrics`).get();
      if (ytDoc.exists) {
        const ytData = ytDoc.data();
        youtubeMetrics = ytData.categoryMetrics || null;
        console.log(`  ✅ YouTube metrics loaded`);
      }
    } catch (err) {
      console.warn(`  ⚠️ YouTube metrics load failed: ${err.message}`);
    }
  }

  let trendsData = null;
  if (db) {
    try {
      const trendsDoc = await db.doc(`${collectionName}/google_trends`).get();
      if (trendsDoc.exists) {
        const tData = trendsDoc.data();
        trendsData = tData.categoryTrends || null;
        console.log(`  ✅ Google Trends loaded`);
      }
    } catch (err) {
      console.warn(`  ⚠️ Google Trends load failed: ${err.message}`);
    }
  }

  let redditSentiment = null;
  if (db) {
    try {
      const sentimentDoc = await db.doc(`${collectionName}/reddit_sentiment`).get();
      if (sentimentDoc.exists) {
        const sData = sentimentDoc.data();
        redditSentiment = sData.categories || null;
        console.log(`  ✅ Reddit PRAW sentiment loaded`);
      }
    } catch (err) {
      console.warn(`  ⚠️ Reddit PRAW sentiment load failed: ${err.message}`);
    }
  }

  // ── Layer 3: Coverage analysis ───────────────────────────────────
  console.log("\n📚 Layer 3: Computing library coverage...");
  const coverageData = calculateCoverage(courses, taxonomy);
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
    youtubeMetrics,
    trendsData,
    redditSentiment,
    courses,
  });

  console.log(`\n✅ Report complete: ${report.suggestions.length} suggestions`);

  // ── Write to Firestore ─────────────────────────────────────────
  if (db) {
    console.log("\n🔥 Writing to Firestore...");
    const today = new Date().toISOString().split("T")[0];

    try {
      await db.doc(`${collectionName}/latest`).set(report);
      console.log(`  ✅ ${collectionName}/latest updated`);

      await db.doc(`${collectionName}/history_${today}`).set({
        date: today,
        generatedAt: report.generatedAt,
        suggestionCount: report.suggestions.length,
        topSuggestions: report.suggestions.slice(0, 5).map(s => ({ topic: s.topic, score: s.demandScore })),
      });
      console.log(`  ✅ ${collectionName}/history_${today} created`);
    } catch (err) {
      console.error(`  ❌ Firestore write failed: ${err.message}`);
    }
  } else {
    console.log("\n⏭️ Skipping Firestore write");
    const outputPath = path.join(__dirname, `../demand_intel_report_${engine.toLowerCase()}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`  📄 Saved report to ${outputPath}`);
  }

  console.log(`\n🏁 Done in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
