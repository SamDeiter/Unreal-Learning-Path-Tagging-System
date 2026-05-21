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

// ── Token usage tracking ───────────────────────────────────────────
//
// Captured from Gemini's `usageMetadata` field on every successful response.
// Aggregated across all calls in this script run; printed at end of main().
// Used to measure baseline cost and verify the impact of each tuning change.

const tokenUsage = {
  calls: 0,
  grounded: 0,
  ungrounded: 0,
  promptTokens: 0,
  candidatesTokens: 0,
  totalTokens: 0,
  byPurpose: {}, // { research: {calls, totalTokens}, shape: {...} }
};

function recordUsage(usageMetadata, { useGrounding, purpose }) {
  if (!usageMetadata) return;
  const promptT = usageMetadata.promptTokenCount || 0;
  const candT = usageMetadata.candidatesTokenCount || 0;
  const totalT = usageMetadata.totalTokenCount || promptT + candT;
  tokenUsage.calls += 1;
  if (useGrounding) tokenUsage.grounded += 1;
  else tokenUsage.ungrounded += 1;
  tokenUsage.promptTokens += promptT;
  tokenUsage.candidatesTokens += candT;
  tokenUsage.totalTokens += totalT;
  if (purpose) {
    const bucket = (tokenUsage.byPurpose[purpose] ||= { calls: 0, promptTokens: 0, candidatesTokens: 0, totalTokens: 0 });
    bucket.calls += 1;
    bucket.promptTokens += promptT;
    bucket.candidatesTokens += candT;
    bucket.totalTokens += totalT;
  }
}

function logTokenSummary() {
  const { calls, grounded, ungrounded, promptTokens, candidatesTokens, totalTokens, byPurpose } = tokenUsage;
  console.log("\n📊 Gemini token usage");
  console.log(`  Calls:           ${calls} (${grounded} grounded, ${ungrounded} ungrounded)`);
  console.log(`  Prompt tokens:   ${promptTokens.toLocaleString()}`);
  console.log(`  Output tokens:   ${candidatesTokens.toLocaleString()}`);
  console.log(`  Total tokens:    ${totalTokens.toLocaleString()}`);
  if (calls > 0) {
    console.log(`  Avg per call:    ${Math.round(totalTokens / calls).toLocaleString()}`);
  }
  for (const [purpose, b] of Object.entries(byPurpose)) {
    console.log(`  ${purpose.padEnd(16)} ${b.calls} call${b.calls === 1 ? "" : "s"}, ${b.totalTokens.toLocaleString()} tokens`);
  }
}

// ── Gemini REST API with retry ─────────────────────────────────────

async function callGemini(prompt, { retries = MAX_RETRIES, useGrounding = true, purpose = null } = {}) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

  const generationConfig = {
    temperature: 0.3,
    // Cap output well above the largest realistic call (~4K for a wide
    // pain-points batch). 16K headroom is overkill and masks runaway prompts.
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
      recordUsage(data.usageMetadata, { useGrounding, purpose });

      // If a grounded call returns empty text, do NOT auto-retry without
      // grounding. The two-pass scrape relies on pass 1 carrying grounding
      // chunks forward; an ungrounded retry strips them silently. Return
      // empty and let the caller skip.
      if (useGrounding && !text.trim()) {
        console.warn("  ⚠️ Grounded search returned empty text — skipping (caller will handle).");
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
    // Try extracting JSON array from the response. Anchor on `[{` so that
    // prose preambles with bracketed citations like "[Source 1]" or
    // "[fortnite-creative] tag" don't get swallowed as the array start.
    const arrMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrMatch) {
      try { return JSON.parse(arrMatch[0]); } catch { /* fall through */ }
    }
    // Fallback to the looser pattern in case the JSON contains only scalars
    const looseArrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (looseArrMatch) {
      try { return JSON.parse(looseArrMatch[0]); } catch { /* fall through */ }
    }
    // Try extracting JSON object
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch { /* fall through */ }
    }

    // Truncated JSON repair: Gemini may hit token limit mid-object.
    // Find the last complete object boundary "},", trim after it, close array.
    // Anchor on "[{" rather than the first "[" so prose with bracketed text
    // doesn't pin the start of the array to the wrong character.
    const arrStartMatch = cleaned.match(/\[\s*\{/);
    const arrStart = arrStartMatch ? arrStartMatch.index : -1;
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

// ── Scraping Functions ───────────────────────────────
//
// One grounded research call per batch covers BOTH trending questions and
// pain points for the same categories. Halves the number of grounded calls
// (which is where the bulk of token cost lives — each grounded call eats
// ~7K thinking tokens on top of prompt+output). The follow-up shape pass
// extracts both arrays from the single prose summary.

// How many categories share one grounded research call.
//
// Empirically tuned down from 5: at batch size 5 we saw a UEFN run where the
// 5-category batch returned 0 groundingChunks (model didn't fire search for
// the wider context), losing ~70 % of verified-URL coverage even though
// tokens dropped 34 %. Batch size 3 keeps the merged-content-type savings
// (one grounded call covering both Qs + pain points) while keeping each
// call's context narrow enough that Gemini still grounds reliably.
const SIGNALS_PER_BATCH = 3;

async function scrapeDemandSignalsBatch(batch) {
  const researchPrompt = `Research what Unreal Engine (${engine}) learners are asking AND struggling with in:
- ${engine === "UEFN" ? "Reddit r/FortniteCreative" : "Reddit r/unrealengine"}
- forums.unrealengine.com
- stackoverflow.com [${engine === "UEFN" ? "fortnite-creative" : "unreal-engine5"}]
- dev.epicgames.com community
- YouTube / TikTok / Instagram ${engine} tutorials
- x.com hashtag ${engine === "UEFN" ? "#UEFN" : "#UnrealEngine"}

Focus on posts from the last 6 months.

Categories: ${batch.join(", ")}

For EACH category, produce:
  • ${TRENDING_PER_CATEGORY} trending questions learners are currently asking
  • ${PAIN_POINT_LIMIT} common pain points / struggles

Format (prose, NOT JSON):

Category: <name>
  Questions:
  Q1. "<verbatim question>" — Source: <exact post/video title, platform, engagement> — Subtopic: <subtopic> — Frequency: high|medium|low
  Q2. ...
  Pain points:
  P1. <one-sentence description> — Source: <exact post/thread title, platform> — Frequency: <how often> — Relevance: high|medium|low
  P2. ...

Repeat for every category.

Cite each source by its real title and platform so grounding can attach the URL. If you can’t find a real cited source for an item, omit it rather than fabricating.`;

  try {
    const researchResult = await callGemini(researchPrompt, { purpose: "signals-research" });
    const groundedChunks = extractGroundingChunks(researchResult.groundingMetadata);

    if (!researchResult.text.trim()) {
      console.warn(`    ⚠️ Signals batch [${batch.join(", ")}]: empty research pass`);
      return { questions: [], painPoints: {} };
    }

    const shapePrompt = `Convert this ${engine} learner-demand research into a JSON array. Use ONLY items with a cited source in the summary — do not invent.

Each item is either a question or a pain point. Schema:
[{
  "type": "question",
  "category": "One of the categories named",
  "question": "Verbatim question",
  "subtopic": "Specific subtopic",
  "frequency": "high|medium|low",
  "sourceType": "reddit|epic_forum|stackoverflow|youtube|tiktok|instagram|udemy|twitch|twitter",
  "sourceTitle": "Title EXACTLY as cited",
  "engagement": "e.g. 45 upvotes"
}, {
  "type": "painPoint",
  "category": "One of the categories named",
  "painPoint": "One-sentence description",
  "sourceTitle": "Title EXACTLY as cited",
  "relevance": "high|medium|low",
  "frequency": "how often"
}]

JSON only — no preamble.

SUMMARY:
${researchResult.text}`;

    const shapeResult = await callGemini(shapePrompt, { useGrounding: false, purpose: "signals-shape" });
    const parsed = parseJSON(shapeResult.text);

    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      console.warn(`    ⚠️ Signals batch [${batch.join(", ")}]: shape pass empty`);
      return { questions: [], painPoints: {} };
    }

    const known = new Set(batch);
    const questions = [];
    const painPoints = {};
    for (const cat of batch) painPoints[cat] = [];

    for (const item of parsed) {
      if (!known.has(item.category)) continue;
      const sourceTitle = item.sourceTitle || item.source_title || "";
      const groundedUri = findGroundedUri(sourceTitle, groundedChunks);
      const verified = Boolean(groundedUri);

      if (item.type === "question") {
        questions.push({
          question: item.question || "",
          category: item.category,
          subtopic: item.subtopic || "",
          frequency: item.frequency || "medium",
          sources: [{
            type: item.sourceType || "unknown",
            url: groundedUri,
            title: sourceTitle,
            date: item.date || "",
            engagement: item.engagement || "",
            verified,
          }],
        });
      } else if (item.type === "painPoint") {
        if (painPoints[item.category].length >= PAIN_POINT_LIMIT) continue;
        painPoints[item.category].push({
          painPoint: item.painPoint || item.pain_point || "",
          sourceUrl: groundedUri,
          sourceTitle,
          relevance: item.relevance || "medium",
          frequency: item.frequency || "",
          verified,
        });
      }
    }

    const ppCount = Object.values(painPoints).flat().length;
    console.log(
      `    ✅ Signals batch [${batch.length} cats]: ${questions.length}q + ${ppCount}p` +
        (groundedChunks.length ? ` (${groundedChunks.length} grounded sources)` : " (0 grounded)")
    );

    return { questions, painPoints };
  } catch (err) {
    console.warn(`  ⚠️ Signals batch [${batch.join(", ")}] failed: ${err.message}`);
    return { questions: [], painPoints: {} };
  }
}

async function scrapeDemandSignals(categories) {
  console.log(
    `\n🔍 Scraping demand signals (questions + pain points) across ${categories.length} categories (batches of ${SIGNALS_PER_BATCH}, ${PARALLEL_CONCURRENCY} in parallel)...`
  );

  const batches = [];
  for (let i = 0; i < categories.length; i += SIGNALS_PER_BATCH) {
    batches.push(categories.slice(i, i + SIGNALS_PER_BATCH));
  }
  const totalBatches = batches.length;

  const allQuestions = [];
  const allPainPoints = {};
  for (const cat of categories) allPainPoints[cat] = [];

  for (let g = 0; g < batches.length; g += PARALLEL_CONCURRENCY) {
    const group = batches.slice(g, g + PARALLEL_CONCURRENCY);

    const promises = group.map(async (batch, idx) => {
      const batchNum = g + idx + 1;
      console.log(`  📦 Batch ${batchNum}/${totalBatches}: ${batch.join(", ")}`);
      return scrapeDemandSignalsBatch(batch);
    });

    const settled = await Promise.allSettled(promises);
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) {
        allQuestions.push(...(r.value.questions || []));
        for (const [cat, items] of Object.entries(r.value.painPoints || {})) {
          if (Array.isArray(items) && items.length > 0) allPainPoints[cat] = items;
        }
      }
    }

    if (g + PARALLEL_CONCURRENCY < batches.length) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
    }
  }

  // Deduplicate questions by their text.
  const seen = new Set();
  const uniqueQuestions = allQuestions.filter((q) => {
    const key = (q.question || "").toLowerCase().trim();
    if (seen.has(key) || !key) return false;
    seen.add(key);
    return true;
  });

  const totalQ = uniqueQuestions.length;
  const totalPP = Object.values(allPainPoints).flat().length;
  console.log(`  ✅ Total: ${totalQ} unique trending questions, ${totalPP} pain points across ${categories.length} categories`);

  return { trendingQuestions: uniqueQuestions, painPointsByCategory: allPainPoints };
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

  const { trendingQuestions, painPointsByCategory } = await scrapeDemandSignals(categories);
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

  logTokenSummary();
  console.log(`\n🏁 Done in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
