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
const { readLatestFeedback, buildAffectiveDirective } = require("./feedbackReader");
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

async function runSpoke(topic, learnerLevel, apiKey, bandDirectives = {}) {
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

  // Render affective directive AFTER depth/difficulty — it is more specific
  // than mean-mastery banding and should therefore override when it applies.
  const directiveBlock = composeSpokePromptDirectives(bandDirectives);

  const systemPrompt = `You are an expert Unreal Engine 5 instructor creating a focused mini-lesson.
Synthesize the provided transcript chunks into a clear lesson about "${topic}".
Target audience: ${learnerLevel}.${directiveBlock}

Return ONLY valid JSON (no markdown, no fences) matching:
{
  "lesson_title": "str",
  "intro_script": "str",
  "markdown_notes": "markdown str, 300-500 words",
  "featured_video": { "video_id": "str|null", "start_seconds": 0, "end_seconds": 0, "video_title": "str" },
  "deep_dive_sections": [ { "title": "str", "content": "str", "type": "properties|pitfalls|tryit|concept" } ],
  "quiz_questions": [ { "question": "str", "options": ["A","B","C","D"], "correct_index": 0, "explanations": ["str","str","str","str"] } ]
}
Rules:
- featured_video.video_id must reference a real video_id from the chunks (or null).
- Generate exactly 3 deep_dive_sections and 2-3 quiz_questions.
- Each quiz question MUST have exactly 4 options and an "explanations" array of exactly 4 strings, one per option (aligned by index).
- For the correct option, the explanation should reinforce the correct mental model.
- For each incorrect option, the explanation should address WHY that choice is tempting (the likely misconception) and point to the correct mental model.
- Keep each explanation to 1-3 sentences. No markdown, no fences.`;

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

async function runDiagnosis({ query, learnerBlock, affectiveBlock = "", apiKey, trace, normalized }) {
  const result = await runStage({
    stage: "diagnosis",
    systemPrompt:
      UE5_GUARDRAIL +
      `UE5 expert. Diagnose UE5 problems with specific settings and Editor workflows. Teach WHY the problem occurs, not just the fix. If an AFFECTIVE SIGNAL block is present, treat it as the highest-priority directive for this response — it overrides depth/difficulty defaults.${affectiveBlock}${learnerBlock}
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

/**
 * Phase 2B/2C — ZPD helpers.
 *
 * Compute the mean PFA mastery across a set of skill tags, ignoring tags the
 * learner has never attempted (opportunities === 0). No-data is not the same
 * as low mastery — new tags get default treatment, not "struggling" treatment.
 *
 * @param {Object} skillState  per-user skillState map from readSkillState
 * @param {string[]} tags      lesson-level skillTags
 * @returns {{ mean: number|null, sampled: number }}
 *   mean: null when no tag has opportunities > 0, otherwise mean mastery in [0,1]
 *   sampled: count of tags contributing to the mean
 */
function computeMeanMastery(skillState, tags) {
  if (!skillState || typeof skillState !== "object") return { mean: null, sampled: 0 };
  if (!Array.isArray(tags) || tags.length === 0) return { mean: null, sampled: 0 };
  let sum = 0;
  let n = 0;
  for (const tag of tags) {
    if (typeof tag !== "string" || tag.length === 0) continue;
    const entry = skillState[tag];
    if (!entry || typeof entry !== "object") continue;
    const opp = Number.isFinite(entry.opportunities) ? entry.opportunities : 0;
    if (opp <= 0) continue;
    const m = Number.isFinite(entry.mastery) ? entry.mastery : 0;
    sum += m;
    n += 1;
  }
  if (n === 0) return { mean: null, sampled: 0 };
  return { mean: sum / n, sampled: n };
}

/**
 * Classify mean mastery into a depth band for fade logic (Phase 2B).
 *   >= 0.75  -> known      (compress recap, skip prereq primer)
 *   >= 0.30  -> typical    (default)
 *   <  0.30  -> struggling (expand scaffolding, add prereq primer)
 *   null     -> typical    (no-data default for new learners)
 */
function classifyDepthBand(mean) {
  if (mean === null || mean === undefined || !Number.isFinite(mean)) return "typical";
  if (mean >= 0.75) return "known";
  if (mean < 0.3) return "struggling";
  return "typical";
}

/**
 * Classify mean mastery into a quiz difficulty band (Phase 2C).
 *   >= 0.75  -> hard
 *   >= 0.30  -> medium
 *   <  0.30  -> easy
 *   null     -> medium (default)
 */
function classifyDifficultyBand(mean) {
  if (mean === null || mean === undefined || !Number.isFinite(mean)) return "medium";
  if (mean >= 0.75) return "hard";
  if (mean < 0.3) return "easy";
  return "medium";
}

/**
 * Directive text injected into the Gemini spoke prompt for fade logic.
 * "typical" returns "" — keeps current prompt behavior unchanged.
 */
function depthDirective(band, mean) {
  const m = Number.isFinite(mean) ? mean.toFixed(2) : null;
  if (band === "known") {
    return `FADE DIRECTIVE: The learner has demonstrated mastery of these topics${
      m ? ` (mean mastery ${m})` : ""
    }. Keep the deep dive concise — assume familiarity with fundamentals. Skip prerequisite explainers. Focus on edge cases and advanced nuance.`;
  }
  if (band === "struggling") {
    return `FADE DIRECTIVE: The learner is struggling with these topics${
      m ? ` (mean mastery ${m})` : ""
    }. Include a brief prerequisite primer before the deep dive. Use simpler language. Surface common misconceptions early.`;
  }
  return "";
}

/**
 * Compose the spoke-prompt header lines for depth/difficulty/affective
 * directives. Exposed for unit tests — asserts that the affective directive
 * renders AFTER depth/difficulty so it lexically overrides those bands in the
 * model's instruction stack.
 *
 * @param {{depth?:string, difficulty?:string, affective?:string}} bandDirectives
 * @returns {string}
 */
function composeSpokePromptDirectives(bandDirectives = {}) {
  const depthLine = bandDirectives.depth ? `\n\n${bandDirectives.depth}` : "";
  const difficultyLine = bandDirectives.difficulty ? `\n\n${bandDirectives.difficulty}` : "";
  const affectiveLine = bandDirectives.affective
    ? `\n\nAFFECTIVE SIGNAL (from prior response — overrides depth/difficulty defaults):\n${bandDirectives.affective}`
    : "";
  return `${depthLine}${difficultyLine}${affectiveLine}`;
}

/**
 * Directive text injected into the Gemini quiz prompt for difficulty band.
 * "medium" returns "" — keeps current prompt behavior unchanged.
 */
function difficultyDirective(band) {
  if (band === "hard") {
    return "DIFFICULTY DIRECTIVE: Generate quiz questions at a HARD difficulty band. Target learner success rate 70-80%. Use edge cases, multi-step reasoning, and plausible distractors close to the correct answer.";
  }
  if (band === "easy") {
    return "DIFFICULTY DIRECTIVE: Generate quiz questions at an EASY difficulty band. Focus on recall and core understanding. Keep distractors clearly incorrect to the informed learner. Target 70-80% success rate.";
  }
  return "";
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

    // Phase 3 — Affective feedback. Pull the most-recent fresh signal for
    // this session (if any) so we can adapt this lesson's depth and angle
    // to how the learner reacted to the previous response.
    const latestFeedback = await readLatestFeedback(userId, { sessionId: sessionId || undefined });
    const affectiveDirective = buildAffectiveDirective(latestFeedback);
    const affectiveBlock = affectiveDirective
      ? `\n\nAFFECTIVE SIGNAL (from prior response):\n${affectiveDirective}\n`
      : "";
    const affectiveContext =
      latestFeedback && typeof latestFeedback.signal === "string" && affectiveDirective
        ? latestFeedback.signal
        : null;

    const topic = query;

    // Diagnosis first, then objectives — we need objectives' skillTags BEFORE
    // runSpoke so ZPD mastery can thread fade/difficulty directives into the
    // spoke prompt. The latency hit (one extra sequential Gemini call) is
    // worth the tutor-impact gain of actually personalizing the deep dive.
    const diagnosisSettled = await settledValue(
      runDiagnosis({ query, learnerBlock, affectiveBlock, apiKey, trace, normalized })
    );
    const diagnosis = diagnosisSettled && !diagnosisSettled.__error ? diagnosisSettled : null;

    const objectivesSettled = await settledValue(
      runObjectives({ query, diagnosis, apiKey, trace, normalized })
    );
    const objectives =
      objectivesSettled && !objectivesSettled.__error ? objectivesSettled : null;

    // Compute skillTags now so we can feed them into ZPD band classification.
    const skillTags = [
      ...((objectives && Array.isArray(objectives.fix_specific)) ? objectives.fix_specific : []),
      ...((objectives && Array.isArray(objectives.transferable)) ? objectives.transferable : []),
    ].filter((t) => typeof t === "string" && t.trim().length > 0);

    // Phase 2B/2C — band classification from PFA mastery across lesson tags.
    const { mean: meanMastery, sampled: masterySampled } = computeMeanMastery(
      learnerState && learnerState.skillState,
      skillTags
    );
    const depthBand = classifyDepthBand(meanMastery);
    const difficultyBand = classifyDifficultyBand(meanMastery);
    const bandDirectives = {
      depth: depthDirective(depthBand, meanMastery),
      difficulty: difficultyDirective(difficultyBand),
      // Affective directive wins when present (rendered last in the prompt).
      affective: affectiveDirective,
    };

    const [spokeSettled, takeawaysSettled, widgetSettled] = await Promise.all([
      settledValue(runSpoke(topic, learnerLevel, apiKey, bandDirectives)),
      settledValue(runTakeaways({ query, topic, apiKey })),
      settledValue(
        runWidget({
          topic,
          diagnosis,
          objectives,
          learnerLevel,
          apiKey,
        })
      ),
    ]);

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
            questions: spoke.quiz_questions.map((q) => {
              const options = Array.isArray(q.options) ? q.options : [];
              const rawExplanations = Array.isArray(q.explanations) ? q.explanations : null;
              const explanations = rawExplanations
                ? options.map((_, i) =>
                    typeof rawExplanations[i] === "string" ? rawExplanations[i] : ""
                  )
                : null;
              return {
                q: q.question,
                options,
                correctIndex: Number.isFinite(q.correct_index) ? q.correct_index : 0,
                explanation: q.explanation || "",
                ...(explanations ? { explanations } : {}),
              };
            }),
          }
        : null,
      widgetHtml,
      depthBand,
      difficultyBand,
      meanMastery: meanMastery === null ? null : Number(meanMastery.toFixed(4)),
      affectiveContext,
      generatedAt: new Date().toISOString(),
      engine,
    };

    // skillTags (computed earlier for ZPD band classification) feeds the
    // quiz→skillState adaptation loop (ingestQuizResult). skillStateWriter
    // normalizes names.

    let lessonId = null;
    try {
      const lessonsRef = db.collection("users").doc(userId).collection("lessons");
      const ref = lessonsRef.doc();
      lessonId = ref.id;
      await ref.set({
        ...lesson,
        skillTags,
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
      depthBand,
      difficultyBand,
      meanMastery: meanMastery === null ? null : Number(meanMastery.toFixed(4)),
      masterySampled,
      affectiveContext,
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
exports._internal = {
  stripWidgetFences,
  inferLearnerLevel,
  computeMeanMastery,
  classifyDepthBand,
  classifyDifficultyBand,
  depthDirective,
  difficultyDirective,
  composeSpokePromptDirectives,
};

// Silence unused-warning for wrapEvidence (kept for parity with related handlers
// in case this file is extended to include grounded evidence blocks).
void wrapEvidence;
