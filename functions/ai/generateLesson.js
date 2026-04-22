/**
 * generateLesson.js — Composite lesson generator.
 *
 * Orchestrates existing teaching assets (diagnosis, objectives, spoke, takeaways,
 * interactive widget) into a single lesson payload and persists it under
 * users/{uid}/lessons/{lessonId}.
 *
 * NOTE: This function does NOT call the existing callables over HTTP. It invokes
 * the same Gemini synthesis logic the callables use, to keep latency low and to
 * avoid re-running App Check / auth / rate limit middleware per sub-call.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const functionsV1 = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

const { checkRateLimit, checkGlobalRateLimit } = require("../utils/rateLimit");
const { logApiUsage } = require("../utils/apiUsage");
const { sanitizeAndValidate } = require("../utils/sanitizeInput");
const { requireAppCheck } = require("../utils/appCheckMiddleware");
const { runStage } = require("../pipeline/llmStage");
const { createTrace } = require("../pipeline/telemetry");
const { normalizeQuery } = require("../pipeline/cache");
const { wrapEvidence } = require("../pipeline/promptVersions");

const { readSkillState, buildSkillStateSnippet } = require("./skillStateReader");
const { UE5_GUARDRAIL, INTERACTIVE_WIDGET_HTML_PROMPT } = require("./prompts");

const db = admin.firestore();

const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIMENSION = 768;
const SYNTH_MODEL = "gemini-2.0-flash";
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;
const SYNTH_URL = `https://generativelanguage.googleapis.com/v1beta/models/${SYNTH_MODEL}:generateContent`;

const WIDGET_TIMEOUT_MS = 25000;
const SPOKE_EMBED_TIMEOUT_MS = 10000;
const SPOKE_SYNTH_TIMEOUT_MS = 30000;

function getApiKey() {
  let key = process.env.GEMINI_API_KEY;
  if (!key) key = functionsV1.config().gemini?.api_key;
  return key || null;
}

function fetchDynamic(...args) {
  return import("node-fetch").then(({ default: f }) => f(...args));
}

function stripWidgetFences(raw) {
  if (!raw || typeof raw !== "string") return null;
  let out = raw.trim();
  out = out.replace(/^```(?:html|HTML)?\s*\n?/, "");
  out = out.replace(/\n?```\s*$/, "");
  out = out.trim();
  const firstDiv = out.indexOf("<div");
  if (firstDiv > 0) out = out.slice(firstDiv);
  const lastClose = out.lastIndexOf("</div>");
  if (lastClose !== -1) out = out.slice(0, lastClose + "</div>".length);
  if (!out.startsWith("<div")) return null;
  if (/<script[^>]*\bsrc\s*=/.test(out)) return null;
  if (/<link[^>]*\brel\s*=\s*["']?stylesheet/i.test(out)) return null;
  return out;
}

async function embedQueryVector(text, apiKey) {
  const resp = await fetchDynamic(`${EMBED_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: EMBED_DIMENSION,
    }),
    signal: AbortSignal.timeout(SPOKE_EMBED_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`embed_failed_${resp.status}`);
  const body = await resp.json();
  const vec = body?.embedding?.values;
  if (!vec || vec.length !== EMBED_DIMENSION) throw new Error("embed_invalid");
  return vec;
}

async function knn(collectionName, vector, topK) {
  const snap = await db
    .collection(collectionName)
    .findNearest({
      vectorField: "embedding",
      queryVector: FieldValue.vector(vector),
      limit: topK,
      distanceMeasure: "COSINE",
      distanceResultField: "vector_distance",
    })
    .get();
  const out = [];
  snap.forEach((doc) => {
    const data = doc.data();
    // eslint-disable-next-line no-unused-vars
    const { embedding: _e, vector_distance: d, ...meta } = data;
    const sim = d !== null && d !== undefined ? 1 - d / 2 : 0;
    out.push({ id: doc.id, similarity: sim, ...meta });
  });
  return out;
}

function buildChunkContext(chunks) {
  return chunks
    .map((c, i) => {
      const loc = c.video_id
        ? `[Video ${c.video_id} ${c.start_time || 0}-${c.end_time || 0}s]`
        : `[Source: ${c.title || c.id}]`;
      return `--- Chunk ${i + 1} ${loc} (sim: ${(c.similarity || 0).toFixed(3)}) ---\n${c.text || ""}`;
    })
    .join("\n\n");
}

async function runSpoke(topic, learnerLevel, apiKey) {
  const vec = await embedQueryVector(
    `Unreal Engine 5 tutorial about: ${topic}. Difficulty: ${learnerLevel}.`,
    apiKey
  );
  const [seg, epic] = await Promise.all([
    knn("segment_embeddings", vec, 5).catch(() => []),
    knn("epic_embeddings", vec, 3).catch(() => []),
  ]);
  const chunks = [...seg, ...epic].sort((a, b) => b.similarity - a.similarity).slice(0, 8);
  if (chunks.length === 0) return null;

  const systemPrompt = `You are an expert Unreal Engine 5 instructor creating a focused mini-lesson.
Synthesize the provided transcript chunks into a clear lesson about "${topic}".
Target audience: ${learnerLevel}.

Return ONLY valid JSON (no markdown, no fences) matching:
{
  "lesson_title": "str",
  "intro_script": "str",
  "markdown_notes": "markdown str, 300-500 words",
  "featured_video": { "video_id": "str|null", "start_seconds": 0, "end_seconds": 0, "video_title": "str" },
  "deep_dive_sections": [ { "title": "str", "content": "str", "type": "properties|pitfalls|tryit|concept" } ],
  "quiz_questions": [ { "question": "str", "options": ["A","B","C","D"], "correct_index": 0, "explanation": "str" } ]
}
Rules:
- featured_video.video_id must reference a real video_id from the chunks (or null).
- Generate exactly 3 deep_dive_sections and 2-3 quiz_questions.`;

  const resp = await fetchDynamic(`${SYNTH_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\n## Chunks\n\n${buildChunkContext(chunks)}` }] },
      ],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    }),
    signal: AbortSignal.timeout(SPOKE_SYNTH_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`spoke_synth_failed_${resp.status}`);
  const body = await resp.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("spoke_empty_response");
  const parsed = JSON.parse(text);

  return {
    lesson_title: parsed.lesson_title || `Learning: ${topic}`,
    notes: parsed.markdown_notes || "",
    featured_video: parsed.featured_video || null,
    deep_dive_sections: Array.isArray(parsed.deep_dive_sections) ? parsed.deep_dive_sections : [],
    quiz_questions: Array.isArray(parsed.quiz_questions) ? parsed.quiz_questions : [],
    source_chunks: chunks.length,
  };
}

async function runDiagnosis({ query, learnerBlock, apiKey, trace, normalized }) {
  const result = await runStage({
    stage: "diagnosis",
    systemPrompt:
      UE5_GUARDRAIL +
      `UE5 expert. Diagnose UE5 problems with specific settings and Editor workflows. Teach WHY the problem occurs, not just the fix.${learnerBlock}
JSON:{"diagnosis_id":"diag_<uuid>","problem_summary":"str","root_causes":["str"],"signals_to_watch_for":["str"],"scope":["str"],"cited_sources":[{"ref":"int","detail":"str"}]}`,
    userPrompt: `Problem: ${query}`,
    apiKey,
    trace,
    cacheParams: { query: normalized, mode: "lesson_diagnosis" },
    maxTokens: 1024,
  });
  if (!result.success) return null;
  const d = result.data || {};
  return {
    problem_summary: d.problem_summary || "",
    root_causes: Array.isArray(d.root_causes) ? d.root_causes : [],
    signals_to_watch_for: Array.isArray(d.signals_to_watch_for) ? d.signals_to_watch_for : [],
    scope: Array.isArray(d.scope)
      ? d.scope
      : Array.isArray(d.generalization_scope)
      ? d.generalization_scope
      : [],
  };
}

async function runObjectives({ query, diagnosis, apiKey, trace, normalized }) {
  if (!diagnosis) return null;
  const result = await runStage({
    stage: "objectives",
    systemPrompt:
      UE5_GUARDRAIL +
      `Create UE5 learning objectives. MUST include >=1 transferable skill (anti-tutorial-hell).
JSON:{"fix_specific":["str"],"transferable":["str"]}`,
    userPrompt: `Problem:${String(query).slice(0, 200)}\nCauses:${(diagnosis.root_causes || []).slice(0, 3).join(";")}`,
    apiKey,
    trace,
    cacheParams: { query: normalized, mode: "lesson_objectives" },
  });
  if (!result.success) return null;
  const d = result.data || {};
  return {
    fix_specific: Array.isArray(d.fix_specific) ? d.fix_specific : [],
    transferable: Array.isArray(d.transferable) ? d.transferable : [],
  };
}

async function runTakeaways({ query, topic, apiKey }) {
  const prompt = `You are a UE5 instructor highlighting 3 key takeaways for a learner.
The learner asked: "${query}"
Topic: "${topic}"
Generate exactly 3 actionable takeaways. Each:
- One concise sentence (<20 words)
- Contains a verb like open, set, add, navigate, click, enable, create, or check
- References Blueprint workflows / editor UI, not C++ syntax
- No emojis, no markdown
Return ONLY a JSON array of 3 strings.`;

  const resp = await fetchDynamic(`${SYNTH_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`takeaways_failed_${resp.status}`);
  const body = await resp.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  const arr = JSON.parse(match[0].replace(/,\s*([\]}])/g, "$1"));
  if (!Array.isArray(arr)) return null;
  return arr.slice(0, 3).map((s) => String(s));
}

async function runWidget({ topic, diagnosis, objectives, learnerLevel, apiKey }) {
  const objectiveList = [
    ...((objectives && objectives.fix_specific) || []),
    ...((objectives && objectives.transferable) || []),
  ];
  const prompt = INTERACTIVE_WIDGET_HTML_PROMPT({
    topic,
    problem_summary: diagnosis?.problem_summary || "",
    objectives: objectiveList,
    learnerLevel,
  });

  const resp = await fetchDynamic(`${SYNTH_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 6144,
      },
    }),
    signal: AbortSignal.timeout(WIDGET_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`widget_failed_${resp.status}`);
  const body = await resp.json();
  const raw = body?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return stripWidgetFences(raw);
}

function inferLearnerLevel(state) {
  if (!state || !state.skillState) return "intermediate";
  const levels = Object.values(state.skillState)
    .map((v) => (v && typeof v.level === "string" ? v.level : null))
    .filter(Boolean);
  if (levels.length === 0) return "intermediate";
  const counts = { beginner: 0, intermediate: 0, advanced: 0 };
  for (const l of levels) if (counts[l] !== undefined) counts[l] += 1;
  let top = "intermediate";
  let max = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > max) { max = v; top = k; }
  }
  return top;
}

async function settledValue(promise) {
  try {
    return await promise;
  } catch (err) {
    return { __error: err && err.message ? err.message : String(err) };
  }
}

exports.generateLesson = onCall(
  {
    region: "us-central1",
    maxInstances: 5,
    timeoutSeconds: 120,
    memory: "1GiB",
    minInstances: 0,
    secrets: ["GEMINI_API_KEY"],
  },
  async (request) => {
    requireAppCheck(request, { allowInvalid: false });

    const userId = request.auth?.uid;
    if (!userId) throw new HttpsError("unauthenticated", "You must be signed in to generate a lesson");

    const rl = await checkRateLimit(userId, "generation");
    if (!rl.allowed) throw new HttpsError("resource-exhausted", `Rate limit exceeded. ${rl.message}`);
    const gl = await checkGlobalRateLimit(userId);
    if (!gl.allowed) throw new HttpsError("resource-exhausted", `${gl.message}`);

    const { query: rawQuery, sessionId = null, engine = "UE5" } = request.data || {};
    if (!rawQuery || typeof rawQuery !== "string") {
      throw new HttpsError("invalid-argument", "query is required");
    }
    const validation = sanitizeAndValidate(rawQuery, 1000);
    if (validation.blocked) {
      throw new HttpsError("invalid-argument", `Invalid input: ${validation.reason}`);
    }
    const query = validation.clean;
    const normalized = normalizeQuery(query);

    const apiKey = getApiKey();
    if (!apiKey) throw new HttpsError("failed-precondition", "Server configuration error: API Key missing.");

    const trace = createTrace(userId, "generateLesson");
    const learnerState = await readSkillState(userId);
    const learnerSnippet = buildSkillStateSnippet(learnerState);
    const learnerBlock = learnerSnippet ? `\n\nLEARNER CONTEXT:\n${learnerSnippet}\n` : "";
    const learnerLevel = inferLearnerLevel(learnerState);

    const topic = query;

    const diagnosisPromise = runDiagnosis({ query, learnerBlock, apiKey, trace, normalized });
    const spokePromise = runSpoke(topic, learnerLevel, apiKey);
    const takeawaysPromise = runTakeaways({ query, topic, apiKey });

    const diagnosisSettled = await settledValue(diagnosisPromise);
    const diagnosis = diagnosisSettled && !diagnosisSettled.__error ? diagnosisSettled : null;

    const [objectivesSettled, spokeSettled, takeawaysSettled, widgetSettled] = await Promise.all([
      settledValue(runObjectives({ query, diagnosis, apiKey, trace, normalized })),
      settledValue(spokePromise),
      settledValue(takeawaysPromise),
      settledValue(
        runWidget({
          topic,
          diagnosis,
          objectives: null,
          learnerLevel,
          apiKey,
        })
      ),
    ]);

    const objectives =
      objectivesSettled && !objectivesSettled.__error ? objectivesSettled : null;
    const spoke = spokeSettled && !spokeSettled.__error ? spokeSettled : null;
    const takeaways =
      takeawaysSettled && Array.isArray(takeawaysSettled) && !takeawaysSettled.__error
        ? takeawaysSettled
        : null;
    const widgetHtml =
      widgetSettled && typeof widgetSettled === "string" && !widgetSettled.__error
        ? widgetSettled
        : null;

    const lesson = {
      query,
      topic,
      diagnosis: diagnosis
        ? {
            problem_summary: diagnosis.problem_summary,
            root_causes: diagnosis.root_causes,
            signals_to_watch_for: diagnosis.signals_to_watch_for,
            scope: diagnosis.scope,
          }
        : null,
      objectives: objectives
        ? {
            fix_specific: objectives.fix_specific,
            transferable: objectives.transferable,
          }
        : null,
      concept: spoke
        ? {
            notes: spoke.notes,
            featuredVideo: spoke.featured_video,
            deepDiveSections: spoke.deep_dive_sections,
          }
        : null,
      takeaways: takeaways || null,
      quiz: spoke && Array.isArray(spoke.quiz_questions) && spoke.quiz_questions.length > 0
        ? {
            questions: spoke.quiz_questions.map((q) => ({
              q: q.question,
              options: Array.isArray(q.options) ? q.options : [],
              correctIndex: Number.isFinite(q.correct_index) ? q.correct_index : 0,
              explanation: q.explanation || "",
            })),
          }
        : null,
      widgetHtml,
      generatedAt: new Date().toISOString(),
      engine,
    };

    let lessonId = null;
    try {
      const lessonsRef = db.collection("users").doc(userId).collection("lessons");
      const ref = lessonsRef.doc();
      lessonId = ref.id;
      await ref.set({
        ...lesson,
        sessionId: sessionId || null,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.warn(
        JSON.stringify({
          severity: "WARNING",
          message: "lesson_persist_failed",
          error: err.message,
        })
      );
    }

    trace.toLog();

    logApiUsage(userId, {
      model: SYNTH_MODEL,
      type: "generateLesson",
      query: query.substring(0, 80),
      hasDiagnosis: !!diagnosis,
      hasObjectives: !!objectives,
      hasConcept: !!spoke,
      hasTakeaways: !!takeaways,
      hasWidget: !!widgetHtml,
      firestoreReads: 3,
      firestoreWrites: 1,
    }).catch(() => {});

    return {
      success: true,
      sessionId: sessionId || null,
      lessonId,
      lesson,
    };
  }
);

// Exported for unit tests / internal reuse.
exports._internal = { stripWidgetFences, inferLearnerLevel };

// Silence unused-warning for wrapEvidence (kept for parity with related handlers
// in case this file is extended to include grounded evidence blocks).
void wrapEvidence;
