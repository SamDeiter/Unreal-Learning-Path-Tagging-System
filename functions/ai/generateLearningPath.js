const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Import utility functions
const { checkRateLimit } = require("../utils/rateLimit");
const { logApiUsage } = require("../utils/apiUsage");
const { getVideoCatalog } = require("../utils/lazyData");
const { runStage } = require("../pipeline/llmStage");
const { createTrace, isAdmin } = require("../pipeline/telemetry");
const { normalizeQuery } = require("../pipeline/cache");
const { PROMPT_VERSION } = require("../pipeline/promptVersions");

// Hardcoded fallback videos (verified real @UnrealEngine IDs)
const FALLBACK_VIDEOS = [
  { id: "-OyVWhP2ekk", title: "Packaging Your Project in Unreal Engine", tags: ["build", "packaging"], duration: 319, url: "https://www.youtube.com/watch?v=-OyVWhP2ekk" },
  { id: "ARfQ58w31Vs", title: "Package Your Project in Unreal Engine", tags: ["build", "packaging"], duration: 49, url: "https://www.youtube.com/watch?v=ARfQ58w31Vs" },
  { id: "Bpw8LIud3SM", title: "Compiling Your Project in Unreal Engine", tags: ["build", "compile"], duration: 187, url: "https://www.youtube.com/watch?v=Bpw8LIud3SM" },
  { id: "VVpZW4pKafQ", title: "Introduction to Player Blueprints", tags: ["blueprint", "gameplay"], duration: 346, url: "https://www.youtube.com/watch?v=VVpZW4pKafQ" },
  { id: "ZkP4VOOlNbM", title: "Adding Blueprint Components", tags: ["blueprint", "components"], duration: 327, url: "https://www.youtube.com/watch?v=ZkP4VOOlNbM" },
  { id: "TiDo_J4VOFA", title: "Enhanced Input Action Mapping", tags: ["gameplay", "input"], duration: 414, url: "https://www.youtube.com/watch?v=TiDo_J4VOFA" },
  { id: "U4x2AvWnFKw", title: "Building a HUD with UMG", tags: ["ui", "umg"], duration: 57, url: "https://www.youtube.com/watch?v=U4x2AvWnFKw" },
  { id: "7GmEMMJ6v60", title: "Introduction to Unreal Motion Graphics", tags: ["ui", "umg"], duration: 391, url: "https://www.youtube.com/watch?v=7GmEMMJ6v60" },
  { id: "H5jIMq98hRg", title: "Landscape Basics: Getting Started", tags: ["world", "landscape"], duration: 1750, url: "https://www.youtube.com/watch?v=H5jIMq98hRg" },
  { id: "ArdM5qdGi6g", title: "Landscape Basics: Landscape Materials", tags: ["materials", "landscape"], duration: 1318, url: "https://www.youtube.com/watch?v=ArdM5qdGi6g" },
  { id: "W9a6511ZBsc", title: "Adding a Coin Material", tags: ["materials", "beginner"], duration: 291, url: "https://www.youtube.com/watch?v=W9a6511ZBsc" },
  { id: "u7QQztB7JWM", title: "Installing Unreal Engine", tags: ["onboarding", "installation"], duration: 251, url: "https://www.youtube.com/watch?v=u7QQztB7JWM" },
  { id: "EsvfCEtATMk", title: "Navigating the Viewport", tags: ["onboarding", "editor"], duration: 445, url: "https://www.youtube.com/watch?v=EsvfCEtATMk" },
];

/**
 * Phase 8D: Use centralized lazyData for catalog, with fallback
 */
function loadVideoCatalog() {
  const catalog = getVideoCatalog();
  return catalog.length > 0 ? catalog : FALLBACK_VIDEOS;
}

/**
 * Build compact video context for Gemini prompt.
 * Only include relevant videos based on query keywords.
 */
function buildVideoContext(query, maxVideos = 20) {
  const catalog = loadVideoCatalog();
  if (!catalog || catalog.length === 0) return null;

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);

  const scored = catalog.map((video) => {
    let score = 0;
    const titleLower = video.title.toLowerCase();
    const tagsStr = video.tags.join(" ").toLowerCase();

    for (const word of queryWords) {
      if (titleLower.includes(word)) score += 3;
      if (tagsStr.includes(word)) score += 2;
    }
    for (const tag of video.tags) {
      if (queryLower.includes(tag.split(".")[0])) score += 1;
    }
    return { ...video, score };
  });

  const relevant = scored
    .filter((v) => v.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxVideos);

  if (relevant.length === 0) return null;

  return relevant
    .map((v) => `[${v.id}] "${v.title}" (${Math.round(v.duration / 60)}min) - ${v.tags.join(", ")} - ${v.url}`)
    .join("\n");
}

/**
 * Cloud Function: generateLearningPath
 * Uses HYBRID approach:
 * 1. First, try to match from curated video catalog (RAG)
 * 2. Fall back to Google Search grounding for new/missing content
 *
 * Now uses pipeline/llmStage for schema validation + repair retry + caching.
 */
exports.generateLearningPath = functions
  .runWith({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 120,
    memory: "512MB",
  })
  .https.onCall(async (data, context) => {
    const userId = context.auth?.uid || "anonymous";
    const { query, tags = [] } = data;

    if (!query || query.trim().length < 3) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Query must be at least 3 characters."
      );
    }

    const rateLimitCheck = await checkRateLimit(userId, "learningPath");
    if (!rateLimitCheck.allowed) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Rate limit exceeded. ${rateLimitCheck.message}`
      );
    }

    try {
      let apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) apiKey = functions.config().gemini?.api_key;
      if (!apiKey) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Server configuration error: API Key missing."
        );
      }

      const trace = createTrace(userId, "generateLearningPath");
      const normalized = normalizeQuery(query);

      const videoContext = buildVideoContext(query);
      const hasCuratedVideos = videoContext !== null;

      const systemPrompt = `You are an expert UE5 educator creating DIAGNOSTIC learning paths.
Your goal is NOT just to fix symptoms, but to teach developers:
1. WHY this problem occurs (root cause understanding)
2. HOW to fix it (practical resolution)
3. HOW TO PREVENT it in the future (best practices)

CRITICAL RULES:
- Create 4 steps: understand (why it happens), diagnose (identify the cause), resolve (fix it), prevent (best practices)
- Step 1 MUST explain the underlying concept - users should understand WHY the error exists
- Step 4 MUST include prevention strategies and best practices
- Be specific to their ACTUAL problem, not generic advice

CONTENT REQUIREMENTS (MANDATORY):
- EVERY step MUST have a "content" array with at least ONE video
- Epic documentation links are OPTIONAL supplements

VIDEO SELECTION PRIORITY:
${
  hasCuratedVideos
    ? `**PRIORITY 1 - CURATED CATALOG (USE THESE FIRST):**
Below is our curated video database. ALWAYS prefer these verified videos:
${videoContext}

Use the video IDs and URLs exactly as shown. These are verified to exist.
`
    : ""
}
**${hasCuratedVideos ? "PRIORITY 2 - " : ""}GOOGLE SEARCH (for topics not in catalog):**
- If no curated video matches, use Google Search to find NEW videos from @UnrealEngine
- Search for "@UnrealEngine" + topic keywords to find official tutorial videos
- Extract the REAL video ID from the YouTube URL found in search results
- ALWAYS include thumbnail_url using format: https://img.youtube.com/vi/VIDEO_ID/mqdefault.jpg
- Format video URL as: https://youtube.com/watch?v=VIDEO_ID&t=START_SECONDS

IMPORTANT: Prefer curated catalog videos. Only use Google Search for topics not covered.`;

      const userPrompt = `Create an EDUCATIONAL learning path for: "${query}"

${tags.length > 0 ? `Context tags: ${tags.join(", ")}` : ""}

This developer has a specific problem. Your learning path should:
1. UNDERSTAND: Explain the underlying UE5 concept and WHY this error/issue occurs
2. DIAGNOSE: Help them identify the specific cause in THEIR project
3. RESOLVE: Step-by-step fix with practical actions
4. PREVENT: Best practices so this NEVER happens again

Return JSON:
{
  "title": "Learning Path: [problem]",
  "ai_summary": "WHY this happens in plain language",
  "ai_root_cause": "The fundamental reason this occurs",
  "ai_what_you_learn": ["concept 1", "skill 2", "prevention technique"],
  "ai_estimated_time": "X-Y minutes",
  "ai_difficulty": "Beginner/Intermediate/Advanced",
  "ai_hint": "Quick prevention tip they can apply immediately",
  "steps": [
    {
      "number": 1,
      "type": "understand",
      "title": "Why This Happens",
      "description": "The underlying concept explained in detail",
      "action": "1. **Open your Blueprint**...",
      "takeaway": "Key insight they should remember",
      "content": [
        {"type": "video", "title": "Focused Clip Title", "url": "https://youtube.com/watch?v=VIDEO_ID&t=330", "thumbnail_url": "https://img.youtube.com/vi/VIDEO_ID/mqdefault.jpg", "description": "(5 min) Covers essentials"}
      ]
    }
  ]
}

Use REAL Epic documentation URLs and real YouTube video IDs.`;

      const result = await runStage({
        stage: "learning_path",
        systemPrompt,
        userPrompt,
        apiKey,
        trace,
        cacheParams: { query: normalized, mode: "onboarding", tags: tags.slice(0, 5) },
        maxTokens: 8192,
        tools: [{ googleSearch: {} }], // Enable grounding for real video URLs
      });

      trace.toLog();

      if (!result.success) {
        throw new functions.https.HttpsError(
          "internal",
          "Failed to generate valid learning path after repair retry."
        );
      }

      const pathData = result.data;

      // Add metadata
      pathData.path_id = query.toLowerCase().replace(/\s+/g, "_").substring(0, 50);
      pathData.query = query;
      pathData.tags = tags || [];
      pathData.generated_at = new Date().toISOString();
      pathData.prompt_version = PROMPT_VERSION;

      // Ensure steps array exists (defensive check)
      if (!Array.isArray(pathData.steps)) {
        pathData.steps = [];
      }

      // Ensure each step has required fields
      pathData.steps = pathData.steps.map((step, index) => ({
        ...step,
        number: step.number || index + 1,
        content: Array.isArray(step.content) ? step.content : [],
      }));

      // Log usage
      await logApiUsage(userId, {
        model: "gemini-2.0-flash",
        type: "learningPath",
        query: query,
      });

      // Cache the path to Firestore
      try {
        const db = admin.firestore();
        await db.collection("cached_paths").doc(pathData.path_id).set({
          ...pathData,
          cached_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (cacheError) {
        console.warn(JSON.stringify({ severity: "WARNING", message: "path_cache_error", error: cacheError.message }));
      }

      const response = {
        success: true,
        path: pathData,
        prompt_version: PROMPT_VERSION,
      };

      if (data.debug === true && isAdmin(context)) {
        response._debug = trace.toDebugPayload();
      }

      return response;
    } catch (error) {
      console.error(JSON.stringify({ severity: "ERROR", message: "learning_path_error", error: error.message }));
      if (error.code) throw error;
      throw new functions.https.HttpsError(
        "internal",
        `Failed to generate learning path: ${error.message}`
      );
    }
  });
