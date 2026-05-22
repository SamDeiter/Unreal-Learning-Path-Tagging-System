/**
 * mineMisconceptions — Admin-only callable that synthesizes the named
 * misconception taxonomy from raw signals.
 *
 * Input (all optional):
 *   {
 *     tags?: string[],      // filter: only mine these primary tags
 *     maxSignals?: number,  // hard cap on signals read (default 500)
 *     minGroupSize?: number // require at least N signals per tag (default 3)
 *   }
 *
 * Output:
 *   {
 *     success: true,
 *     groupsProcessed: number,
 *     misconceptionsUpserted: number,
 *     tagsCovered: string[],
 *     skippedTags: string[]   // groups that were too small
 *   }
 *
 * Invocation: admin claim required (bootstrap emails also accepted via the
 * same list used in setAdminClaim). Writes to the global `misconceptions`
 * collection. Deterministic doc IDs (tag__nameHash) mean re-running mining
 * updates existing entries instead of duplicating them — so this is safe to
 * run repeatedly as new signals accrue.
 *
 * Notes:
 * - This callable does NOT page — it reads a single bounded window. For
 *   higher signal volumes, add a scheduled wrapper later.
 * - No rate limiting beyond the admin gate; intended for occasional runs.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions");
const { requireAppCheck } = require("../utils/appCheckMiddleware");
const { requireAdmin } = require("../utils/authGuard");
const vertex = require("../utils/vertex");

const SYNTH_MODEL = "gemini-2.5-flash";
const SYNTH_TIMEOUT_MS = 30000;

const DEFAULT_MAX_SIGNALS = 500;
const DEFAULT_MIN_GROUP_SIZE = 3;
const MAX_TAGS_FILTER = 20;
const MAX_EXAMPLES_PER_PROMPT = 25;
const MAX_NAME_LEN = 100;
const MAX_DESC_LEN = 400;

function sanitizeTags(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const t of arr) {
    if (typeof t !== "string") continue;
    const s = t.slice(0, 120);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= MAX_TAGS_FILTER) break;
  }
  return out;
}

/**
 * Stable short hash for deterministic doc IDs. djb2 mod 2^30, hex-encoded.
 * Not cryptographic — just a collision-resistant ID suffix.
 */
function shortHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function truncStr(s, max) {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

function groupSignalsByTag(signals) {
  const groups = new Map();
  for (const sig of signals) {
    const tags = Array.isArray(sig.skillTags) ? sig.skillTags : [];
    if (tags.length === 0) continue;
    // Primary tag = first; groups are 1-per-tag but a single signal can
    // land in multiple groups when it carries multiple tags (rare but ok).
    for (const tag of tags) {
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag).push(sig);
    }
  }
  return groups;
}

function buildPromptForGroup(tag, signals) {
  const quizSignals = signals.filter((s) => s.source === "quiz_wrong");
  const feedbackSignals = signals.filter((s) => s.source === "confused_feedback");

  const quizExamples = quizSignals.slice(0, MAX_EXAMPLES_PER_PROMPT).map((s, i) => {
    const parts = [`${i + 1}.`];
    if (s.stem) parts.push(`Q: "${truncStr(s.stem, 200)}"`);
    if (s.pickedOptionText) parts.push(`picked: "${truncStr(s.pickedOptionText, 160)}"`);
    if (s.correctOptionText) parts.push(`correct: "${truncStr(s.correctOptionText, 160)}"`);
    if (s.explanationForPick) parts.push(`why-tempting: "${truncStr(s.explanationForPick, 240)}"`);
    return parts.join(" | ");
  });
  const feedbackExamples = feedbackSignals.slice(0, MAX_EXAMPLES_PER_PROMPT).map((s, i) => {
    const c = truncStr(s.comment || "(no comment)", 240);
    return `${i + 1}. ${c}`;
  });

  const quizBlock = quizExamples.length
    ? `Wrong-answer patterns (${quizSignals.length} total):\n${quizExamples.join("\n")}`
    : "No quiz wrong-answer signals.";
  const feedbackBlock = feedbackExamples.length
    ? `Confused-feedback comments (${feedbackSignals.length} total):\n${feedbackExamples.join("\n")}`
    : "No confused-feedback signals.";

  return `You analyze learner struggle signals for Unreal Engine 5 tutoring. Synthesize a short, named misconception taxonomy for the given topic tag.

Topic tag: "${tag}"

${quizBlock}

${feedbackBlock}

TASK:
Identify 1-3 DISTINCT misconceptions the signals cluster around. A misconception is a wrong mental model, not a fix-step. If the signals don't clearly cluster, return fewer entries or an empty array. Do NOT invent misconceptions beyond the evidence.

For each misconception, return:
- name: short handle, 3-8 words, title case ("Confuses Action Mapping with Axis Mapping")
- description: 1-2 sentences of the wrong mental model the learner is using
- symptoms: 1-3 observable patterns (things the learner does/says when this fires)

Return ONLY valid JSON matching:
{"misconceptions":[{"name":"str","description":"str","symptoms":["str"]}]}`;
}

function parseGeminiJson(text) {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  // Strip code fences if present.
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try extracting the first JSON object.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    return null;
  }
}

async function synthesizeGroup({ tag, signals }) {
  const prompt = buildPromptForGroup(tag, signals);
  const resp = await vertex.generateContent(
    SYNTH_MODEL,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    },
    { signal: AbortSignal.timeout(SYNTH_TIMEOUT_MS) }
  );
  if (!resp.ok) throw new Error(`mine_synth_failed_${resp.status}`);
  const body = await resp.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const parsed = parseGeminiJson(text);
  const arr = parsed && Array.isArray(parsed.misconceptions) ? parsed.misconceptions : [];
  return arr
    .map((m) => ({
      name: truncStr(m?.name, MAX_NAME_LEN),
      description: truncStr(m?.description, MAX_DESC_LEN),
      symptoms: Array.isArray(m?.symptoms)
        ? m.symptoms.slice(0, 5).map((s) => truncStr(s, 200)).filter(Boolean)
        : [],
    }))
    .filter((m) => m.name && m.description);
}

async function upsertMisconceptions({ tag, synthesized, signals, relatedTags }) {
  const db = admin.firestore();
  const col = db.collection("misconceptions");
  const uniqueUids = new Set(signals.map((s) => s.uid).filter(Boolean));
  let upserted = 0;
  for (const m of synthesized) {
    const docId = `${slugify(tag) || "tag"}__${shortHash(m.name.toLowerCase())}`;
    const ref = col.doc(docId);
    const existingSnap = await ref.get().catch(() => null);
    const base = {
      tag,
      relatedTags: Array.isArray(relatedTags) ? relatedTags : [],
      name: m.name,
      description: m.description,
      symptoms: m.symptoms,
      signalCount: signals.length,
      learnerCount: uniqueUids.size,
      schemaVersion: 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (existingSnap && existingSnap.exists) {
      await ref.set(base, { merge: true });
    } else {
      await ref.set({
        ...base,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    upserted += 1;
  }
  return upserted;
}

function collectRelatedTags(signals, primaryTag) {
  const counts = new Map();
  for (const sig of signals) {
    const tags = Array.isArray(sig.skillTags) ? sig.skillTags : [];
    for (const t of tags) {
      if (t === primaryTag) continue;
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);
}

exports.mineMisconceptions = onCall(
  {
    region: "us-central1",
    maxInstances: 2,
    timeoutSeconds: 300,
    memory: "512MiB",
    minInstances: 0,
  },
  async (request) => {
    requireAppCheck(request, { allowInvalid: false });

    // SECURITY: Use centralized requireAdmin helper
    requireAdmin(request);

    const data = request.data || {};
    const tagFilter = sanitizeTags(data.tags);
    const maxSignals = Number.isFinite(data.maxSignals) && data.maxSignals > 0
      ? Math.min(Math.floor(data.maxSignals), 2000)
      : DEFAULT_MAX_SIGNALS;
    const minGroupSize = Number.isFinite(data.minGroupSize) && data.minGroupSize > 0
      ? Math.min(Math.floor(data.minGroupSize), 50)
      : DEFAULT_MIN_GROUP_SIZE;

    const db = admin.firestore();
    const query = db
      .collection("misconceptionSignals")
      .orderBy("createdAt", "desc")
      .limit(maxSignals);

    const snap = await query.get().catch((err) => {
      logger.error(
        JSON.stringify({
          severity: "ERROR",
          message: "mine_signals_read_failed",
          error: err && err.message ? err.message : String(err),
        })
      );
      throw new HttpsError("internal", "Failed to read signals.");
    });

    const allSignals = [];
    snap.forEach((d) => {
      const v = d.data() || {};
      allSignals.push({ id: d.id, ...v });
    });

    // Optional tag filter — applied post-read so the orderBy stays simple.
    const filteredSignals = tagFilter.length === 0
      ? allSignals
      : allSignals.filter((s) =>
          Array.isArray(s.skillTags) && s.skillTags.some((t) => tagFilter.includes(t))
        );

    const groups = groupSignalsByTag(filteredSignals);
    const tagsCovered = [];
    const skippedTags = [];
    let groupsProcessed = 0;
    let misconceptionsUpserted = 0;

    for (const [tag, groupSignals] of groups.entries()) {
      if (groupSignals.length < minGroupSize) {
        skippedTags.push(tag);
        continue;
      }
      try {
        const synthesized = await synthesizeGroup({ tag, signals: groupSignals });
        if (synthesized.length === 0) {
          skippedTags.push(tag);
          continue;
        }
        const relatedTags = collectRelatedTags(groupSignals, tag);
        const upserted = await upsertMisconceptions({
          tag,
          synthesized,
          signals: groupSignals,
          relatedTags,
        });
        tagsCovered.push(tag);
        groupsProcessed += 1;
        misconceptionsUpserted += upserted;
      } catch (err) {
        logger.warn(
          JSON.stringify({
            severity: "WARNING",
            message: "mine_group_failed",
            tag,
            error: err && err.message ? err.message : String(err),
          })
        );
      }
    }

    logger.info(
      JSON.stringify({
        severity: "INFO",
        message: "mine_misconceptions_complete",
        caller: request.auth.uid,
        signalsRead: allSignals.length,
        signalsProcessed: filteredSignals.length,
        groupsProcessed,
        misconceptionsUpserted,
        tagsCovered: tagsCovered.length,
        skippedTags: skippedTags.length,
      })
    );

    return {
      success: true,
      groupsProcessed,
      misconceptionsUpserted,
      tagsCovered,
      skippedTags,
      signalsProcessed: filteredSignals.length,
    };
  }
);

// Exported for unit tests.
exports._internal = {
  sanitizeTags,
  shortHash,
  slugify,
  groupSignalsByTag,
  parseGeminiJson,
  collectRelatedTags,
};
