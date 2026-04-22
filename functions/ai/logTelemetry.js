/**
 * logTelemetry — Lightweight Cloud Function for client-side telemetry.
 *
 * Accepts telemetry data from the client and writes it to the `apiUsage`
 * Firestore collection using the admin SDK (which bypasses security rules).
 *
 * For learner-activity events (query_submitted, path_video_completed,
 * diagnosis_accepted, etc.) we also fire-and-forget a skillState update
 * so the digital-tutor profile stays current.
 */
const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { logApiUsage } = require("../utils/apiUsage");
const { requireAppCheck } = require("../utils/appCheckMiddleware");
const { applySkillSignals, applySkillSignal } = require("./skillStateWriter");

const ALLOWED_TYPES = [
  "onboarding_rag",
  "query_submitted",
  "path_viewed",
  "path_video_completed",
  "video_played",
  "query_repeated",
  "diagnosis_accepted",
];

const REPEAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REPEAT_THRESHOLD = 3;

function extractTags(rest) {
  const candidates = [];
  if (Array.isArray(rest.tags)) candidates.push(...rest.tags);
  if (Array.isArray(rest.detectedTags)) candidates.push(...rest.detectedTags);
  if (Array.isArray(rest.tagsTouched)) candidates.push(...rest.tagsTouched);
  if (typeof rest.tag === "string") candidates.push(rest.tag);
  const seen = new Set();
  const out = [];
  for (const t of candidates) {
    if (typeof t !== "string" || !t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 20) break;
  }
  return out;
}

async function detectRepeatedTags(uid, tags) {
  if (!uid || tags.length === 0) return [];
  try {
    const db = admin.firestore();
    const since = admin.firestore.Timestamp.fromMillis(Date.now() - REPEAT_WINDOW_MS);
    const snap = await db
      .collection("apiUsage")
      .where("userId", "==", uid)
      .where("type", "==", "query_submitted")
      .where("timestamp", ">=", since)
      .limit(200)
      .get();

    const counts = Object.create(null);
    snap.forEach((doc) => {
      const d = doc.data() || {};
      const seen = new Set();
      const pool = []
        .concat(Array.isArray(d.tags) ? d.tags : [])
        .concat(Array.isArray(d.detectedTags) ? d.detectedTags : []);
      for (const t of pool) {
        if (typeof t !== "string" || seen.has(t)) continue;
        seen.add(t);
        counts[t] = (counts[t] || 0) + 1;
      }
    });

    return tags.filter((t) => (counts[t] || 0) + 1 >= REPEAT_THRESHOLD);
  } catch (err) {
    logger.warn(JSON.stringify({
      severity: "WARNING",
      message: "repeat_detection_failed",
      uid,
      error: err && err.message ? err.message : String(err),
    }));
    return [];
  }
}

async function routeSkillSignals(uid, type, rest) {
  if (!uid || uid === "anonymous") return;
  const tags = extractTags(rest);

  try {
    if (type === "query_submitted" && tags.length > 0) {
      const signals = tags.map((tag) => ({ tag, signal: "encountered", weight: 0.02 }));
      await applySkillSignals(uid, signals);

      const repeated = await detectRepeatedTags(uid, tags);
      if (repeated.length > 0) {
        const struggles = repeated.map((tag) => ({ tag, signal: "struggled", weight: 0.1 }));
        await applySkillSignals(uid, struggles);
      }
      return;
    }

    if (type === "path_video_completed" && tags.length > 0) {
      const signals = tags.map((tag) => ({ tag, signal: "completed" }));
      await applySkillSignals(uid, signals);
      return;
    }

    if (type === "diagnosis_accepted" && tags.length > 0) {
      const signals = tags.map((tag) => ({ tag, signal: "encountered", weight: 0.05 }));
      await applySkillSignals(uid, signals);
      return;
    }

    if ((type === "path_viewed" || type === "video_played") && tags.length > 0) {
      const signals = tags.map((tag) => ({ tag, signal: "encountered", weight: 0.01 }));
      await applySkillSignals(uid, signals);
      return;
    }
  } catch (_) {
    // skillStateWriter already swallows; belt-and-braces guard
  }
}

exports.logTelemetry = onCall({ memory: "512MiB", minInstances: 0 }, async (request) => {
    // App Check enforcement (permissive during rollout)
    requireAppCheck(request, { allowInvalid: false });
  const { type, ...rest } = request.data || {};

  if (!type) {
    throw new HttpsError("invalid-argument", "Missing required field: type");
  }

  if (!ALLOWED_TYPES.includes(type)) {
    throw new HttpsError("invalid-argument", `Unknown telemetry type: ${type}`);
  }

  const userId = request.auth?.uid || "anonymous";

  await logApiUsage(userId, { type, ...rest, firestoreReads: 0, firestoreWrites: 1 });

  // Fire-and-forget skillState update — must never block or fail telemetry.
  routeSkillSignals(userId, type, rest).catch(() => {});

  return { success: true };
});

// Silence unused-var linters for applySkillSignal if tree-shaking ever matters.
void applySkillSignal;
