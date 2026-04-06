/**
 * generateSpoke.js — Spoke Generator Cloud Function
 *
 * When a user has a "knowledge gap" in their learning path, this function:
 * 1. Embeds the gap topic into a 768-dim vector
 * 2. Performs KNN search against segment_embeddings in Firestore
 * 3. Feeds top transcript chunks to Gemini for synthesis
 * 4. Returns a structured mini-lesson (title, notes, featured video, quiz)
 *
 * Usage: Called from the frontend "Fill This Gap" button in PathIntelligencePanel
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { checkRateLimit, checkGlobalRateLimit } = require("../utils/rateLimit");
const { requireAuth } = require("../utils/authGuard");
const { logApiUsage } = require("../utils/apiUsage");
const { sanitizeAndValidate } = require("../utils/sanitizeInput");

const db = admin.firestore();

// ── Config ──────────────────────────────────────────────────────────────
const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIMENSION = 768;
const SYNTH_MODEL = "gemini-2.0-flash";

const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;
const SYNTH_URL = `https://generativelanguage.googleapis.com/v1beta/models/${SYNTH_MODEL}:generateContent`;

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Embed a text query into a 768-dim vector using Gemini.
 */
async function embedText(text, apiKey) {
  const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
  const url = `${EMBED_URL}?key=${apiKey}`;

  const payload = {
    model: `models/${EMBED_MODEL}`,
    content: { parts: [{ text }] },
    taskType: "RETRIEVAL_QUERY",
    outputDimensionality: EMBED_DIMENSION,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.error(`[generateSpoke] Embed error ${response.status}:`, errText.substring(0, 200));
    throw new HttpsError("internal", "Failed to embed gap topic");
  }

  const result = await response.json();
  const embedding = result?.embedding?.values;

  if (!embedding || embedding.length !== EMBED_DIMENSION) {
    throw new HttpsError("internal", "Invalid embedding response");
  }

  return embedding;
}

/**
 * Perform KNN vector search against a Firestore collection.
 */
async function vectorSearch(collectionName, queryVector, topK = 8) {
  const collRef = db.collection(collectionName);

  const snapshot = await collRef
    .findNearest({
      vectorField: "embedding",
      queryVector: FieldValue.vector(queryVector),
      limit: topK,
      distanceMeasure: "COSINE",
      distanceResultField: "vector_distance",
    })
    .get();

  const results = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    // eslint-disable-next-line no-unused-vars
    const { embedding: _embedding, vector_distance: rawDist, ...metadata } = data;
    const similarity = rawDist !== null && rawDist !== undefined ? 1 - rawDist : 0;
    results.push({ id: doc.id, similarity, ...metadata });
  });

  return results;
}

/**
 * Call Gemini to synthesize a mini-lesson from transcript chunks.
 */
async function synthesizeLesson(gapTopic, difficulty, chunks, apiKey) {
  const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
  const url = `${SYNTH_URL}?key=${apiKey}`;

  // Build context from retrieved chunks
  const chunkContext = chunks
    .map((c, i) => {
      const videoInfo = c.video_id
        ? `[Video: ${c.video_id}, ${c.start_time || 0}s - ${c.end_time || 0}s]`
        : `[Source: ${c.title || c.id}]`;
      return `--- Chunk ${i + 1} ${videoInfo} (similarity: ${c.similarity?.toFixed(3)}) ---\n${c.text}`;
    })
    .join("\n\n");

  const systemPrompt = `You are an expert Unreal Engine 5 instructor creating a focused mini-lesson.
Your task: synthesize the provided transcript chunks into a clear, concise lesson about "${gapTopic}".
Target audience: ${difficulty} level learners.

IMPORTANT: Return ONLY a valid JSON object matching this exact schema (no markdown, no code fences):
{
  "lesson_title": "A clear, engaging title for this mini-lesson",
  "intro_script": "A 2-sentence conversational intro that a TTS voice could read naturally",
  "markdown_notes": "Well-formatted Markdown notes (use ## headings, bullet points, bold for key terms). Keep it focused and actionable. 300-500 words max.",
  "featured_video": {
    "video_id": "The YouTube video ID of the BEST single chunk to watch",
    "start_seconds": 0,
    "end_seconds": 0,
    "video_title": "Title of the video"
  },
  "quiz_questions": [
    {
      "question": "A clear question testing understanding",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}

Rules:
- featured_video MUST reference a real video_id from the chunks provided
- Generate exactly 2-3 quiz questions
- markdown_notes should synthesize, not just repeat the chunks
- If chunks don't have video_id, use the source title instead and set video_id to null`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${systemPrompt}\n\n## Retrieved Transcript Chunks\n\n${chunkContext}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.error(`[generateSpoke] Synth error ${response.status}:`, errText.substring(0, 300));
    throw new HttpsError("internal", "Failed to generate lesson content");
  }

  const result = await response.json();
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new HttpsError("internal", "Empty response from Gemini");
  }

  try {
    return JSON.parse(text);
  } catch (parseErr) {
    logger.error("[generateSpoke] JSON parse error:", text.substring(0, 200));
    throw new HttpsError("internal", "Failed to parse lesson JSON");
  }
}

// ── Main Cloud Function ────────────────────────────────────────────────

exports.generateSpoke = onCall(
  {
    region: "us-central1",
    maxInstances: 5,
    timeoutSeconds: 60,
    memory: "512MiB",
    minInstances: 0,
    secrets: ["GEMINI_API_KEY"],
  },
  async (request) => {
    // App Check enforcement (permissive during rollout)
    requireAppCheck(request, { allowInvalid: false });
    // 1. Auth check
    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "You must be signed in to generate content");
    }

    // 2. Rate limit
    const rateLimitCheck = await checkRateLimit(userId, "generation");
    if (!rateLimitCheck.allowed) {
      throw new HttpsError("resource-exhausted", `Rate limit exceeded. ${rateLimitCheck.message}`);
    }
    const globalCheck = await checkGlobalRateLimit(userId);
    if (!globalCheck.allowed) {
      throw new HttpsError("resource-exhausted", `${globalCheck.message}`);
    }

    // 3. Input validation
    const { gapTopic, difficulty = "intermediate", pathContext = "" } = request.data;

    if (!gapTopic || typeof gapTopic !== "string") {
      throw new HttpsError("invalid-argument", "gapTopic is required");
    }

    const validation = sanitizeAndValidate(gapTopic, 500);
    if (validation.blocked) {
      throw new HttpsError("invalid-argument", `Invalid input: ${validation.reason}`);
    }

    const cleanTopic = validation.clean;

    // 4. Check cache first
    const cacheKey = `${cleanTopic.toLowerCase().trim()}_${difficulty}`;
    const cacheHash = require("crypto").createHash("sha256").update(cacheKey).digest("hex").slice(0, 16);
    const cacheRef = db.collection("spoke_cache").doc(cacheHash);
    const cached = await cacheRef.get();

    if (cached.exists) {
      const cacheData = cached.data();
      // Use cache if less than 7 days old
      const cacheAge = Date.now() - (cacheData.created_at?.toMillis() || 0);
      if (cacheAge < 7 * 24 * 60 * 60 * 1000) {
        logger.info(`[generateSpoke] Cache hit for "${cleanTopic}"`);
        logApiUsage(userId, { type: "generation", function: "generateSpoke", cached: true });
        return { ...cacheData.spoke, cached: true };
      }
    }

    // 5. Get API key
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const functions = require("firebase-functions");
const { logger } = require("firebase-functions");
const { requireAppCheck } = require("../utils/appCheckMiddleware");
      apiKey = functions.config().gemini?.api_key;
    }
    if (!apiKey) {
      throw new HttpsError("internal", "Gemini API key not configured");
    }

    // 6. Embed the gap topic
    logger.info(`[generateSpoke] Embedding topic: "${cleanTopic}"`);
    const queryVector = await embedText(
      `Unreal Engine 5 tutorial about: ${cleanTopic}. Difficulty: ${difficulty}. ${pathContext}`,
      apiKey
    );

    // 7. Vector search — search both segments and epic embeddings
    logger.info("[generateSpoke] Searching segment_embeddings...");
    const [segmentResults, epicResults] = await Promise.all([
      vectorSearch("segment_embeddings", queryVector, 5),
      vectorSearch("epic_embeddings", queryVector, 3),
    ]);

    // Merge and sort by similarity
    const allResults = [...segmentResults, ...epicResults]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 8);

    if (allResults.length === 0) {
      throw new HttpsError("not-found", "No relevant content found for this topic");
    }

    logger.info(`[generateSpoke] Found ${allResults.length} relevant chunks (top sim: ${allResults[0].similarity.toFixed(3)})`);

    // 8. Gemini synthesis
    logger.info("[generateSpoke] Synthesizing lesson with Gemini...");
    const lesson = await synthesizeLesson(cleanTopic, difficulty, allResults, apiKey);

    // 9. Build response
    const spoke = {
      lesson_title: lesson.lesson_title || `Learning: ${cleanTopic}`,
      intro_script: lesson.intro_script || "",
      markdown_notes: lesson.markdown_notes || "",
      featured_video: lesson.featured_video || null,
      quiz_questions: lesson.quiz_questions || [],
      tts_audio_url: null, // TTS placeholder — future implementation
      source_chunks: allResults.length,
      difficulty,
      generated_at: new Date().toISOString(),
    };

    // 10. Cache the result
    await cacheRef.set({
      spoke,
      topic: cleanTopic,
      difficulty,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      user_id: userId,
    });

    logApiUsage(userId, {
      type: "generation",
      function: "generateSpoke",
      firestoreReads: 18,
      firestoreWrites: 2,
    });

    logger.info(`[generateSpoke] Done! "${spoke.lesson_title}"`);
    return { ...spoke, cached: false };
  }
);
