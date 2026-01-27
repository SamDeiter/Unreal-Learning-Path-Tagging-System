const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Import utility functions
const { checkRateLimit } = require("../utils/rateLimit");
const { logApiUsage } = require("../utils/apiUsage");

/**
 * Load curated video catalog for RAG context
 * Lazy-loaded on first request to ensure proper Cloud Functions environment
 */
let videoCatalog = null;

function loadVideoCatalog() {
  if (videoCatalog !== null) return videoCatalog;

  try {
    // Try multiple possible paths for Cloud Functions deployment
    const possiblePaths = [
      path.join(__dirname, "../data/video_catalog.json"),
      path.join(__dirname, "../../data/video_catalog.json"),
      path.resolve(__dirname, "../data/video_catalog.json"),
      "/workspace/functions/data/video_catalog.json",
    ];

    for (const catalogPath of possiblePaths) {
      console.log(`[DEBUG] Trying catalog path: ${catalogPath}`);
      if (fs.existsSync(catalogPath)) {
        const data = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
        videoCatalog = data.videos || [];
        console.log(
          `[INFO] Loaded ${videoCatalog.length} curated videos from: ${catalogPath}`,
        );
        return videoCatalog;
      }
    }

    console.warn("[WARN] Video catalog not found at any path");
    videoCatalog = [];
    return videoCatalog;
  } catch (e) {
    console.error("[ERROR] Could not load video catalog:", e.message);
    videoCatalog = [];
    return videoCatalog;
  }
}

/**
 * Build compact video context for Gemini prompt
 * Only include relevant videos based on query keywords
 */
function buildVideoContext(query, maxVideos = 20) {
  const catalog = loadVideoCatalog();
  if (!catalog || catalog.length === 0) {
    console.log("[DEBUG] No videos in catalog, returning null");
    return null;
  }

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);

  // Score videos by relevance
  const scored = catalog.map((video) => {
    let score = 0;
    const titleLower = video.title.toLowerCase();
    const tagsStr = video.tags.join(" ").toLowerCase();

    // Title matches
    for (const word of queryWords) {
      if (titleLower.includes(word)) score += 3;
      if (tagsStr.includes(word)) score += 2;
    }

    // Tag matches
    for (const tag of video.tags) {
      if (queryLower.includes(tag.split(".")[0])) score += 1;
    }

    return { ...video, score };
  });

  // Sort by score and take top N
  const relevant = scored
    .filter((v) => v.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxVideos);

  if (relevant.length === 0) {
    return null; // No relevant videos, use Google Search
  }

  // Build compact context string
  return relevant
    .map(
      (v) =>
        `[${v.id}] "${v.title}" (${Math.round(v.duration / 60)}min) - ${v.tags.join(", ")} - ${v.url}`,
    )
    .join("\n");
}

/**
 * Cloud Function: generateLearningPath
 * Uses HYBRID approach:
 * 1. First, try to match from curated video catalog (RAG)
 * 2. Fall back to Google Search grounding for new/missing content
 *
 * This function:
 * 1. Validates the user is authenticated
 * 2. Implements rate limiting per user
 * 3. Loads relevant videos from catalog
 * 4. Calls Gemini API with server-side key
 * 5. Returns generated learning path
 */

exports.generateLearningPath = functions
  .runWith({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 120,
    memory: "512MB",
  })
  .https.onCall(async (data, context) => {
    // 1. Authentication check (optional for now - allow anonymous)
    const userId = context.auth?.uid || "anonymous";

    const { query, tags = [] } = data;

    // 2. Input validation
    if (!query || query.trim().length < 3) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Query must be at least 3 characters.",
      );
    }

    // 3. Rate limiting check
    const rateLimitCheck = await checkRateLimit(userId, "learningPath");
    if (!rateLimitCheck.allowed) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Rate limit exceeded. ${rateLimitCheck.message}`,
      );
    }

    try {
      // 4. Get API key from Secrets
      let apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        apiKey = functions.config().gemini?.api_key;
      }

      if (!apiKey) {
        console.error("[ERROR] GEMINI_API_KEY secret is not set.");
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Server configuration error: API Key missing.",
        );
      }

      // 5. Build video context from curated catalog
      const videoContext = buildVideoContext(query);
      const hasCuratedVideos = videoContext !== null;

      console.log(
        `[DEBUG] Query: "${query}", Curated videos found: ${hasCuratedVideos}`,
      );

      // 6. Build the prompt for learning path generation
      // HYBRID APPROACH: Prioritize curated catalog, fall back to Google Search
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
    ? `
**PRIORITY 1 - CURATED CATALOG (USE THESE FIRST):**
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
      "action": "1. **Open your Blueprint** and locate the node causing the error\\n2. **Examine the connection** - look at what object is being passed in\\n3. **Check the target type** - ensure it matches what you're casting to\\n4. **Review the execution flow** - trace back to see where the reference comes from",
      "takeaway": "Key insight they should remember",
      "content": [
        {"type": "docs", "title": "Epic Docs: [concept]", "url": "https://dev.epicgames.com/...", "description": "Why this matters"},
        {
          "type": "video",
          "title": "Focused Clip Title",
          "url": "https://youtube.com/watch?v=VIDEO_ID&t=330",
          "thumbnail_url": "https://img.youtube.com/vi/VIDEO_ID/mqdefault.jpg",
          "description": "(5 min) Covers project packaging essentials",
          "duration": "5 min",
          "watch_points": [
            {"time": "0:30", "label": "Asset Preparation", "keywords": ["content browser", "references"]},
            {"time": "2:15", "label": "Project Settings", "keywords": ["build configuration", "target platform"]},
            {"time": "4:00", "label": "Packaging Steps", "keywords": ["cook", "package", "output"]}
          ]
        }
      ]
    },
    {
      "number": 2,
      "type": "diagnose",
      "title": "Find the Cause",
      "description": "How to identify the specific issue",
      "action": "1. **Enable Blueprint debugging** - Right-click the node and select 'Add Breakpoint'\\n2. **Print the object reference** - Add a Print String node to see what's being passed\\n3. **Check if object is valid** - Use an IsValid node before the Cast\\n4. **Test in PIE mode** - Play in editor and trigger the code path",
      "takeaway": "How to diagnose this in future"
    },
    {
      "number": 3,
      "type": "resolve",
      "title": "Fix It",
      "description": "Practical solution with exact steps",
      "action": "1. **Add an IsValid check** before the Cast node\\n2. **Use the Cast Failed exec pin** - Connect it to handle the failure case\\n3. **Store a reference properly** - Create a variable to cache the valid reference\\n4. **Test your fix** - Play the game and verify the error no longer occurs"
    },
    {
      "number": 4,
      "type": "prevent",
      "title": "Prevent Future Issues",
      "description": "Best practices to adopt",
      "action": "1. **Always check IsValid** before using any object reference\\n2. **Use Cast with 'As' suffix** for cleaner code (Cast To PlayerController → GetControlledPawn as PlayerController)\\n3. **Handle both success and failure** - Never leave Cast Failed unconnected\\n4. **Document your assumptions** - Add comments about expected object types",
      "takeaway": "How to never have this problem again"
    }
  ]
}

Use REAL Epic documentation URLs and real YouTube video IDs.`;

      // 6. Call Gemini API
      const model = "gemini-2.0-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: [
          {
            googleSearch: {}, // Enable grounding for real video URLs
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
        },
      };

      console.log("[DEBUG] Calling Gemini API...");

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[ERROR] Gemini API failed: ${response.status} ${response.statusText}`,
          errorText,
        );
        throw new Error(
          `Gemini API error: ${response.status} ${response.statusText}`,
        );
      }

      const responseData = await response.json();
      const generatedText =
        responseData.candidates?.[0]?.content?.parts?.[0]?.text;

      // Extract usage metadata for stats
      const usageMetadata = responseData.usageMetadata || {};
      const inputTokens = usageMetadata.promptTokenCount || 0;
      const outputTokens = usageMetadata.candidatesTokenCount || 0;
      const totalTokens =
        usageMetadata.totalTokenCount || inputTokens + outputTokens;

      // Calculate costs (Gemini 2.0 Flash pricing)
      const inputCost = (inputTokens / 1000000) * 0.075;
      const outputCost = (outputTokens / 1000000) * 0.3;
      const groundingCost = 0.035; // $35/1K queries = $0.035/query
      const totalCost = inputCost + outputCost + groundingCost;

      // Estimate energy consumption
      const energyKwh = (totalTokens / 1000) * 0.005;
      const co2Grams = (totalTokens / 1000) * 0.4;

      const usageStats = {
        inputTokens,
        outputTokens,
        totalTokens,
        inputCost: inputCost.toFixed(6),
        outputCost: outputCost.toFixed(6),
        groundingCost: groundingCost.toFixed(4),
        totalCost: totalCost.toFixed(4),
        energyKwh: energyKwh.toFixed(4),
        co2Grams: co2Grams.toFixed(2),
      };

      console.log(`[DEBUG] Usage stats:`, usageStats);

      if (!generatedText) {
        console.error(
          "[ERROR] No content in Gemini response:",
          JSON.stringify(responseData),
        );
        throw new Error("No content generated from Gemini");
      }

      // 7. Parse JSON from response
      let pathData;
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = generatedText.match(/```json\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : generatedText;
        pathData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("[ERROR] Failed to parse Gemini JSON:", generatedText);
        throw new Error("Failed to parse AI response as JSON");
      }

      // 8. Add metadata
      pathData.path_id = query
        .toLowerCase()
        .replace(/\s+/g, "_")
        .substring(0, 50);
      pathData.query = query;
      pathData.tags = tags || [];
      pathData.generated_at = new Date().toISOString();

      // Ensure steps array exists (defensive check)
      if (!Array.isArray(pathData.steps)) {
        console.error(
          "[ERROR] AI did not return a steps array. Full response:",
          JSON.stringify(pathData),
        );
        pathData.steps = [];
      }

      // Ensure each step has required fields
      pathData.steps = pathData.steps.map((step, index) => ({
        ...step,
        number: step.number || index + 1,
        content: Array.isArray(step.content) ? step.content : [],
      }));

      console.log(`[DEBUG] Returning path with ${pathData.steps.length} steps`);

      // 9. Log usage
      await logApiUsage(userId, {
        model: model,
        type: "learningPath",
        query: query,
      });

      // 10. Cache the path to Firestore for future use
      try {
        const db = admin.firestore();
        await db
          .collection("cached_paths")
          .doc(pathData.path_id)
          .set({
            ...pathData,
            cached_at: admin.firestore.FieldValue.serverTimestamp(),
          });
        console.log("[DEBUG] Cached path to Firestore:", pathData.path_id);
      } catch (cacheError) {
        console.warn("[WARN] Failed to cache path:", cacheError.message);
      }

      return {
        success: true,
        path: pathData,
        usage: usageStats,
      };
    } catch (error) {
      console.error("[ERROR] Error details:", JSON.stringify(error, null, 2));
      throw new functions.https.HttpsError(
        "internal",
        `Failed to generate learning path: ${error.message}`,
      );
    }
  });
